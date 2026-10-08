# Tesseract sandbox

The user follows this sandbox from the Tesseract app on their phone and desktop.

When you produce a deliverable they will want on those devices (an APK/AAB, an installer, a zip,
a report, exported media), share it once the build or export has succeeded:

```bash
tesseract-controller share <file> --note "<one line: what it is and what changed>"
```

- Share final outputs only, not intermediate files, logs or build caches.
- The file must be inside /workspace; pass `--project <id>` if it is not under a project directory.
- It shows up in the app's inbox, ready to download or send to a device.
- `/send-file [latest|apk|aab|md|<path or name>] [-- note]` is the user's shortcut for this: follow the `send-file` skill.
