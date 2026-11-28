package expo.modules.reelguard

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Blocking rules set by the user (Premium), evaluated natively when a reels player opens:
 * apps whose reels are always blocked, per-app daily limits, reel-free time windows
 * (minutes from midnight; end < start = overnight) and "block everything until".
 */
data class BlockConfig(
  val apps: Set<String>,
  val appLimits: Map<String, Int>,
  val windows: List<Pair<Int, Int>>,
  val until: Long,
  val text: String, // note shown when reels are blocked, in the app's language
  val study: StudyConfig?,
)

/**
 * YouTube study mode: only videos from these channels play; Shorts are blocked. Active always or
 * during a time window. Reads the channel name of the open video (user consented in the app).
 */
data class StudyConfig(
  val channels: List<String>, // lower-case names or @handles
  val always: Boolean,
  val window: Pair<Int, Int>?,
  val text: String,
  val watchIds: List<String>, // any of these on screen = a video page is open
  val prefixes: List<String>, // Subscribe button labels: "Subscribe to <channel>." (YouTube in English)
)

/**
 * "Pause before opening" (set by the user): when one of these apps comes to the front, a short
 * breathing screen asks before it opens. Texts arrive from JS already in the app's language.
 */
data class GateConfig(
  val apps: Set<String>,
  val breathSec: Int,
  val graceMin: Int, // after "Open", no pause for this app for this long
  val names: Map<String, String>, // package -> name shown ("Instagram")
  val title: String, // "Take a breath"
  val breatheIn: String,
  val breatheOut: String,
  val ask: String, // "Open {app}?"
  val opensOne: String, // "You've opened {app} {count} time today"
  val opensOther: String,
  val stay: String, // "Not now"
  val open: String, // "Open {app}"
)

/** How to recognise the reels screen of one app, by Android view IDs (the part after ":id/"). */
data class ReelRule(
  val pkg: String,
  val screenIds: List<String>, // any of these on screen = the reels player is open
  val pagerIds: List<String>, // the vertical pager whose scroll means "next reel"
  val pageIds: List<String> = emptyList(), // one reel's page: a different page view on screen = next reel
  val pip: Boolean = false, // the app's picture-in-picture window only ever plays reels (Instagram)
)

/** A browser and its address bar's view IDs: the only thing "count in browsers" reads there. */
data class WebRule(val pkg: String, val urlIds: List<String>)

/**
 * Per-day reel counts and time, kept in SharedPreferences so the service can write them while
 * the JS app isn't running. Only numbers per app per day are stored, nothing about the reels.
 */
object ReelStore {
  private const val PREFS = "reel_guard"
  private const val RULES_KEY = "rules"
  private const val KEEP_DAYS = 60

  /** Set by the module while JS listens; called when a count or time changes. */
  @Volatile var listener: (() -> Unit)? = null

  // Instagram changes its IDs often; these can be replaced from Remote Config (setRules).
  // YouTube video page, and where its channel name is exposed: the channel row has no view ID, but
  // the Subscribe button is labelled "Subscribe to <channel>." Both can be overridden in the config.
  val STUDY_WATCH_IDS = listOf("watch_player", "video_metadata_layout")
  val STUDY_PREFIXES = listOf("Subscribe to ", "Unsubscribe from ")

  /** Compare channel names loosely: lower case, no spaces, no "@" ("@RickAstley" ~ "Rick Astley"). */
  fun channelKey(name: String) = name.lowercase().replace("@", "").filterNot { it.isWhitespace() }

  private const val DEFAULT_RULES = """[
    {"package":"com.instagram.android",
     "screen":["clips_viewer_view_pager","clips_viewer_root","root_clips_layout","clips_video_container"],
     "pager":["clips_viewer_view_pager","clips_viewer_root","root_clips_layout"],
     "pip":true},
    {"package":"com.google.android.youtube",
     "screen":["reel_recycler","reel_watch_player","reel_player_page_container"],
     "pager":["reel_recycler"],
     "page":["reel_player_page_container"]}
  ]"""

