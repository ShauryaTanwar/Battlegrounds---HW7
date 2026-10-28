import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateArmy } from "./generation.js";
import { offlineArmy } from "../src/game/offline.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const production = process.argv.includes("--production");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 3000);
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({ root, server: { middlewareMode: true }, appType: "spa" });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
  ".woff2": "font/woff2",
};
let generationActive = 0;

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

async function body(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 10000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request must contain valid JSON.");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (url.pathname === "/api/status" && req.method === "GET")
    return json(res, 200, {
      aiAvailable: Boolean(process.env.OPENAI_API_KEY?.trim()),
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      version: "1.0.0",
    });
  if (url.pathname === "/api/generate" && req.method === "POST") {
    const origin = req.headers.origin;
    if (
      origin &&
      origin !== `http://${req.headers.host}` &&
      origin !== `https://${req.headers.host}`
    )
      return json(res, 403, {
        error: "Cross-origin requests are not allowed.",
      });
    if (!String(req.headers["content-type"]).startsWith("application/json"))
      return json(res, 415, { error: "Use application/json." });
    if (generationActive >= 2)
      return json(res, 429, {
        error: "Two armies are already generating. Try again shortly.",
      });
    generationActive++;
    try {
      const input = await body(req);
      if (
        typeof input.prompt !== "string" ||
        input.prompt.trim().length < 3 ||
        input.prompt.length > 1600
      )
        throw new Error(
          "Use an army description between 3 and 1,600 characters.",
        );
      const result =
        input.mode === "offline"
          ? offlineArmy(input.prompt)
          : await generateArmy(input.prompt);
      return json(res, 200, result);
    } catch (error) {
      const message =
        error.name === "TimeoutError"
          ? "Generation timed out. Retry or choose offline mode."
          : error.message;
      return json(res, 400, {
        error: message || "Could not generate an army. Please retry.",
      });
    } finally {
      generationActive--;
    }
  }
  if (url.pathname.startsWith("/api/"))
    return json(res, 404, { error: "API route not found." });
  if (vite)
    return vite.middlewares(req, res, () =>
      json(res, 404, { error: "Not found." }),
    );
  if (req.method !== "GET" && req.method !== "HEAD")
    return json(res, 405, { error: "Method not allowed." });
  try {
    const dist = path.join(root, "dist");
    const relative = decodeURIComponent(url.pathname).replace(/^[/\\]+/, "");
    if (relative.split(/[/\\]/).some((part) => part.startsWith(".")))
      return json(res, 404, { error: "Not found." });
    let filename = path.resolve(dist, relative || "index.html");
    if (!filename.startsWith(dist + path.sep) && filename !== dist)
      return json(res, 403, { error: "Forbidden." });
    let data;
    try {
      data = await fs.readFile(filename);
    } catch {
      if (path.extname(relative))
        return json(res, 404, { error: "Not found." });
      filename = path.join(dist, "index.html");
      data = await fs.readFile(filename);
    }
    res.writeHead(200, {
      "Content-Type":
        mime[path.extname(filename)] || "application/octet-stream",
      "Cache-Control": filename.includes(`${path.sep}assets${path.sep}`)
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    json(res, 500, {
      error: "Build missing or unreadable. Run npm run build before npm start.",
    });
  }
});
server.listen(port, host, () =>
  console.log(
    `\n  BATTLEGROUNDS\n  Local: http://${host}:${server.address().port}\n  Generation: ${process.env.OPENAI_API_KEY?.trim() ? "OpenAI configured" : "offline (no API key)"}\n`,
  ),
);
server.on("error", (error) => {
  console.error(`Server failed: ${error.message}`);
  process.exitCode = 1;
});
async function shutdown() {
  await vite?.close();
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
