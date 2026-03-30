#!/usr/bin/env node
/**
 * Serves `dist/` on Railway's PORT (or 4173 locally). Avoids npm/sh quirks with ${PORT} in package.json.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = process.env.PORT || "4173";
const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const main = path.join(cwd, "node_modules/serve/build/main.js");

const child = spawn(
  process.execPath,
  [main, "-s", "dist", "-l", `tcp://0.0.0.0:${port}`],
  { stdio: "inherit", cwd, env: process.env }
);

child.on("exit", (code) => process.exit(code ?? 0));
