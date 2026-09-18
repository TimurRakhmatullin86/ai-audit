"use strict";

// --- PII pattern definitions ---

const PATTERNS = [
  {
    type: "ssn",
    regex: /\b(\d{3})-(\d{2})-(\d{4})\b/g,
    severity: "high",
    redact: (m) => m.slice(0, 3) + "-**-****",
  },
  {
    type: "credit_card",
    regex: /\b(\d{4})[- ]?(\d{4})[- ]?(\d{4})[- ]?(\d{4})\b/g,
    severity: "high",
    redact: (m) => m.slice(0, 4) + " **** **** ****",
  },
  {
    type: "aws_key",
    regex: /\b(AKIA[0-9A-Z]{16})\b/g,
    severity: "high",
    redact: (m) => m.slice(0, 8) + "************",
  },
  {
    type: "api_key",
    regex: /\b(sk-[a-zA-Z0-9]{20,})\b/g,
    severity: "high",
    redact: (m) => m.slice(0, 5) + "***",
  },
  {
    type: "api_key",
    regex: /\b(ghp_[a-zA-Z0-9]{36})\b/g,
    severity: "high",
    redact: (m) => m.slice(0, 7) + "***",
  },
  {
    type: "api_key",
    regex: /\b(Bearer\s+[a-zA-Z0-9\-._~+/]+=*)\b/g,
    severity: "high",
    redact: (m) => "Bearer ***",
  },
  {
    type: "email",
    regex: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
    severity: "medium",
    redact: (m) => {
      const [local, domain] = m.split("@");
      return local[0] + "***@" + domain;
    },
  },
  {
    type: "phone",
    regex: /\b(\+?1[-.\s]?)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
    severity: "medium",
    redact: (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.slice(0, 3) + "***" + digits.slice(-2);
    },
  },
  {
    type: "ip",
    regex: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
    severity: "medium",
    redact: (m) => {
      const parts = m.split(".");
      return parts[0] + "." + parts[1] + ".*.*";
    },
  },
];

const FAKE_EMAILS = [
  "test@test.com",
  "user@example.com",
  "example@example.com",
  "foo@bar.com",
  "admin@example.org",
];

const LOCAL_IP_PREFIXES = ["127.", "0.0.0.0", "192.168.", "10."];

const COMMENT_RE = /^\s*(\/\/|#|\/\*|\*|""")/;

const TEST_FILE_RE = /(test|spec|mock|fixture)/i;

// --- Helpers ---

function isCommentLine(line) {
  return COMMENT_RE.test(line);
}

function isFakeEmail(email) {
  const lower = email.toLowerCase();
  if (FAKE_EMAILS.includes(lower)) return true;
  if (lower.startsWith("noreply@")) return true;
  if (lower.includes("@example.")) return true;
  return false;
}

function isLocalIp(ip) {
  return LOCAL_IP_PREFIXES.some((p) => ip.startsWith(p));
}

function isVersionLikeIp(ip, lineText) {
  const parts = ip.split(".");
  if (parts.length === 4 && new Set(parts).size === 1) return true;
  const idx = lineText.indexOf(ip);
  if (idx > 0) {
    const before = lineText.slice(Math.max(0, idx - 10), idx).toLowerCase();
    if (/\bv(ersion)?\s*$/.test(before)) return true;
  }
  return false;
}

function isTestFile(filePath) {
  return TEST_FILE_RE.test(filePath);
}

function redactInContext(contextLine, original, redacted) {
  return contextLine.replace(original, redacted);
}

// --- Core scanning ---

function scanLine(lineText, lineNumber, filePath) {
  if (isCommentLine(lineText)) return [];

  const findings = [];
  const inTest = isTestFile(filePath);

  for (const pattern of PATTERNS) {
    const re = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;
    while ((match = re.exec(lineText)) !== null) {
      const raw = match[0];

      // IP filtering
      if (pattern.type === "ip") {
        if (isLocalIp(raw)) continue;
        if (isVersionLikeIp(raw, lineText)) continue;
      }

      // Email filtering
      if (pattern.type === "email" && isFakeEmail(raw)) continue;

      const redacted = pattern.redact(raw);
      const severity = inTest ? "low" : pattern.severity;

      findings.push({
        line: lineNumber,
        type: pattern.type,
        value: redacted,
        severity,
        context: redactInContext(
          lineText.trimEnd().slice(0, 120),
          raw,
          redacted
        ),
      });
    }
  }

  return findings;
}

/**
 * Scan a single file for hardcoded PII.
 * @param {string} filePath - Path to the file being scanned.
 * @param {string} content - File content as a string.
 * @returns {{ file: string, findings: Array<{line: number, type: string, value: string, severity: string, context: string}> }}
 */
function scanFile(filePath, content) {
  const lines = content.split("\n");
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const lineFindings = scanLine(lines[i], i + 1, filePath);
    findings.push(...lineFindings);
  }

  return { file: filePath, findings };
}

/**
 * Scan multiple files for hardcoded PII.
 * @param {Array<{path: string, content: string}>} files - Array of file objects.
 * @returns {Array<{ file: string, findings: Array<{line: number, type: string, value: string, severity: string, context: string}> }>}
 */
function scanFiles(files) {
  return files.map((f) => scanFile(f.path, f.content));
}

module.exports = { scanFile, scanFiles };
