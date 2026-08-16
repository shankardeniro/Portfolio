#!/usr/bin/env node
// Tiny static server that disables caching, so edits always show up on reload.
// Mirrors serve.py. Port: CLI arg > PORT env var > 4321.
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.argv[2] || process.env.PORT || 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
};

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    // mirror the production rewrite: case-study deep links serve the app shell
    if (/^\/case-study\/[a-z0-9-]+\/?$/.test(urlPath)) urlPath = "/index.html";

    // Resolve within root, block path traversal.
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }

    fs.stat(filePath, (err, stat) => {
      let target = filePath;
      if (!err && stat.isDirectory()) target = path.join(filePath, "index.html");
      fs.readFile(target, (e, data) => {
        const noCache = {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        };
        if (e) {
          res.writeHead(404, { "Content-Type": "text/plain", ...noCache });
          return res.end("Not found");
        }
        const type = TYPES[path.extname(target).toLowerCase()] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": type, ...noCache });
        res.end(data);
      });
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Serving ${root} at http://127.0.0.1:${port}`);
  });
