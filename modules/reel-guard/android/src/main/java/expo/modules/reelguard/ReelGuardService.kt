package expo.modules.reelguard

import android.accessibilityservice.AccessibilityService
import android.content.pm.ApplicationInfo
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityWindowInfo

/**
 * Counts reels: notices when a configured app's reels player is on screen (by view ID), counts
 * one reel on entering it and one per settled swipe, and adds up the time spent there.
 *
 * Privacy: it only reads view IDs of the configured apps, never text or content, and stores
 * nothing but per-day numbers (ReelStore). Events from other apps are filtered out by Android.
 */
class ReelGuardService : AccessibilityService() {
  companion object {
    private const val TAG = "ReelGuard"
    private const val TICK_MS = 2_000L
    private const val SWIPE_GAP_MS = 800L // fallback when the pager doesn't report item indices
    private const val UNKNOWN_START = -2
    private const val SETTLE_MS = 1_500L // the player may swap in its first page while loading

    @Volatile var instance: ReelGuardService? = null
  }

  private val handler = Handler(Looper.getMainLooper())
  private var rules: Map<String, ReelRule> = emptyMap()
  private var active: String? = null // package whose reels player is open right now
  private var lastTick = 0L
  private var lastScreenCheck = 0L
  private var lastSwipeAt = 0L
  private var lastIndex = UNKNOWN_START
  private var lastPage: Int? = null // identity of the reel page on screen (rules with page IDs)
  private var enteredAt = 0L
  private var misses = 0
  private val debug by lazy { (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0 }

  private val ticker = object : Runnable {
    override fun run() {
      val pkg = active ?: return
      val now = SystemClock.elapsedRealtime()
      ReelStore.addTime(this@ReelGuardService, pkg, now - lastTick, notify = false)
      lastTick = now
      val power = getSystemService(POWER_SERVICE) as PowerManager
      if (!power.isInteractive) exit() else checkScreen()
      if (active != null) schedule()
    }
  }

  override fun onServiceConnected() {
    instance = this
    applyRules()
    ReelStore.prune(this)
  }

  /** Reloads detection rules (also after JS sends new ones) and listens only to those apps. */
  fun applyRules() {
    rules = ReelStore.rules(this).associateBy { it.pkg }
    serviceInfo = serviceInfo?.apply { packageNames = rules.keys.toTypedArray() }
    if (debug) dlog("watching ${rules.keys}")
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent) {
    // App switches (not tied to one package): check right away whether we left the reels player.
    if (event.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED) {
      if (active != null) checkScreen()
      return
    }
    val pkg = event.packageName?.toString() ?: return
    if (debug && event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
      dlog("event ${AccessibilityEvent.eventTypeToString(event.eventType)} $pkg src=${event.source?.viewIdResourceName}")
    }
    val rule = rules[pkg] ?: return
    when (event.eventType) {
      AccessibilityEvent.TYPE_VIEW_SCROLLED -> onScrolled(event, pkg, rule)
      AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
        if (debug) logIds(pkg)
        checkScreen()
      }
      AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
        val now = SystemClock.elapsedRealtime()
        if (now - lastScreenCheck >= 500) checkScreen() // these fire constantly; check at most twice a second
      }
    }
  }

  private fun onScrolled(event: AccessibilityEvent, pkg: String, rule: ReelRule) {
    val id = event.source?.viewIdResourceName?.substringAfter(":id/")
    if (debug) dlog("scroll $pkg id=$id from=${event.fromIndex} to=${event.toIndex}")
    if (id == null || id !in rule.pagerIds) return
    if (active != pkg) enter(pkg)
    if (rule.pageIds.isNotEmpty()) return // counted by page changes instead (checkScreen)
    val from = event.fromIndex
    if (from >= 0) {
      if (from != event.toIndex) return // still between two reels
      if (lastIndex == UNKNOWN_START) lastIndex = from // the reel counted on entering
      else if (from != lastIndex) {
        lastIndex = from
        ReelStore.addReel(this, pkg)
      }
    } else {
      val now = SystemClock.elapsedRealtime()
      if (now - lastSwipeAt > SWIPE_GAP_MS) ReelStore.addReel(this, pkg)
      lastSwipeAt = now
    }
  }

  /** Is a configured app's reels player in the active window? Enters or leaves accordingly. */
  private fun checkScreen() {
    lastScreenCheck = SystemClock.elapsedRealtime()
    // The app window the user is in. Its root is only readable for the configured apps.
    val root = windows.firstOrNull { it.type == AccessibilityWindowInfo.TYPE_APPLICATION && it.isActive }?.root
    val pkg = root?.packageName?.toString()
    val rule = pkg?.let { rules[it] }
    val open = root != null && rule != null && rule.screenIds.any { id ->
      root.findAccessibilityNodeInfosByViewId("$pkg:id/$id").isNotEmpty()
    }
    if (open) {
      misses = 0
      if (active != pkg) enter(pkg)
      if (rule.pageIds.isNotEmpty()) trackPage(root, pkg, rule)
    } else if (active != null && ++misses >= 2) {
      exit() // two misses in a row, so a brief redraw doesn't end the session
    }
  }

  /**
   * Some apps (YouTube Shorts) send no scroll event per reel. There, a new reel is a different
   * page view filling the player. Only view identity and size are used, never content.
   */
  private fun trackPage(root: AccessibilityNodeInfo, pkg: String, rule: ReelRule) {
    val bounds = Rect()
    fun height(node: AccessibilityNodeInfo) = bounds.also { node.getBoundsInScreen(it) }.height()
    val pages = rule.pageIds.flatMap { root.findAccessibilityNodeInfosByViewId("$pkg:id/$it") }
    val page = pages.maxByOrNull(::height) ?: return
    val pager = rule.pagerIds.firstNotNullOfOrNull { root.findAccessibilityNodeInfosByViewId("$pkg:id/$it").firstOrNull() }
    if (pager != null && height(page) < height(pager) * 3 / 4) return // mid-swipe: wait until it settles
    val id = page.hashCode() // based on the view's identity, not its content
    val settling = SystemClock.elapsedRealtime() - enteredAt < SETTLE_MS
    when {
      lastPage == null || settling -> lastPage = id // still the reel counted on entering
      lastPage == id -> Unit
      else -> {
        lastPage = id
        ReelStore.addReel(this, pkg)
        if (debug) dlog("next reel $pkg")
      }
    }
  }

  private fun enter(pkg: String) {
    if (active != null) exit()
    active = pkg
    misses = 0
    lastIndex = UNKNOWN_START
    lastPage = null
    enteredAt = SystemClock.elapsedRealtime()
    lastTick = SystemClock.elapsedRealtime()
    ReelStore.addReel(this, pkg) // the reel that is showing now
    schedule()
    if (debug) dlog("enter $pkg")
  }

  /** Exactly one pending tick while a reels player is open. */
  private fun schedule() {
    handler.removeCallbacks(ticker)
    handler.postDelayed(ticker, TICK_MS)
  }

  private fun exit() {
    val pkg = active ?: return
    handler.removeCallbacks(ticker)
    ReelStore.addTime(this, pkg, SystemClock.elapsedRealtime() - lastTick, notify = true)
    active = null
    if (debug) dlog("exit $pkg")
  }

  /** Debug builds: lists view IDs on screen, to find the right ones when an app changes. */
  private fun logIds(pkg: String) {
    val ids = sortedSetOf<String>()
    fun walk(node: AccessibilityNodeInfo?, depth: Int) {
      if (node == null || depth > 25 || ids.size > 120) return
      node.viewIdResourceName?.let { ids += it.substringAfter(":id/") }
      for (i in 0 until node.childCount) walk(node.getChild(i), depth + 1)
    }
    walk(rootInActiveWindow, 0)
    dlog("screen $pkg ids=$ids")
  }

  /**
   * Debug builds only: logcat plus a small file in app storage (some phones, e.g. vivo, hide app
   * logs). Read with: adb shell run-as com.quitengine.app cat files/reel_guard_debug.log
   * Contains view IDs and event types only, never screen text.
   */
  private fun dlog(message: String) {
    Log.i(TAG, message)
    try {
      val file = java.io.File(filesDir, "reel_guard_debug.log")
      if (file.length() > 200_000) file.delete()
      file.appendText("${System.currentTimeMillis()} $message\n")
    } catch (e: Exception) {
      Log.w(TAG, "debug log failed", e)
    }
  }

  override fun onInterrupt() {}

  override fun onDestroy() {
    exit()
    instance = null
    super.onDestroy()
  }
}
