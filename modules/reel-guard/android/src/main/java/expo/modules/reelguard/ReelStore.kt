package expo.modules.reelguard

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/** How to recognise the reels screen of one app, by Android view IDs (the part after ":id/"). */
data class ReelRule(
  val pkg: String,
  val screenIds: List<String>, // any of these on screen = the reels player is open
  val pagerIds: List<String>, // the vertical pager whose scroll means "next reel"
  val pageIds: List<String> = emptyList(), // one reel's page: a different page view on screen = next reel
  val pip: Boolean = false, // the app's picture-in-picture window only ever plays reels (Instagram)
)

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
    val today = day(System.currentTimeMillis())
    val key = "$today|$pkg|n"
    val p = prefs(ctx)
    p.edit().putInt(key, p.getInt(key, 0) + 1).apply()
    listener?.invoke()
    return p.all.entries.sumOf { (k, v) -> if (k.startsWith("$today|") && k.endsWith("|n")) v as Int else 0 }
  }

  // ---- Daily limit (set from JS). Per-day keys start with "x|" so stats() ignores them. ----

  private fun todayKey(name: String) = "x|${day(System.currentTimeMillis())}|$name"

  fun setLimit(ctx: Context, limit: Int, nudge: String) =
    prefs(ctx).edit().putInt("limit", limit.coerceAtLeast(0)).putString("nudge", nudge).apply()

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

  /** Last `days` days, oldest first: [{ day: "2026-11-22", apps: { pkg: { count, ms } } }]. */
  fun stats(ctx: Context, days: Int): List<Map<String, Any>> {
    val all = prefs(ctx).all
    val cal = Calendar.getInstance()
    cal.add(Calendar.DAY_OF_YEAR, -(days - 1))
    return (0 until days).map {
      val d = day(cal.timeInMillis)
      cal.add(Calendar.DAY_OF_YEAR, 1)
      val apps = HashMap<String, Map<String, Number>>()
      for ((key, value) in all) {
        val parts = key.split('|')
        if (parts.size != 3 || parts[0] != d) continue
        val app = apps[parts[1]] ?: mapOf("count" to 0, "ms" to 0.0)
        apps[parts[1]] = when (parts[2]) {
          "n" -> app + ("count" to (value as Int))
          "ms" -> app + ("ms" to (value as Long).toDouble())
          else -> app
        }
      }
      mapOf("day" to d, "apps" to apps)
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