  /**
   * Browsers for "count in browsers" (off unless the user turns it on). Chromium-based ones share
   * "url_bar"; Chrome is verified, the others follow their known address-bar IDs.
   */
  val WEB_RULES = listOf(
    WebRule("com.android.chrome", listOf("url_bar")),
    WebRule("com.chrome.beta", listOf("url_bar")),
    WebRule("com.brave.browser", listOf("url_bar")),
    WebRule("com.microsoft.emmx", listOf("url_bar")),
    WebRule("com.kiwibrowser.browser", listOf("url_bar")),
    WebRule("com.sec.android.app.sbrowser", listOf("location_bar_edit_text")),
    WebRule("org.mozilla.firefox", listOf("mozac_browser_toolbar_url_view")),
    WebRule("com.opera.browser", listOf("url_field")),
    WebRule("com.duckduckgo.mobile.android", listOf("omnibarTextInput")),
  )

  fun setWeb(ctx: Context, on: Boolean) = prefs(ctx).edit().putBoolean("web", on).apply()
  fun webOn(ctx: Context) = prefs(ctx).getBoolean("web", false)

  private fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun day(time: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date(time))

  fun rules(ctx: Context): List<ReelRule> =
    parseRules(prefs(ctx).getString(RULES_KEY, null)) ?: parseRules(DEFAULT_RULES).orEmpty()

  /** Saves rules from JS (Remote Config). Invalid or empty JSON goes back to the built-in defaults. */
  fun saveRules(ctx: Context, json: String?) {
    val valid = json?.takeIf { parseRules(it)?.isNotEmpty() == true }
    prefs(ctx).edit().apply { if (valid == null) remove(RULES_KEY) else putString(RULES_KEY, valid) }.apply()
  }

  private fun parseRules(json: String?): List<ReelRule>? = try {
    val arr = JSONArray(json ?: return null)
    (0 until arr.length()).map { i ->
      val o = arr.getJSONObject(i)
      ReelRule(
        o.getString("package"),
        o.getJSONArray("screen").strings(),
        o.getJSONArray("pager").strings(),
        o.optJSONArray("page")?.strings().orEmpty(),
        o.optBoolean("pip", false),
      )
    }
  } catch (e: Exception) {
    null
  }

  private fun JSONArray.strings() = (0 until length()).map { getString(it) }

  /** Adds one reel and returns today's total across all apps. */
  fun addReel(ctx: Context, pkg: String): Int {
    val now = System.currentTimeMillis()
    val today = day(now)
    val key = "$today|$pkg|n"
    val hourKey = "$today|$pkg|h" + Calendar.getInstance().apply { timeInMillis = now }.get(Calendar.HOUR_OF_DAY)
    val p = prefs(ctx)
    p.edit().putInt(key, p.getInt(key, 0) + 1).putInt(hourKey, p.getInt(hourKey, 0) + 1).apply()
    listener?.invoke()
    return p.all.entries.sumOf { (k, v) -> if (k.startsWith("$today|") && k.endsWith("|n")) v as Int else 0 }
  }

  // ---- Daily limit (set from JS). Per-day keys start with "x|" so stats() ignores them. ----

  private fun todayKey(name: String) = "x|${day(System.currentTimeMillis())}|$name"

  fun setLimit(ctx: Context, limit: Int, nudge: String) =
    prefs(ctx).edit().putInt("limit", limit.coerceAtLeast(0)).putString("nudge", nudge).apply()

  fun setBlock(ctx: Context, json: String?) {
    prefs(ctx).edit().apply { if (json.isNullOrBlank()) remove("block") else putString("block", json) }.apply()
    blockLoaded = false
  }

  @Volatile private var blockLoaded = false
  @Volatile private var blockCached: BlockConfig? = null

  /** Parsed once and kept until the rules change (checked several times a second while scrolling). */
  fun blockConfig(ctx: Context): BlockConfig? {
    if (!blockLoaded) {
      blockCached = parseBlock(ctx)
      blockLoaded = true
    }
    return blockCached
  }

