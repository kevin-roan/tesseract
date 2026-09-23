#!/usr/bin/env python3
"""Serves an `expo export --platform web` (output: static) directory like a static host.

/pair -> pair.html, /sandbox/projects/abc -> sandbox/projects/[id].html, unknown -> +not-found.html.
Usage: serve.py <root> [port] (binds 127.0.0.1).
"""
import functools
import http.server
import os
import re
import sys
import urllib.parse

DYNAMIC = re.compile(r"^\[.+\]$")


def resolve(root, url_path):
    path = urllib.parse.unquote(urllib.parse.urlsplit(url_path).path)
    parts = [part for part in path.split("/") if part and part not in (".", "..")]
    exact = os.path.join(root, *parts)
    if os.path.isfile(exact):
        return "/" + "/".join(parts)
    if os.path.isdir(exact) and os.path.isfile(os.path.join(exact, "index.html")):
        return "/" + "/".join(parts + ["index.html"])
    match = match_route(root, parts)
    if match:
        return match
    return "/+not-found.html"


def match_route(root, parts):
    directory = root
    resolved = []
    for index, part in enumerate(parts):
        last = index == len(parts) - 1
        entries = sorted(os.listdir(directory)) if os.path.isdir(directory) else []
        if last:
            for candidate in [f"{part}.html"] + [entry for entry in entries if entry.endswith(".html") and DYNAMIC.match(entry[:-5])]:
                if candidate in entries:
                    return "/" + "/".join(resolved + [candidate])
            return None
        if part in entries and os.path.isdir(os.path.join(directory, part)):
            chosen = part
        else:
            chosen = next((entry for entry in entries if DYNAMIC.match(entry) and os.path.isdir(os.path.join(directory, entry))), None)
            if chosen is None:
                return None
        resolved.append(chosen)
        directory = os.path.join(directory, chosen)
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, root, **kwargs):
        self.root = root
        super().__init__(*args, directory=root, **kwargs)

    def do_GET(self):
        query = urllib.parse.urlsplit(self.path).query
        self.path = resolve(self.root, self.path) + (f"?{query}" if query else "")
        super().do_GET()

    def log_message(self, format, *args):
        sys.stderr.write("serve: " + (format % args) + "\n")


def main():
    root = os.path.abspath(sys.argv[1])
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8081
    handler = functools.partial(Handler, root=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
