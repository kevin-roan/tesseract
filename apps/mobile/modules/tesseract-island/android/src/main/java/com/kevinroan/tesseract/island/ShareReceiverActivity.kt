package com.kevinroan.tesseract.island

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import java.io.File
import kotlin.concurrent.thread

class ShareReceiverActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val incoming = intent
    thread(name = "island-share") {
      val count = runCatching { ingest(incoming) }.getOrDefault(0)
      runOnUiThread {
        if (count > 0) {
          IslandStore.notifySharedItems(count)
          IslandLinks.open(this, IslandLinks.SHARE)
        }
        finish()
      }
    }
  }

  private fun ingest(intent: Intent): Int {
    val streams = when (intent.action) {
      Intent.ACTION_SEND -> listOfNotNull(intent.parcelable<Uri>(Intent.EXTRA_STREAM))
      Intent.ACTION_SEND_MULTIPLE -> intent.parcelableList<Uri>(Intent.EXTRA_STREAM)
      else -> emptyList()
    }
    var total = 0
    streams.forEach { uri -> total = copyStream(uri, intent.type) }
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    if (streams.isEmpty() && !text.isNullOrBlank()) {
      val isUrl = text.trim().let { it.startsWith("http://") || it.startsWith("https://") }
      total = IslandStore.addInboxItem(
        this,
        kind = if (isUrl) "url" else "text",
        file = null,
        text = text,
        name = intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: if (isUrl) "Link" else "Text",
        mimeType = "text/plain",
        sizeBytes = text.toByteArray().size.toLong()
      )
    }
    return total
  }

  private fun copyStream(uri: Uri, intentType: String?): Int {
    val mimeType = contentResolver.getType(uri) ?: intentType?.takeIf { !it.endsWith("/*") } ?: "application/octet-stream"
    var name: String? = null
    var size: Long? = null
    contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
      if (cursor.moveToFirst()) {
        val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
        if (nameIndex >= 0) name = cursor.getString(nameIndex)
        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
      }
    }
    val extension = name?.substringAfterLast('.', "")?.takeIf { it.isNotEmpty() }
      ?: MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)
      ?: "bin"
    val target: File = IslandStore.newInboxFile(this, extension)
    contentResolver.openInputStream(uri)?.use { input -> target.outputStream().use { input.copyTo(it) } }
      ?: return 0
    return IslandStore.addInboxItem(
      this,
      kind = if (mimeType.startsWith("image/")) "image" else "file",
      file = target,
      text = null,
      name = name ?: target.name,
      mimeType = mimeType,
      sizeBytes = size ?: target.length()
    )
  }

  @Suppress("DEPRECATION")
  private inline fun <reified T : android.os.Parcelable> Intent.parcelable(key: String): T? =
    if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableExtra(key, T::class.java) else getParcelableExtra(key) as? T

  @Suppress("DEPRECATION")
  private inline fun <reified T : android.os.Parcelable> Intent.parcelableList(key: String): List<T> =
    (if (android.os.Build.VERSION.SDK_INT >= 33) getParcelableArrayListExtra(key, T::class.java) else getParcelableArrayListExtra<T>(key))
      ?.filterNotNull().orEmpty()
}
