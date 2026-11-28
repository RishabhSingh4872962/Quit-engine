package expo.modules.reelguard

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * "Silence notifications while focusing" (optional, needs the user's Do Not Disturb access).
 * At the start of a focus session: priority-only mode, unless Do Not Disturb is already on (then
 * nothing is touched). A few seconds before the session ends an exact alarm turns it back off, so the
 * "session complete" alert can ring and DND never stays on if the app isn't opened. Without exact
 * alarms ("Alarms & reminders") Android may run that alarm many minutes late, so DND isn't used then.
 * We only ever restore a mode we set ourselves.
 */
object FocusDnd {
  private const val PREFS = "focus_dnd"
  private const val RESTORE_EARLY_MS = 3_000L

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun manager(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun hasAccess(ctx: Context) = manager(ctx).isNotificationPolicyAccessGranted

  /** Exact alarms allowed: needed so DND ends with the session, not minutes later. */
  fun canEndOnTime(ctx: Context) =
    Build.VERSION.SDK_INT < 31 || (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()

  /** Priority-only mode until `until` (epoch ms). False without access or exact alarms, or if DND was already on. */
  fun start(ctx: Context, until: Long): Boolean {
    val nm = manager(ctx)
    if (!nm.isNotificationPolicyAccessGranted || !canEndOnTime(ctx)) return false
    val ours = prefs(ctx).getBoolean("set", false)
    if (!ours && nm.currentInterruptionFilter != NotificationManager.INTERRUPTION_FILTER_ALL) return false // the user's own DND
    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
    prefs(ctx).edit().putBoolean("set", true).apply()
    schedule(ctx, until - RESTORE_EARLY_MS)
    return true
  }

  /** Back to normal, only if we turned DND on and it's still in the mode we set. */
  fun end(ctx: Context) {
    val p = prefs(ctx)
    cancel(ctx)
    if (!p.getBoolean("set", false)) return
    p.edit().remove("set").apply()
    val nm = manager(ctx)
    if (nm.isNotificationPolicyAccessGranted && nm.currentInterruptionFilter == NotificationManager.INTERRUPTION_FILTER_PRIORITY) {
      nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
    }
  }

  private fun pending(ctx: Context) = PendingIntent.getBroadcast(
    ctx, 7301, Intent(ctx, DndRestoreReceiver::class.java),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun schedule(ctx: Context, at: Long) {
    val alarms = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val time = maxOf(at, System.currentTimeMillis() + 1_000)
    if (canEndOnTime(ctx)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending(ctx))
    else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, time, pending(ctx)) // permission revoked meanwhile: still ends
  }

  private fun cancel(ctx: Context) {
    (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending(ctx))
  }
}

/** The focus session is about to end: turn our Do Not Disturb off (also when the app isn't running). */
class DndRestoreReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) = FocusDnd.end(context)
}
