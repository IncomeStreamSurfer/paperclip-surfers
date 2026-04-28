#!/usr/bin/env node
/**
 * bump-version.mjs
 *
 * Auto-increments the patch segment of the version in server/package.json and
 * ui/package.json. Called automatically via predev / prebuild hooks so every
 * dev restart or production build gets a fresh version number.
 *
 * Usage (automatic):  pnpm dev | pnpm build
 * Usage (manual):     node scripts/bump-version.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function bumpPatch(pkgPath) {
  const raw = readFileSync(pkgPath, "utf-8");
  const pkg = JSON.parse(raw);
  const parts = (pkg.version ?? "0.0.0").split(".");
  if (parts.length < 3) parts.push(...Array(3 - parts.length).fill("0"));
  parts[2] = String(Number(parts[2]) + 1);
  pkg.version = parts.join(".");
  // Preserve original indentation (2 spaces) and trailing newline
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  return pkg.version;
}

const targets = [
  resolve(root, "server/package.json"),
  resolve(root, "ui/package.json"),
];

let newVersion;
for (const p of targets) {
  newVersion = bumpPatch(p);
}

console.log(`[bump-version] \x1b[32mv${newVersion}\x1b[0m`);
