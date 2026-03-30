#!/usr/bin/env node
/**
 * Serves `dist/` on Railway: binds 0.0.0.0:$PORT (Express 5 — no wildcard `*` route).
 */
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const indexHtml = path.join(dist, "index.html");

if (!fs.existsSync(indexHtml)) {
  console.error(`FATAL: ${indexHtml} missing — run "npm run build" before deploy.`);
  process.exit(1);
}

const port = Number.parseInt(process.env.PORT || "4173", 10);
const app = express();

app.disable("x-powered-by");
app.get("/health", (_req, res) => res.status(200).type("text/plain").send("ok"));
app.use(express.static(dist));
app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).end();
    return;
  }
  res.sendFile(indexHtml);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});