  private fun parseBlock(ctx: Context): BlockConfig? = try {
    prefs(ctx).getString("block", null)?.let { JSONObject(it) }?.let { o ->
      val limits = o.optJSONObject("appLimits")
      BlockConfig(
        apps = o.optJSONArray("apps")?.strings()?.toSet().orEmpty(),
        appLimits = limits?.keys()?.asSequence()?.associateWith { limits.getInt(it) }.orEmpty(),
        windows = o.optJSONArray("windows")?.let { arr ->
          (0 until arr.length()).map { arr.getJSONArray(it).let { w -> w.getInt(0) to w.getInt(1) } }
        }.orEmpty(),
        until = o.optLong("until", 0),
        text = o.optString("text", ""),
        study = o.optJSONObject("study")?.let { s ->
          StudyConfig(
            channels = s.optJSONArray("channels")?.strings().orEmpty().map(::channelKey).filter { it.isNotEmpty() },
            always = s.optBoolean("always", false),
            window = s.optJSONArray("window")?.takeIf { it.length() == 2 }?.let { it.getInt(0) to it.getInt(1) },
            text = s.optString("text", ""),
            watchIds = s.optJSONArray("watchIds")?.strings() ?: STUDY_WATCH_IDS,
            prefixes = s.optJSONArray("prefixes")?.strings() ?: STUDY_PREFIXES,
          )
        }?.takeIf { it.channels.isNotEmpty() },
      )
    }
  } catch (e: Exception) {
    null
  }

  // ---- "Pause before opening" and app opens ----

  fun setGate(ctx: Context, json: String?) {
    prefs(ctx).edit().apply { if (json.isNullOrBlank()) remove("gate") else putString("gate", json) }.apply()
    gateLoaded = false
  }

  @Volatile private var gateLoaded = false
  @Volatile private var gateCached: GateConfig? = null

  fun gateConfig(ctx: Context): GateConfig? {
    if (!gateLoaded) {
      gateCached = parseGate(ctx)
      gateLoaded = true
    }
    return gateCached
  }

  private fun parseGate(ctx: Context): GateConfig? = try {
    prefs(ctx).getString("gate", null)?.let { JSONObject(it) }?.let { o ->
      val names = o.optJSONObject("names")
      val t = o.optJSONObject("text") ?: JSONObject()
      GateConfig(
        apps = o.optJSONArray("apps")?.strings()?.toSet().orEmpty(),
        breathSec = o.optInt("breath", 6).coerceIn(3, 30),
        graceMin = o.optInt("grace", 10).coerceIn(1, 120),
        names = names?.keys()?.asSequence()?.associateWith { names.getString(it) }.orEmpty(),
        title = t.optString("title", "Take a breath"),
        breatheIn = t.optString("breatheIn", "Breathe in"),
        breatheOut = t.optString("breatheOut", "Breathe out"),
        ask = t.optString("ask", "Open {app}?"),
        opensOne = t.optString("opensOne", "{count}"),
        opensOther = t.optString("opensOther", "{count}"),
        stay = t.optString("stay", "Not now"),
        open = t.optString("open", "Open {app}"),
      ).takeIf { it.apps.isNotEmpty() }
    }
  } catch (e: Exception) {
    null
  }

  /** Counts one open of an app today and returns today's opens of that app. */
  fun addOpen(ctx: Context, pkg: String): Int {
    val key = "${day(System.currentTimeMillis())}|$pkg|o"
    val p = prefs(ctx)
    val n = p.getInt(key, 0) + 1
    p.edit().putInt(key, n).apply()
    listener?.invoke()
    return n
  }

  /** "Not now" on the pause: the app wasn't opened. */
  fun addSkip(ctx: Context, pkg: String) {
    val key = "${day(System.currentTimeMillis())}|$pkg|s"
    val p = prefs(ctx)
    p.edit().putInt(key, p.getInt(key, 0) + 1).apply()
    listener?.invoke()
  }

  /** No pause before opening this app until then (after "Open", or when our app sends the user back). */
  fun setGrace(ctx: Context, pkg: String, until: Long) = prefs(ctx).edit().putLong("grace|$pkg", until).apply()
  fun graceUntil(ctx: Context, pkg: String) = prefs(ctx).getLong("grace|$pkg", 0)

  fun todayCount(ctx: Context, pkg: String) =
    prefs(ctx).getInt("${day(System.currentTimeMillis())}|$pkg|n", 0)

  /** Live counter bubble while watching reels; text has {count}. */
  fun setBubble(ctx: Context, on: Boolean, text: String) =
    prefs(ctx).edit().putBoolean("bubble", on).putString("bubbleText", text).apply()
  fun bubbleOn(ctx: Context) = prefs(ctx).getBoolean("bubble", false)
  fun bubbleText(ctx: Context, count: Int) =
    (prefs(ctx).getString("bubbleText", null) ?: "{count}").replace("{count}", count.toString())

