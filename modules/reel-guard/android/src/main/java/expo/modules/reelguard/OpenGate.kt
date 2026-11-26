package expo.modules.reelguard

import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * "Pause before opening": a calm full-screen breathing screen when a chosen app comes to the front.
 * Leaving ("Not now", or Back) is possible right away; "Open" appears after one breath. A rule the
 * user set up in the app; it never decides for them.
 */
class OpenGate(private val ctx: Context, private val onChoice: (pkg: String, open: Boolean) -> Unit) {
  private companion object {
    const val BG = 0xFF141320.toInt() // the app's dark background, opaque: nothing to tempt behind it
    const val ACCENT = 0xFF6C5CE7.toInt()
    const val TEXT = 0xFFF4F2FA.toInt()
    const val MUTED = 0xFFA7A3B8.toInt()
  }

  private val handler = Handler(Looper.getMainLooper())
  private var root: View? = null
  var pkg: String? = null
    private set
  val showing get() = root != null

  private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, ctx.resources.displayMetrics).toInt()

  private fun text(value: String, sizeSp: Float, color: Int, bold: Boolean = false) = TextView(ctx).apply {
    text = value
    setTextColor(color)
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
    gravity = Gravity.CENTER
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }

  fun show(pkg: String, cfg: GateConfig, opensToday: Int) {
    if (showing) return
    val app = cfg.names[pkg] ?: pkg.substringAfterLast('.').replaceFirstChar { it.uppercase() }
    this.pkg = pkg

    // Back on this screen = "Not now".
    val frame = object : FrameLayout(ctx) {
      override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_BACK) {
          if (event.action == KeyEvent.ACTION_UP) choose(false)
          return true
        }
        return super.dispatchKeyEvent(event)
      }
    }.apply { setBackgroundColor(BG) }

    val column = LinearLayout(ctx).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(32f), dp(48f), dp(32f), dp(48f))
    }

    val size = dp(190f)
    val circleBox = FrameLayout(ctx)
    val circle = View(ctx).apply {
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(ACCENT) }
      alpha = 0.85f
      scaleX = 0.55f
      scaleY = 0.55f
    }
    circleBox.addView(circle, FrameLayout.LayoutParams(size, size))
    val phase = text(cfg.breatheIn, 20f, TEXT, bold = true)
    val title = text(cfg.title, 26f, TEXT, bold = true)
    val opens = (if (opensToday == 1) cfg.opensOne else cfg.opensOther)
      .replace("{app}", app).replace("{count}", opensToday.toString())
    val sub = text(opens, 15f, MUTED)
    val stay = text(cfg.stay, 17f, 0xFF1D1B29.toInt(), bold = true).apply {
      background = GradientDrawable().apply { cornerRadius = dp(28f).toFloat(); setColor(TEXT) }
      setPadding(dp(24f), dp(16f), dp(24f), dp(16f))
      setOnClickListener { choose(false) }
    }
    val open = text(cfg.open.replace("{app}", app), 15f, MUTED).apply {
      setPadding(dp(16f), dp(14f), dp(16f), dp(14f))
      visibility = View.INVISIBLE // after one breath
      setOnClickListener { choose(true) }
    }

    fun gap(h: Float) = View(ctx).also { column.addView(it, LinearLayout.LayoutParams(1, dp(h))) }
    column.addView(title)
    gap(8f)
    column.addView(sub)
    gap(36f)
    column.addView(circleBox, LinearLayout.LayoutParams(size, size))
    gap(20f)
    column.addView(phase)
    gap(44f)
    column.addView(stay, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    gap(8f)
    column.addView(open)
    frame.addView(column, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER))

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT,
    )
    try {
      (ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(frame, params)
    } catch (e: Exception) {
      this.pkg = null
      return
    }
    root = frame
    frame.requestFocus()

    // One breath: in for half, out for half, repeating while the screen stays. The handler keeps the
    // rhythm (so the words still change if the system turned animations off); the view animates.
    val half = cfg.breathSec * 500L
    fun breathe(inhale: Boolean) {
      if (root !== frame) return
      phase.text = if (inhale) cfg.breatheIn else cfg.breatheOut
      val target = if (inhale) 1f else 0.55f
      circle.animate().scaleX(target).scaleY(target).setDuration(half).setInterpolator(AccelerateDecelerateInterpolator()).start()
      handler.postDelayed({ breathe(!inhale) }, half)
    }
    breathe(true)
    handler.postDelayed({
      if (root !== frame) return@postDelayed
      title.text = cfg.ask.replace("{app}", app)
      open.visibility = View.VISIBLE
      open.alpha = 0f
      open.animate().alpha(1f).setDuration(400).start()
    }, cfg.breathSec * 1000L)
  }

  fun hide() {
    val view = root ?: return
    root = null
    pkg = null
    handler.removeCallbacksAndMessages(null)
    runCatching { (ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(view) }
  }

  private fun choose(open: Boolean) {
    val p = pkg ?: return
    hide()
    onChoice(p, open)
  }
}
