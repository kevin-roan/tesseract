package com.kevinroan.tesseract.tailnet

import tailnet.Tailnet

object TailnetLibrary {
  const val linked = true

  fun start(stateDir: String, controlUrl: String, authKey: String, hostname: String) =
    Tailnet.start(stateDir, controlUrl, authKey, hostname)

  fun stop() = Tailnet.stop()

  fun logout() = Tailnet.logout()

  fun statusJson(): String = Tailnet.statusJSON()

  fun forward(host: String, port: Long): Long = Tailnet.forward(host, port)

  fun closeForward(host: String, port: Long) = Tailnet.closeForward(host, port)
}
