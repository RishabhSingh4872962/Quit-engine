package expo.modules.reelguard

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS side of the reel counter: status, settings shortcut, daily stats, detection rules. */
class ReelGuardModule : Module() {
  private companion object {
    const val DETAILS_ACTION = "android.settings.ACCESSIBILITY_DETAILS_SETTINGS"
  }

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val component: ComponentName
    get() = ComponentName(context, ReelGuardService::class.java)

  override fun definition() = ModuleDefinition {
    Name("ReelGuard")
    Events("onChange")

    OnStartObserving { ReelStore.listener = { sendEvent("onChange", mapOf("at" to System.currentTimeMillis())) } }
    OnStopObserving { ReelStore.listener = null }

    // True when the user has switched the service on in Accessibility settings.
    Function("isEnabled") {
      val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
      enabled?.split(':')?.any { ComponentName.unflattenFromString(it) == component } ?: false
    }

    // Opens this app's page in Accessibility settings (Android 11+), or the general list.
    Function("openSettings") {
      val activity = appContext.currentActivity
      val starter: Context = activity ?: context
      fun open(intent: Intent) {
        if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        starter.startActivity(intent)
      }
      try {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) throw ActivityNotFoundException()
        // Not in the public SDK, but Settings on Android 11+ handles it: opens our service's page directly.
        open(Intent(DETAILS_ACTION).putExtra(Intent.EXTRA_COMPONENT_NAME, component.flattenToString()))
      } catch (e: RuntimeException) { // ActivityNotFoundException or SecurityException
        open(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
      }
    }

    // [{ day: "YYYY-MM-DD", apps: { package: { count, ms } } }], oldest first.
    Function("getStats") { days: Int -> ReelStore.stats(context, days.coerceIn(1, 60)) }

    // Daily limit (0 = off) and the nudge text with {count} and {limit}, already in the app's language.
    Function("setLimit") { limit: Int, nudge: String -> ReelStore.setLimit(context, limit, nudge) }

    Function("getLimitState") {
      mapOf(
        "limit" to ReelStore.limit(context),
        "extraToday" to ReelStore.extraToday(context),
        "pausesOffToday" to ReelStore.pausesOffToday(context),
      )
    }

    // "5 more": the next pause comes at limit + extra (today only).
    Function("addExtraToday") { n: Int -> ReelStore.addExtraToday(context, n) }

    // "No more pauses today".
    Function("setPausesOffToday") { ReelStore.setPausesOffToday(context) }

    // Blocking rules (Premium) as JSON; null or "" turns blocking off.
    Function("setBlock") { json: String? -> ReelStore.setBlock(context, json) }

    // Live counter bubble while watching reels ({count} in the text).
    Function("setBubble") { on: Boolean, text: String ->
      ReelStore.setBubble(context, on, text)
      ReelGuardService.instance?.refreshBubble()
    }

    // Pauses back on: forget today's "5 more", "no more pauses" and earlier pauses.
    Function("resetToday") { ReelStore.resetToday(context) }

    // Back to the app the pause interrupted. Starting an activity needs no package visibility.
    // A short grace so "pause before opening" doesn't ask again right after our own pause screen.
    Function("openApp") { pkg: String ->
      ReelStore.setGrace(context, pkg, System.currentTimeMillis() + 2 * 60_000L)
      try {
        context.startActivity(
          Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(pkg)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        true
      } catch (e: RuntimeException) {
        false
      }
    }

    // "Pause before opening": { apps, breath, grace, names, text }; null = off.
    Function("setGate") { json: String? ->
      ReelStore.setGate(context, json)
      ReelGuardService.instance?.applyRules()
    }

    // Which of these apps are installed (only packages listed in the manifest's <queries> are visible).
    Function("installedApps") { pkgs: List<String> ->
      pkgs.filter { context.packageManager.getLaunchIntentForPackage(it) != null }
    }

    // "Count in browsers": Shorts/Reels pages in browsers (address bar only). Off by default.
    Function("setWeb") { on: Boolean ->
      ReelStore.setWeb(context, on)
      ReelGuardService.instance?.applyRules()
    }

    // "Silence notifications while focusing": Do Not Disturb access, its settings page, start/end.
    Function("dndAccess") { FocusDnd.hasAccess(context) }
    Function("openDndAccess") {
      val activity = appContext.currentActivity
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (activity ?: context).startActivity(intent)
    }
    Function("startFocusDnd") { until: Double -> FocusDnd.start(context, until.toLong()) }
    Function("endFocusDnd") { FocusDnd.end(context) }

    // New detection rules (JSON array) from Remote Config; null/invalid = built-in defaults.
    Function("setRules") { json: String? ->
      ReelStore.saveRules(context, json)
      ReelGuardService.instance?.applyRules()
    }
  }
}
