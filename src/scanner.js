"use strict";

const fs = require("fs");
const path = require("path");

const EXTENSIONS = new Set([
  ".py", ".ts", ".tsx", ".js", ".jsx", ".java",
  ".go", ".rs", ".kt", ".kts", ".yaml", ".yml",
  ".json", ".toml", ".cfg", ".ini", ".env",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "__pycache__", ".venv", "venv",
  "dist", "build", "target", ".next", ".nuxt",
  "vendor", ".tox", "coverage", ".mypy_cache",
]);

/** Recursively collect scannable files from a directory. */
function collectFiles(dir, maxFiles = 5000) {
  const results = [];
  walk(dir, results, maxFiles);
  return results;
}

function walk(dir, results, maxFiles) {
  if (results.length >= maxFiles) return;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxFiles) return;

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(path.join(dir, entry.name), results, maxFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!EXTENSIONS.has(ext)) continue;

      const filePath = path.join(dir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        if (stat.size > 512 * 1024) continue;
        const content = fs.readFileSync(filePath, "utf-8");
        results.push({ path: filePath, content });
      } catch {
        continue;
      }
    }
  }
}

module.exports = { collectFiles, EXTENSIONS };
