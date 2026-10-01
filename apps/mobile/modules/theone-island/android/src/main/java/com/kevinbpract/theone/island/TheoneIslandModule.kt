package com.kevinbpract.theone.island

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class TheoneIslandModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TheoneIsland")

    Events("onIslandAction", "onPushToken", "onSharedItems")

    OnCreate {
      IslandStore.onAction = { payload -> if (appContext.hasActiveReactInstance) sendEvent("onIslandAction", payload) }
      IslandStore.onSharedItems = { count -> if (appContext.hasActiveReactInstance) sendEvent("onSharedItems", mapOf("count" to count)) }
    }

    OnDestroy {
      IslandStore.onAction = null
      IslandStore.onSharedItems = null
    }

    Function("isLiveActivitySupported") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.O }

    AsyncFunction("startActivity") { state: Map<String, Any?> -> postActivity(state) }

    AsyncFunction("updateActivity") { state: Map<String, Any?> ->
      postActivity(state)
      Unit
    }

    AsyncFunction("endActivity") {
      IslandNotification.cancel(context)
      IslandStore.setActivityId(context, null)
    }

    Function("currentActivityId") { IslandStore.activityId(context) }

    AsyncFunction("drainActions") { IslandStore.drainActions(context) }

    Function("canCaptureScreen") { source: String ->
      when (source) {
        "screen" -> Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        else -> true
      }
    }

    AsyncFunction("captureScreen") { source: String, promise: Promise ->
      when (source) {
        "screen" -> captureWholeScreen(promise)
        else -> captureAppWindow(promise)
      }
    }

    AsyncFunction("cropImage") { uri: String, rect: Map<String, Any?> ->
      val source = ImageFiles.decode(context, uri)
      val cropped = ImageFiles.crop(
        source,
        rect.int("x"),
        rect.int("y"),
        rect.int("width"),
        rect.int("height")
      )
      val result = ImageFiles.writePng(cropped, ImageFiles.newPng(context))
      if (cropped !== source) cropped.recycle()
      source.recycle()
      result
    }

    AsyncFunction("recognizeText") { uri: String, promise: Promise ->
      val image = InputImage.fromFilePath(context, android.net.Uri.parse(uri))
      TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        .process(image)
        .addOnSuccessListener { result ->
          val blocks = result.textBlocks
            .sortedWith(compareBy({ it.boundingBox?.top ?: 0 }, { it.boundingBox?.left ?: 0 }))
            .map { block ->
              val box = block.boundingBox
              mapOf(
                "text" to block.text,
                "x" to (box?.left ?: 0),
                "y" to (box?.top ?: 0),
                "width" to (box?.width() ?: 0),
                "height" to (box?.height() ?: 0)
              )
            }
          val lines = result.textBlocks
            .flatMap { it.lines }
            .sortedWith(compareBy({ it.boundingBox?.top ?: 0 }, { it.boundingBox?.left ?: 0 }))
            .joinToString("\n") { it.text }
          promise.resolve(mapOf("text" to lines, "blocks" to blocks))
        }
        .addOnFailureListener { error -> promise.reject("E_RECOGNIZE", error.message, error) }
    }

    AsyncFunction("takeSharedItems") { IslandStore.takeInbox(context) }
  }

  private fun postActivity(state: Map<String, Any?>): String? {
    if (!IslandNotification.post(context, state)) return null
    val id = IslandNotification.NOTIFICATION_ID.toString()
    IslandStore.setActivityId(context, id)
    return id
  }

  private fun captureAppWindow(promise: Promise) {
    val activity = appContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No foreground activity to capture", null)
      return
    }
    Handler(Looper.getMainLooper()).post {
      ImageFiles.snapshotWindow(activity) { outcome ->
        outcome.fold(
          onSuccess = { bitmap ->
            Thread {
              try {
                val result = ImageFiles.writePng(bitmap, ImageFiles.newPng(context))
                bitmap.recycle()
                promise.resolve(result)
              } catch (error: Throwable) {
                promise.reject("E_CAPTURE", error.message, error)
              }
            }.start()
          },
          onFailure = { error -> promise.reject("E_CAPTURE", error.message, error) }
        )
      }
    }
  }

  private fun captureWholeScreen(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
      promise.reject("E_UNSUPPORTED", "Screen capture needs Android 10 or newer", null)
      return
    }
    CaptureRequests.begin(promise)
    val launcher = appContext.currentActivity ?: context
    launcher.startActivity(CaptureActivity.intent(context, CaptureActivity.SOURCE_JS))
  }

  private fun Map<String, Any?>.int(key: String): Int = (this[key] as? Number)?.toInt() ?: 0
}
