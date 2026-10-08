package com.kevinroan.tesseract.island

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import java.util.Locale

object IslandNotification {
  const val CHANNEL_ID = "island"
  const val NOTIFICATION_ID = 4101
  const val CAPTURE_CHANNEL_ID = "island-capture"
  const val CAPTURE_NOTIFICATION_ID = 4102

  private const val REQUEST_OPEN = 1
  private const val REQUEST_STOP = 2
  private const val REQUEST_CAPTURE = 3

  data class Item(val id: String, val title: String, val project: String?, val state: String, val tokens: Long?, val isRun: Boolean)

  fun canPost(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }
    return NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Activity", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "Running agents and commands"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
    )
    manager.createNotificationChannel(
      NotificationChannel(CAPTURE_CHANNEL_ID, "Screen capture", NotificationManager.IMPORTANCE_LOW).apply {
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      }
    )
  }

  fun post(context: Context, state: Map<String, Any?>): Boolean {
    if (!canPost(context)) return false
    ensureChannels(context)
    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, build(context, state))
    return true
  }

  fun cancel(context: Context) {
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
  }

  private fun build(context: Context, state: Map<String, Any?>): android.app.Notification {
    val items = items(state)
    val running = items.filter { it.state == "running" }
    val lead = running.firstOrNull() ?: items.firstOrNull()
    val sandboxName = state["sandboxName"] as? String
    val usage = state["usage"] as? Map<*, *>
    val todayTokens = (usage?.get("todayTokens") as? Number)?.toLong()

    val title = lead?.takeIf { it.state == "running" }?.title ?: "Tesseract"
    val others = (running.size - 1).coerceAtLeast(0)
    val text = listOfNotNull(
      lead?.project ?: sandboxName,
      when {
        running.isEmpty() -> "Idle"
        others == 0 -> "Running"
        others == 1 -> "1 more running"
        else -> "$others more running"
      }
    ).joinToString(" · ")

    val bigText = items.take(3).joinToString("\n") { item ->
      val marker = if (item.state == "running") "●" else "○"
      listOfNotNull(marker, item.title, item.project?.let { "— $it" }).joinToString(" ")
    }.ifEmpty { text }

    val tokensLabel = todayTokens?.let { "${formatTokens(it)} tok" }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_island_status)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(bigText))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(
        PendingIntent.getActivity(
          context,
          REQUEST_OPEN,
          IslandLinks.intent(context, IslandLinks.OPEN),
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
      )

    if (tokensLabel != null) {
      builder.setSubText(tokensLabel)
      if (Build.VERSION.SDK_INT >= 36) builder.setShortCriticalText(tokensLabel)
    }
    if (Build.VERSION.SDK_INT >= 36) builder.setRequestPromotedOngoing(true)

    running.firstOrNull { it.isRun }?.let { run ->
      val stop = Intent(context, IslandActionReceiver::class.java)
        .setAction(IslandActionReceiver.ACTION_STOP)
        .putExtra(IslandActionReceiver.EXTRA_RUN_ID, run.id)
      builder.addAction(
        0,
        "Stop",
        PendingIntent.getBroadcast(context, REQUEST_STOP, stop, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      )
    }

    builder.addAction(
      0,
      "Capture",
      PendingIntent.getActivity(
        context,
        REQUEST_CAPTURE,
        CaptureActivity.intent(context, CaptureActivity.SOURCE_NOTIFICATION),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    )

    builder.addAction(
      0,
      "Open",
      PendingIntent.getActivity(
        context,
        REQUEST_OPEN,
        IslandLinks.intent(context, IslandLinks.OPEN),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
      )
    )

    return builder.build()
  }

  private fun items(state: Map<String, Any?>): List<Item> {
    val runs = (state["runs"] as? List<*>).orEmpty().mapNotNull { raw ->
      val run = raw as? Map<*, *> ?: return@mapNotNull null
      Item(
        id = run["id"]?.toString() ?: return@mapNotNull null,
        title = run["title"]?.toString() ?: "Run",
        project = run["project"]?.toString(),
        state = run["state"]?.toString() ?: "running",
        tokens = (run["tokens"] as? Number)?.toLong(),
        isRun = true
      )
    }
    val commands = (state["commands"] as? List<*>).orEmpty().mapNotNull { raw ->
      val command = raw as? Map<*, *> ?: return@mapNotNull null
      Item(
        id = command["id"]?.toString() ?: return@mapNotNull null,
        title = command["label"]?.toString() ?: "Command",
        project = command["project"]?.toString(),
        state = command["state"]?.toString() ?: "running",
        tokens = null,
        isRun = false
      )
    }
    return runs + commands
  }

  private fun formatTokens(value: Long): String = when {
    value >= 1_000_000 -> String.format(Locale.US, "%.1fM", value / 1_000_000.0)
    value >= 1_000 -> String.format(Locale.US, "%.1fk", value / 1_000.0)
    else -> value.toString()
  }
}
