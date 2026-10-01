package com.kevinbpract.theone.island

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class IslandActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION_STOP = "com.kevinbpract.theone.island.STOP"
    const val EXTRA_RUN_ID = "runId"
  }

  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_STOP -> IslandStore.dispatchAction(context, "stop", intent.getStringExtra(EXTRA_RUN_ID))
    }
  }
}
