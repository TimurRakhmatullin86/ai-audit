"use strict";

const INJECTION_PATTERNS = [
  {
    id: "prompt-concat",
    regex: /(?:prompt|system_message|user_message)\s*\+?=\s*(?:f["']|["']\s*\+|`\$\{)/gi,
    severity: "high",
    message: "User input concatenated into prompt — prompt injection risk",
  },
  {
    id: "eval-template",
    regex: /\beval\s*\(\s*(?:f["']|["']\s*\+|`\$\{)/gi,
    severity: "high",
    message: "eval() with template/concatenation — code injection risk",
  },
  {
    id: "exec-user-input",
    regex: /(?:exec|subprocess\.run|os\.system|child_process|execSync)\s*\(/gi,
    severity: "medium",
    message: "Shell execution found — verify no user input reaches command",
  },
  {
    id: "hardcoded-key",
    regex: /(?:api_key|apikey|api_secret|secret_key)\s*=\s*["'][a-zA-Z0-9_\-]{20,}["']/gi,
    severity: "high",
    message: "Hardcoded API key/secret — use environment variables",
  },
  {
    id: "no-input-sanitize",
    regex: /(?:request\.body|req\.body|request\.json|body\.get)\s*\[/gi,
    severity: "medium",
    message: "Direct request body access without validation — sanitize before use in AI calls",
  },
  {
    id: "tool-call-unvalidated",
    regex: /tool_call|function_call|tool_choice/gi,
    severity: "low",
    message: "LLM tool/function call detected — ensure tool output is validated before execution",
  },
];

const SUPPORTED_EXTENSIONS = new Set([
  ".py", ".ts", ".js", ".jsx", ".tsx", ".java", ".go", ".rs", ".kt", ".mjs", ".cjs",
]);

function scanFile(filePath, content) {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { file: filePath, findings: [] };
  }

  const lines = content.split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of INJECTION_PATTERNS) {
      const re = new RegExp(pattern.regex.source, pattern.regex.flags);
      if (re.test(line)) {
        findings.push({
          line: i + 1,
          rule: pattern.id,
          severity: pattern.severity,
          message: pattern.message,
        });
      }
    }
  }

  return { file: filePath, findings };
}

function scanFiles(files) {
  return files.map((f) => scanFile(f.path, f.content)).filter((r) => r.findings.length > 0);
}

module.exports = { scanFile, scanFiles };
