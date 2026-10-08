package com.kevinroan.tesseract.island

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.media.Image
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

object ImageFiles {
  fun newPng(context: Context): File = File(IslandStore.cacheDir(context), "${UUID.randomUUID()}.png")

  fun writePng(bitmap: Bitmap, file: File): Map<String, Any?> {
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    return mapOf(
      "uri" to Uri.fromFile(file).toString(),
      "width" to bitmap.width,
      "height" to bitmap.height
    )
  }

  fun decode(context: Context, uri: String): Bitmap {
    val parsed = Uri.parse(uri)
    val bitmap = if (parsed.scheme == null || parsed.scheme == "file") {
      BitmapFactory.decodeFile(parsed.path ?: uri)
    } else {
      context.contentResolver.openInputStream(parsed)?.use { BitmapFactory.decodeStream(it) }
    }
    return bitmap ?: throw IllegalArgumentException("Could not decode image at $uri")
  }

  fun crop(source: Bitmap, x: Int, y: Int, width: Int, height: Int): Bitmap {
    val left = x.coerceIn(0, source.width - 1)
    val top = y.coerceIn(0, source.height - 1)
    val w = width.coerceIn(1, source.width - left)
    val h = height.coerceIn(1, source.height - top)
    return Bitmap.createBitmap(source, left, top, w, h)
  }

  fun fromImage(image: Image): Bitmap {
    val plane = image.planes[0]
    val pixelStride = plane.pixelStride
    val rowPadding = plane.rowStride - pixelStride * image.width
    val padded = Bitmap.createBitmap(image.width + rowPadding / pixelStride, image.height, Bitmap.Config.ARGB_8888)
    padded.copyPixelsFromBuffer(plane.buffer)
    if (rowPadding == 0) return padded
    val cropped = Bitmap.createBitmap(padded, 0, 0, image.width, image.height)
    padded.recycle()
    return cropped
  }

  fun snapshotWindow(activity: Activity, onResult: (Result<Bitmap>) -> Unit) {
    val view = activity.window.decorView
    if (view.width == 0 || view.height == 0) {
      onResult(Result.failure(IllegalStateException("Window has no size yet")))
      return
    }
    val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      PixelCopy.request(
        activity.window,
        bitmap,
        { status ->
          if (status == PixelCopy.SUCCESS) {
            onResult(Result.success(bitmap))
          } else {
            onResult(Result.failure(IllegalStateException("PixelCopy failed with status $status")))
          }
        },
        Handler(Looper.getMainLooper())
      )
    } else {
      view.draw(Canvas(bitmap))
      onResult(Result.success(bitmap))
    }
  }
}
