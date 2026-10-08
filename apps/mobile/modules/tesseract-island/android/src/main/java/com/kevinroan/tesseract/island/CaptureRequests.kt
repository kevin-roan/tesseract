package com.kevinroan.tesseract.island

import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise

object CaptureRequests {
  const val CODE_CANCELLED = "cancelled"

  @Volatile private var promise: Promise? = null
  @Volatile private var onFinished: ((Map<String, Any?>?, String?) -> Unit)? = null
  private val main = Handler(Looper.getMainLooper())

  fun begin(promise: Promise) {
    this.promise?.reject(CODE_CANCELLED, "Replaced by a new capture", null)
    this.promise = promise
  }

  fun attach(listener: (Map<String, Any?>?, String?) -> Unit) {
    onFinished = listener
  }

  fun detach() {
    onFinished = null
  }

  fun finish(result: Map<String, Any?>?, error: String?) {
    val pending = promise
    val listener = onFinished
    promise = null
    main.post {
      if (pending != null) {
        if (result != null) pending.resolve(result) else pending.reject(error ?: CODE_CANCELLED, error ?: CODE_CANCELLED, null)
      }
      listener?.invoke(result, error)
    }
  }
}
