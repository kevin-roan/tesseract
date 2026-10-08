package com.kevinroan.tesseract.island

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.File

class ScreenCaptureService : Service() {
  companion object {
    private const val EXTRA_RESULT_CODE = "resultCode"
    private const val EXTRA_RESULT_DATA = "resultData"
    private const val EXTRA_TO_INBOX = "toInbox"
    private const val FIRST_FRAME_DELAY_MS = 350L
    private const val TIMEOUT_MS = 8000L

    fun intent(context: Context, resultCode: Int, data: Intent, toInbox: Boolean): Intent =
      Intent(context, ScreenCaptureService::class.java)
        .putExtra(EXTRA_RESULT_CODE, resultCode)
        .putExtra(EXTRA_RESULT_DATA, data)
        .putExtra(EXTRA_TO_INBOX, toInbox)
  }

  private var projection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var reader: ImageReader? = null
  private var thread: HandlerThread? = null
  private var handler: Handler? = null
  private var done = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, Int.MIN_VALUE) ?: Int.MIN_VALUE
    @Suppress("DEPRECATION")
    val data = intent?.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
    val toInbox = intent?.getBooleanExtra(EXTRA_TO_INBOX, false) ?: false
    if (resultCode == Int.MIN_VALUE || data == null) {
      fail(CaptureRequests.CODE_CANCELLED)
      return START_NOT_STICKY
    }

    IslandNotification.ensureChannels(this)
    val notification = NotificationCompat.Builder(this, IslandNotification.CAPTURE_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_island_status)
      .setContentTitle("Capturing screen")
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0
    ServiceCompat.startForeground(this, IslandNotification.CAPTURE_NOTIFICATION_ID, notification, type)

    val manager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val projection = runCatching { manager.getMediaProjection(resultCode, data) }.getOrNull()
    if (projection == null) {
      fail("Could not obtain a media projection")
      return START_NOT_STICKY
    }
    this.projection = projection

    val worker = HandlerThread("island-capture").apply { start() }
    thread = worker
    val handler = Handler(worker.looper)
    this.handler = handler

    projection.registerCallback(
      object : MediaProjection.Callback() {
        override fun onStop() {
          if (!done) fail(CaptureRequests.CODE_CANCELLED)
        }
      },
      handler
    )

    handler.postDelayed({ capture(projection, handler, toInbox) }, FIRST_FRAME_DELAY_MS)
    handler.postDelayed({ if (!done) fail("Timed out waiting for a frame") }, TIMEOUT_MS)
    return START_NOT_STICKY
  }

  private fun capture(projection: MediaProjection, handler: Handler, toInbox: Boolean) {
    val (width, height, dpi) = screenSize()
    val reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
    this.reader = reader
    reader.setOnImageAvailableListener(
      { source ->
        if (done) return@setOnImageAvailableListener
        val image = source.acquireLatestImage() ?: return@setOnImageAvailableListener
        try {
          val bitmap = ImageFiles.fromImage(image)
          done = true
          val file = if (toInbox) IslandStore.newInboxFile(this, "png") else ImageFiles.newPng(this)
          val result = ImageFiles.writePng(bitmap, file)
          bitmap.recycle()
          if (toInbox) publish(file)
          CaptureRequests.finish(result, null)
        } catch (error: Throwable) {
          done = true
          CaptureRequests.finish(null, error.message ?: "Capture failed")
        } finally {
          image.close()
          release()
          stopSelf()
        }
      },
      handler
    )
    virtualDisplay = runCatching {
      projection.createVirtualDisplay(
        "island-capture",
        width,
        height,
        dpi,
        DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
        reader.surface,
        null,
        handler
      )
    }.getOrElse {
      fail(it.message ?: "Could not create a virtual display")
      null
    }
  }

  private fun publish(file: File) {
    val count = IslandStore.addInboxItem(
      this,
      kind = "image",
      file = file,
      text = null,
      name = file.name,
      mimeType = "image/png",
      sizeBytes = file.length()
    )
    IslandStore.notifySharedItems(count)
  }

  private fun screenSize(): Triple<Int, Int, Int> {
    val windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val density = resources.displayMetrics.densityDpi
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val bounds = windowManager.maximumWindowMetrics.bounds
      Triple(bounds.width(), bounds.height(), density)
    } else {
      val metrics = DisplayMetrics()
      @Suppress("DEPRECATION")
      windowManager.defaultDisplay.getRealMetrics(metrics)
      Triple(metrics.widthPixels, metrics.heightPixels, metrics.densityDpi)
    }
  }

  private fun fail(message: String) {
    if (done) return
    done = true
    CaptureRequests.finish(null, message)
    release()
    stopSelf()
  }

  private fun release() {
    virtualDisplay?.release()
    virtualDisplay = null
    reader?.close()
    reader = null
    projection?.stop()
    projection = null
    thread?.quitSafely()
    thread = null
    handler = null
  }

  override fun onDestroy() {
    if (!done) {
      done = true
      CaptureRequests.finish(null, CaptureRequests.CODE_CANCELLED)
    }
    release()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }
}
