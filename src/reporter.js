"use strict";

const ICONS = {
  security: "🛡️",
  license: "📜",
  privacy: "🔒",
  cost: "💰",
};

function severityIcon(sev) {
  if (sev === "high") return "❌";
  if (sev === "medium") return "⚠️";
  return "ℹ️";
}

/** Format audit results as a GitHub PR comment (Markdown). */
function formatMarkdown(scoreResult, allFindings, filesScanned) {
  const lines = [];
  const { score, grade, modules } = scoreResult;

  lines.push(`## 🤖 AI Project Audit — Grade: **${grade}** (${score}/100)`);
  lines.push("");
  lines.push(`> Scanned ${filesScanned} files | [ai-audit](https://github.com/TimurRakhmatullin86/ai-audit)`);
  lines.push("");

  for (const [mod, icon] of Object.entries(ICONS)) {
    const m = modules[mod];
    if (!m) continue;
    const findings = allFindings[mod] || [];
    lines.push(`### ${icon} ${capitalize(mod)} (${m.score}/${m.maxPoints})`);

    if (findings.length === 0) {
      lines.push("✅ No issues found");
    } else {
      for (const f of findings.slice(0, 10)) {
        const sIcon = severityIcon(f.severity);
        const loc = f.file && f.line ? `\`${f.file}:${f.line}\`` : "";
        const msg = f.message || f.value || f.model || "";
        lines.push(`${sIcon} ${loc} — ${msg}`);
      }
      if (findings.length > 10) {
        lines.push(`_...and ${findings.length - 10} more_`);
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push(`**Badge for README:**`);
  lines.push("```markdown");
  lines.push(
    `![AI Audit: ${grade}](https://img.shields.io/badge/AI_Audit-${encodeURIComponent(grade)}-${scoreResult.color})`
  );
  lines.push("```");

  return lines.join("\n");
}

/** Format as plain text for CLI output. */
function formatText(scoreResult, allFindings, filesScanned) {
  const lines = [];
  const { score, grade, modules } = scoreResult;

  lines.push(`AI Project Audit — Grade: ${grade} (${score}/100)`);
  lines.push(`Scanned ${filesScanned} files`);
  lines.push("");

  for (const [mod, icon] of Object.entries(ICONS)) {
    const m = modules[mod];
    if (!m) continue;
    const findings = allFindings[mod] || [];
    lines.push(`${icon} ${capitalize(mod)}: ${m.score}/${m.maxPoints}`);

    for (const f of findings) {
      const sev = (f.severity || "medium").toUpperCase();
      const loc = f.file && f.line ? `  ${f.file}:${f.line}` : " ";
      const msg = f.message || f.value || f.model || "";
      lines.push(`  [${sev}]${loc} — ${msg}`);
    }
    if (findings.length === 0) {
      lines.push("  OK");
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** Format as JSON for machine consumption. */
function formatJson(scoreResult, allFindings, filesScanned) {
  return JSON.stringify(
    { filesScanned, ...scoreResult, findings: allFindings },
    null,
    2
  );
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = { formatMarkdown, formatText, formatJson };
