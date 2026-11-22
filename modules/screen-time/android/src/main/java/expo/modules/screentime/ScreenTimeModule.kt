package expo.modules.screentime

import android.Manifest
import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Process
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * How long chosen apps were open (in the foreground), read from Android's usage stats.
 * Needs the user to turn on "Usage access" for this app in system settings.
 * Nothing is stored or sent anywhere: JS asks, and gets numbers back.
 */
class ScreenTimeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ScreenTime")

    Function("hasUsageAccess") { hasUsageAccess() }

    // Opens this app's "Usage access" switch (or the full list on launchers that lack the direct page).
    Function("openUsageAccessSettings") {
      val activity = appContext.currentActivity
      val starter: Context = activity ?: context
      fun open(intent: Intent) {
        if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        starter.startActivity(intent)
      }
      try {
        open(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse("package:${context.packageName}")))
      } catch (e: ActivityNotFoundException) {
        open(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
      }
    }

    // For each period [boundaries[i], boundaries[i + 1]), foreground milliseconds per package.
    AsyncFunction("getForegroundTime") { packages: List<String>, boundaries: List<Double> ->
      foregroundTime(packages.toHashSet(), boundaries.map { it.toLong() })
    }
  }

  private fun hasUsageAccess(): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return if (mode == AppOpsManager.MODE_DEFAULT) {
      context.checkCallingOrSelfPermission(Manifest.permission.PACKAGE_USAGE_STATS) == PackageManager.PERMISSION_GRANTED
    } else {
      mode == AppOpsManager.MODE_ALLOWED
    }
  }

  /**
   * Walks the activity events in the whole range once, pairing "resumed" with "paused" per
   * activity, and splits each session across the periods it overlaps (e.g. past midnight).
   */
  private fun foregroundTime(packages: Set<String>, bounds: List<Long>): List<Map<String, Double>> {
    if (bounds.size < 2) return emptyList()
    val from = bounds.first()
    val to = minOf(bounds.last(), System.currentTimeMillis())
    val result = List(bounds.size - 1) { HashMap<String, Double>() }
    if (to <= from) return result

    fun add(pkg: String, start: Long, end: Long) {
      for (i in 0 until bounds.size - 1) {
        val a = maxOf(start, bounds[i])
        val b = minOf(end, bounds[i + 1])
        if (b > a) result[i].merge(pkg, (b - a).toDouble()) { x, y -> x + y }
      }
    }

    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val events = usm.queryEvents(from, to)
    val open = HashMap<String, Long>() // "package/activity" -> resumed at
    val seen = HashSet<String>()
    val event = UsageEvents.Event()

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        RESUMED -> {
          val pkg = event.packageName ?: continue
          if (pkg !in packages) continue
          val key = "$pkg/${event.className}"
          open[key] = event.timeStamp
          seen += key
        }
        PAUSED -> {
          val pkg = event.packageName ?: continue
          if (pkg !in packages) continue
          val key = "$pkg/${event.className}"
          // A pause with no resume before it means the session began before `from`.
          val startedAt = open.remove(key) ?: if (key !in seen) from else null
          seen += key
          if (startedAt != null) add(pkg, startedAt, event.timeStamp)
        }
        SCREEN_OFF, SHUTDOWN -> {
          for ((key, startedAt) in open) add(key.substringBefore('/'), startedAt, event.timeStamp)
          open.clear()
        }
      }
    }
    // Still open at the end of the range.
    for ((key, startedAt) in open) add(key.substringBefore('/'), startedAt, to)
    return result
  }

  private companion object {
    // UsageEvents.Event types (ACTIVITY_RESUMED/PAUSED share values with the older MOVE_TO_* names).
    const val RESUMED = 1
    const val PAUSED = 2
    const val SCREEN_OFF = 16 // SCREEN_NON_INTERACTIVE
    const val SHUTDOWN = 26 // DEVICE_SHUTDOWN
  }
}
