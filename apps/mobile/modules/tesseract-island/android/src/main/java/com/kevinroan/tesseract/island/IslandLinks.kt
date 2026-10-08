package com.kevinroan.tesseract.island

import android.content.Context
import android.content.Intent
import android.net.Uri

object IslandLinks {
  const val SCHEME = "tesseract"
  const val OPEN = "$SCHEME://island/open"
  const val CAPTURE = "$SCHEME://island/capture"
  const val SHARE = "$SCHEME://island/share"

  fun intent(context: Context, link: String): Intent =
    Intent(Intent.ACTION_VIEW, Uri.parse(link))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

  fun open(context: Context, link: String) {
    context.startActivity(intent(context, link))
  }
}
