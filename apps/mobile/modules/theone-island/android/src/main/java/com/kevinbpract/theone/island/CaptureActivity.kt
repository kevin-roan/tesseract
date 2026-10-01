package com.kevinbpract.theone.island

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import androidx.core.content.ContextCompat

class CaptureActivity : Activity() {
  companion object {
    const val EXTRA_SOURCE = "source"
    const val SOURCE_JS = "js"
    const val SOURCE_NOTIFICATION = "notification"
    private const val REQUEST_PROJECTION = 71

    fun intent(context: Context, source: String): Intent =
      Intent(context, CaptureActivity::class.java)
        .putExtra(EXTRA_SOURCE, source)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
  }

  private val source: String
    get() = intent.getStringExtra(EXTRA_SOURCE) ?: SOURCE_JS

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (savedInstanceState != null) return
    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    @Suppress("DEPRECATION")
    startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_PROJECTION)
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_PROJECTION) return
    if (resultCode != RESULT_OK || data == null) {
      CaptureRequests.finish(null, CaptureRequests.CODE_CANCELLED)
      finish()
      return
    }
    val fromNotification = source == SOURCE_NOTIFICATION
    CaptureRequests.attach { result, _ ->
      CaptureRequests.detach()
      if (fromNotification && result != null) IslandLinks.open(this, IslandLinks.SHARE)
      finish()
    }
    ContextCompat.startForegroundService(this, ScreenCaptureService.intent(this, resultCode, data, fromNotification))
  }

  override fun onDestroy() {
    CaptureRequests.detach()
    super.onDestroy()
  }
}
