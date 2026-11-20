package com.kevinroan.tesseract.tailnet

object TailnetLibrary {
  const val linked = false

  private const val MISSING =
    "This build has no tailnet library. Run native/tailnet/scripts/build-android.sh and rebuild the app."

  fun start(stateDir: String, controlUrl: String, authKey: String, hostname: String): Unit =
    throw UnsupportedOperationException(MISSING)

  fun stop() = Unit

  fun logout() = Unit

  fun statusJson(): String = ""

  fun forward(host: String, port: Long): Long = throw UnsupportedOperationException(MISSING)

  fun closeForward(host: String, port: Long) = Unit
}
