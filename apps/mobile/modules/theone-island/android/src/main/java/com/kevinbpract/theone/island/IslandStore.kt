package com.kevinbpract.theone.island

import android.content.Context
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

object IslandStore {
  private const val PREFS = "island"
  private const val KEY_ACTIONS = "actions"
  private const val KEY_ACTIVITY_ID = "activityId"
  private const val INBOX_DIR = "island-inbox"
  private const val MANIFEST = "manifest.json"

  @Volatile var onAction: ((Map<String, Any?>) -> Unit)? = null
  @Volatile var onSharedItems: ((Int) -> Unit)? = null

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun dispatchAction(context: Context, action: String, runId: String?) {
    val payload = mutableMapOf<String, Any?>("action" to action)
    if (runId != null) payload["runId"] = runId
    val listener = onAction
    if (listener != null) {
      listener(payload)
      return
    }
    synchronized(this) {
      val queue = JSONArray(prefs(context).getString(KEY_ACTIONS, "[]"))
      queue.put(JSONObject(payload as Map<*, *>))
      prefs(context).edit().putString(KEY_ACTIONS, queue.toString()).apply()
    }
  }

  fun drainActions(context: Context): List<Map<String, Any?>> = synchronized(this) {
    val queue = JSONArray(prefs(context).getString(KEY_ACTIONS, "[]"))
    prefs(context).edit().remove(KEY_ACTIONS).apply()
    (0 until queue.length()).map { queue.getJSONObject(it).toMap() }
  }

  fun activityId(context: Context): String? = prefs(context).getString(KEY_ACTIVITY_ID, null)

  fun setActivityId(context: Context, id: String?) {
    prefs(context).edit().apply {
      if (id == null) remove(KEY_ACTIVITY_ID) else putString(KEY_ACTIVITY_ID, id)
    }.apply()
  }

  fun cacheDir(context: Context): File = File(context.cacheDir, "island").apply { mkdirs() }

  private fun inboxDir(context: Context): File = File(context.filesDir, INBOX_DIR).apply { mkdirs() }

  fun newInboxFile(context: Context, extension: String): File =
    File(inboxDir(context), "${UUID.randomUUID()}.$extension")

  fun addInboxItem(
    context: Context,
    kind: String,
    file: File?,
    text: String?,
    name: String,
    mimeType: String,
    sizeBytes: Long?
  ): Int = synchronized(this) {
    val manifest = readManifest(context)
    manifest.put(
      JSONObject().apply {
        put("id", UUID.randomUUID().toString())
        put("kind", kind)
        put("file", file?.name ?: JSONObject.NULL)
        put("text", text ?: JSONObject.NULL)
        put("name", name)
        put("mimeType", mimeType)
        put("sizeBytes", sizeBytes ?: JSONObject.NULL)
        put("createdAt", isoNow())
      }
    )
    writeManifest(context, manifest)
    manifest.length()
  }

  fun notifySharedItems(count: Int) {
    onSharedItems?.invoke(count)
  }

  fun takeInbox(context: Context): List<Map<String, Any?>> = synchronized(this) {
    val manifest = readManifest(context)
    val dir = inboxDir(context)
    val target = cacheDir(context)
    val items = (0 until manifest.length()).map { index ->
      val entry = manifest.getJSONObject(index)
      val fileName = entry.optString("file", "").takeIf { it.isNotEmpty() }
      val moved = fileName?.let { source ->
        val from = File(dir, source)
        val to = File(target, source)
        if (from.exists() && (from.renameTo(to) || from.copyTo(to, overwrite = true).exists())) {
          from.delete()
          to
        } else {
          null
        }
      }
      mapOf(
        "id" to entry.getString("id"),
        "kind" to entry.getString("kind"),
        "uri" to moved?.let { android.net.Uri.fromFile(it).toString() },
        "text" to entry.optString("text", "").takeIf { !entry.isNull("text") },
        "name" to entry.getString("name"),
        "mimeType" to entry.getString("mimeType"),
        "sizeBytes" to if (entry.isNull("sizeBytes")) null else entry.getLong("sizeBytes"),
        "createdAt" to entry.getString("createdAt")
      )
    }
    File(dir, MANIFEST).delete()
    dir.listFiles()?.forEach { it.delete() }
    items
  }

  private fun readManifest(context: Context): JSONArray {
    val file = File(inboxDir(context), MANIFEST)
    if (!file.exists()) return JSONArray()
    return runCatching { JSONArray(file.readText()) }.getOrDefault(JSONArray())
  }

  private fun writeManifest(context: Context, manifest: JSONArray) {
    File(inboxDir(context), MANIFEST).writeText(manifest.toString())
  }

  fun isoNow(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
      .apply { timeZone = TimeZone.getTimeZone("UTC") }
      .format(Date())

  private fun JSONObject.toMap(): Map<String, Any?> =
    keys().asSequence().associateWith { key -> if (isNull(key)) null else get(key) }
}
