"use strict";

const { collectFiles } = require("./scanner");
const security = require("./modules/security");
const license = require("./modules/license");
const privacy = require("./modules/privacy");
const cost = require("./modules/cost");
const { computeScore } = require("./scorer");
const { formatMarkdown, formatText, formatJson } = require("./reporter");

/** Run full audit on a directory. Returns { score, grade, findings, report }. */
function audit(dir, options = {}) {
  const files = collectFiles(dir, options.maxFiles || 5000);
  const fileData = files.map((f) => ({ path: f.path, content: f.content }));

  const securityResults = security.scanFiles(fileData);
  const licenseResults = license.scanFiles(fileData);
  const privacyResults = privacy.scanFiles(fileData);
  const costResults = cost.scanFiles(fileData);

  const licenseFindings = [];
  for (const r of licenseResults) {
    for (const m of r.models) {
      licenseFindings.push({
        file: r.file,
        line: m.line,
        severity: m.license?.risk || "low",
        message: m.license
          ? `${m.model} — ${m.license.license}${m.license.restrictions.length ? ": " + m.license.restrictions[0] : ""}`
          : `${m.model} — unknown model license`,
        model: m.model,
      });
    }
  }

  const privacyFindings = [];
  for (const r of privacyResults) {
    for (const f of r.findings) {
      privacyFindings.push({
        file: r.file,
        line: f.line,
        severity: f.severity,
        message: `${f.type}: ${f.value}`,
        value: f.value,
      });
    }
  }

  const costFindings = [];
  for (const r of costResults) {
    for (const f of r.findings) {
      costFindings.push({
        file: r.file,
        line: f.line,
        severity: f.severity,
        message: f.message,
        rule: f.rule,
        suggestion: f.suggestion,
      });
    }
  }

  const securityFindings = [];
  for (const r of securityResults) {
    for (const f of r.findings) {
      securityFindings.push({
        file: r.file,
        line: f.line,
        severity: f.severity,
        message: f.message,
        rule: f.rule,
      });
    }
  }

  const allFindings = {
    security: securityFindings,
    license: licenseFindings,
    privacy: privacyFindings,
    cost: costFindings,
  };

  const scoreResult = computeScore(allFindings);
  const format = options.format || "text";

  let report;
  if (format === "markdown") {
    report = formatMarkdown(scoreResult, allFindings, files.length);
  } else if (format === "json") {
    report = formatJson(scoreResult, allFindings, files.length);
  } else {
    report = formatText(scoreResult, allFindings, files.length);
  }

  return {
    filesScanned: files.length,
    score: scoreResult.score,
    grade: scoreResult.grade,
    color: scoreResult.color,
    modules: scoreResult.modules,
    findings: allFindings,
    report,
  };
}

module.exports = { audit };
