package com.kevinroan.tesseract.tailnet

import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class StartOptions : Record {
  @Field
  val controlUrl: String = ""

  @Field
  val authKey: String? = null

  @Field
  val hostname: String = ""
}

class TesseractTailnetModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val worker: ExecutorService = Executors.newCachedThreadPool()
  private val poller: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
  private var polling: ScheduledFuture<*>? = null
  private val lock = Any()
  private var started = false
  private var foreground = true
  private var lastStatus: String? = null

  override fun definition() = ModuleDefinition {
    Name("TesseractTailnet")

    Events(STATUS_EVENT)

    OnActivityEntersForeground {
      synchronized(lock) { foreground = true }
      updatePolling()
    }

    OnActivityEntersBackground {
      synchronized(lock) { foreground = false }
      updatePolling()
    }

    OnDestroy {
      synchronized(lock) { started = false }
      updatePolling()
      poller.shutdownNow()
      worker.shutdown()
    }

    Function("isLinked") { TailnetLibrary.linked }

    AsyncFunction("start") { options: StartOptions, promise: Promise ->
      val stateDir = stateDirectory()
      run(promise) {
        TailnetLibrary.start(stateDir.absolutePath, options.controlUrl, options.authKey ?: "", options.hostname)
        synchronized(lock) { started = true }
        updatePolling()
        emitStatus()
        null
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      run(promise) {
        stopPolling()
        TailnetLibrary.stop()
        emitStatus()
        null
      }
    }

    AsyncFunction("logout") { promise: Promise ->
      run(promise) {
        stopPolling()
        TailnetLibrary.logout()
        emitStatus()
        null
      }
    }

    AsyncFunction("status") { promise: Promise ->
      run(promise) { TailnetLibrary.statusJson() }
    }

    AsyncFunction("forward") { host: String, port: Int, promise: Promise ->
      run(promise) { TailnetLibrary.forward(host, port.toLong()).toInt() }
    }

    AsyncFunction("closeForward") { host: String, port: Int, promise: Promise ->
      run(promise) {
        TailnetLibrary.closeForward(host, port.toLong())
        null
      }
    }
  }

  private fun stateDirectory(): File = File(context.noBackupFilesDir, STATE_DIR).apply { mkdirs() }

  private fun run(promise: Promise, block: () -> Any?) {
    worker.execute {
      try {
        promise.resolve(block())
      } catch (error: Exception) {
        promise.reject(ERROR_CODE, error.message ?: error.toString(), error)
      }
    }
  }

  private fun stopPolling() {
    synchronized(lock) { started = false }
    updatePolling()
  }

  private fun updatePolling() {
    synchronized(lock) {
      val shouldPoll = started && foreground
      if (shouldPoll && polling == null) {
        polling = poller.scheduleWithFixedDelay({ emitStatus() }, POLL_MS, POLL_MS, TimeUnit.MILLISECONDS)
      } else if (!shouldPoll) {
        polling?.cancel(false)
        polling = null
      }
    }
  }

  private fun emitStatus() {
    val json = try {
      TailnetLibrary.statusJson()
    } catch (error: Exception) {
      return
    }
    synchronized(lock) {
      if (json.isEmpty() || json == lastStatus) return
      lastStatus = json
    }
    if (appContext.hasActiveReactInstance) sendEvent(STATUS_EVENT, mapOf("json" to json))
  }

  private companion object {
    const val STATUS_EVENT = "status"
    const val STATE_DIR = "tailnet"
    const val ERROR_CODE = "ERR_TAILNET"
    const val POLL_MS = 1000L
  }
}
