#!/usr/bin/env python3
"""Tiny static server that disables caching, so edits always show up on reload."""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    # Prefer an explicit CLI arg, then the PORT env var (set by the preview
    # harness when autoPort is on), then a sensible default.
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    else:
        port = int(os.environ.get("PORT", 4321))
    HTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
