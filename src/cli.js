#!/usr/bin/env node
"use strict";

const path = require("path");
const { audit } = require("./index");

const args = process.argv.slice(2);
let dir = ".";
let format = "text";
let exitCode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--format" && args[i + 1]) {
    format = args[++i];
  } else if (args[i] === "--json") {
    format = "json";
  } else if (args[i] === "--markdown" || args[i] === "--md") {
    format = "markdown";
  } else if (args[i] === "--exit-code") {
    exitCode = true;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`ai-audit — audit AI projects for security, license, privacy & cost issues

Usage: ai-audit [dir] [options]

Options:
  --format text|json|markdown   Output format (default: text)
  --json                        Shorthand for --format json
  --md, --markdown              Shorthand for --format markdown
  --exit-code                   Exit with code 1 if grade is below B
  -h, --help                    Show this help`);
    process.exit(0);
  } else if (!args[i].startsWith("-")) {
    dir = args[i];
  }
}

const target = path.resolve(dir);
const result = audit(target, { format });

if (format === "json") {
  console.log(result.report);
} else {
  console.log(result.report);
  console.log(`\nGrade: ${result.grade} (${result.score}/100)`);
}

if (exitCode && result.score < 75) {
  process.exit(1);
}