  fun todayTotal(ctx: Context): Int {
    val today = day(System.currentTimeMillis())
    return prefs(ctx).all.entries.sumOf { (k, v) -> if (k.startsWith("$today|") && k.endsWith("|n")) v as Int else 0 }
  }

  fun limit(ctx: Context) = prefs(ctx).getInt("limit", 0)
  fun nudgeText(ctx: Context, count: Int, limit: Int) =
    (prefs(ctx).getString("nudge", null) ?: "{count} / {limit}")
      .replace("{count}", count.toString()).replace("{limit}", limit.toString())

  /** "5 more" today: the pause comes back at limit + extra. */
  fun extraToday(ctx: Context) = prefs(ctx).getInt(todayKey("extra"), 0)
  fun addExtraToday(ctx: Context, n: Int) = prefs(ctx).edit().putInt(todayKey("extra"), extraToday(ctx) + n).apply()

  /** "No more pauses today". */
  fun pausesOffToday(ctx: Context) = prefs(ctx).getBoolean(todayKey("off"), false)
  fun setPausesOffToday(ctx: Context) = prefs(ctx).edit().putBoolean(todayKey("off"), true).apply()

  /** Undo today's "5 more", "no more pauses" and pause history (new limit, or pauses back on). */
  fun resetToday(ctx: Context) =
    prefs(ctx).edit().remove(todayKey("extra")).remove(todayKey("off")).remove(todayKey("pausedAt")).apply()

  /** Today's reel total when the last pause was shown (0 = none yet). */
  fun pausedAt(ctx: Context) = prefs(ctx).getInt(todayKey("pausedAt"), 0)
  fun setPausedAt(ctx: Context, total: Int) = prefs(ctx).edit().putInt(todayKey("pausedAt"), total).apply()

  fun addTime(ctx: Context, pkg: String, ms: Long, notify: Boolean) {
    if (ms <= 0) return
    val key = "${day(System.currentTimeMillis())}|$pkg|ms"
    val p = prefs(ctx)
    p.edit().putLong(key, p.getLong(key, 0) + ms).apply()
    if (notify) listener?.invoke()
  }

  /** Last `days` days, oldest first: [{ day, apps: { pkg: { count, ms, opens, skips } }, hours: [24 counts] }]. */
  fun stats(ctx: Context, days: Int): List<Map<String, Any>> {
    val all = prefs(ctx).all
    val cal = Calendar.getInstance()
    cal.add(Calendar.DAY_OF_YEAR, -(days - 1))
    return (0 until days).map {
      val d = day(cal.timeInMillis)
      cal.add(Calendar.DAY_OF_YEAR, 1)
      val apps = HashMap<String, Map<String, Number>>()
      val hours = IntArray(24)
      for ((key, value) in all) {
        val parts = key.split('|')
        if (parts.size != 3 || parts[0] != d) continue
        if (parts[2].startsWith("h")) { // reels per hour of the day (all apps together)
          parts[2].drop(1).toIntOrNull()?.takeIf { it in 0..23 }?.let { hours[it] += value as Int }
          continue
        }
        val app = apps[parts[1]] ?: mapOf("count" to 0, "ms" to 0.0, "opens" to 0, "skips" to 0)
        apps[parts[1]] = when (parts[2]) {
          "n" -> app + ("count" to (value as Int))
          "ms" -> app + ("ms" to (value as Long).toDouble())
          "o" -> app + ("opens" to (value as Int))
          "s" -> app + ("skips" to (value as Int))
          else -> app
        }
      }
      mapOf("day" to d, "apps" to apps, "hours" to hours.toList())
    }
  }

  /** Drops days older than KEEP_DAYS. */
  fun prune(ctx: Context) {
    val cal = Calendar.getInstance()
    cal.add(Calendar.DAY_OF_YEAR, -KEEP_DAYS)
    val oldest = day(cal.timeInMillis)
    val p = prefs(ctx)
    val stale = p.all.keys.filter { it.contains('|') && it.removePrefix("x|").substringBefore('|') < oldest }
    if (stale.isNotEmpty()) p.edit().apply { stale.forEach { remove(it) } }.apply()
  }
}
