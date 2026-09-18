"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { audit } = require("../src/index");

const security = require("../src/modules/security");
const license = require("../src/modules/license");
const privacy = require("../src/modules/privacy");
const cost = require("../src/modules/cost");
const { computeScore, gradeFromScore, badgeColor } = require("../src/scorer");
const { collectFiles } = require("../src/scanner");

// --- Scorer ---

describe("scorer", () => {
  it("returns A+ for no findings", () => {
    const result = computeScore({ security: [], license: [], privacy: [], cost: [] });
    assert.equal(result.score, 100);
    assert.equal(result.grade, "A+");
    assert.equal(result.color, "brightgreen");
  });

  it("penalizes high-severity findings", () => {
    const result = computeScore({
      security: [{ severity: "high" }, { severity: "high" }],
      license: [],
      privacy: [],
      cost: [],
    });
    assert.ok(result.score < 100);
    assert.equal(result.modules.security.score, 20);
  });

  it("grade mapping", () => {
    assert.equal(gradeFromScore(95), "A+");
    assert.equal(gradeFromScore(90), "A");
    assert.equal(gradeFromScore(75), "B");
    assert.equal(gradeFromScore(60), "C");
    assert.equal(gradeFromScore(40), "F");
  });

  it("badge colors", () => {
    assert.equal(badgeColor("A+"), "brightgreen");
    assert.equal(badgeColor("B"), "green");
    assert.equal(badgeColor("C"), "yellow");
    assert.equal(badgeColor("F"), "red");
  });
});

// --- Security ---

describe("security", () => {
  it("detects prompt concatenation", () => {
    const result = security.scanFile("app.py", 'prompt += f"User said: {user_input}"');
    assert.ok(result.findings.length > 0);
    assert.equal(result.findings[0].rule, "prompt-concat");
    assert.equal(result.findings[0].severity, "high");
  });

  it("detects hardcoded API key", () => {
    const result = security.scanFile("config.js", 'const api_key = "sk-abc123def456ghi789jkl012mno345"');
    assert.ok(result.findings.some((f) => f.rule === "hardcoded-key"));
  });

  it("ignores non-code files", () => {
    const result = security.scanFile("data.csv", 'api_key = "sk-abc123def456ghi789jkl012mno345"');
    assert.equal(result.findings.length, 0);
  });
});

// --- License ---

describe("license", () => {
  it("detects llama model reference", () => {
    const result = license.scanFile("app.py", 'model = "meta-llama/Llama-3.1-70B"');
    assert.ok(result.models.length > 0);
    assert.ok(result.models[0].license);
    assert.equal(result.models[0].license.risk, "high");
  });

  it("detects gpt-4 (low risk)", () => {
    const result = license.scanFile("main.ts", 'const model = "gpt-4o"');
    assert.ok(result.models.length > 0);
    assert.equal(result.models[0].license.risk, "low");
  });

  it("getLicenseInfo returns null for unknown", () => {
    const info = license.getLicenseInfo("some-random-model-xyz");
    assert.equal(info, null);
  });
});

// --- Privacy ---

describe("privacy", () => {
  it("detects email", () => {
    const result = privacy.scanFile("data.py", 'email = "john@company.com"');
    assert.ok(result.findings.length > 0);
    assert.equal(result.findings[0].type, "email");
    assert.ok(!result.findings[0].value.includes("john@company.com"));
  });

  it("detects SSN", () => {
    const result = privacy.scanFile("form.js", 'ssn = "123-45-6789"');
    assert.ok(result.findings.length > 0);
    assert.equal(result.findings[0].type, "ssn");
    assert.equal(result.findings[0].severity, "high");
  });

  it("skips fake emails", () => {
    const result = privacy.scanFile("test.py", 'email = "user@example.com"');
    const emailFindings = result.findings.filter((f) => f.type === "email");
    assert.equal(emailFindings.length, 0);
  });

  it("skips local IPs", () => {
    const result = privacy.scanFile("config.py", 'host = "127.0.0.1"');
    const ipFindings = result.findings.filter((f) => f.type === "ip");
    assert.equal(ipFindings.length, 0);
  });

  it("downgrades severity in test files", () => {
    const result = privacy.scanFile("test_handler.py", 'ssn = "123-45-6789"');
    assert.ok(result.findings.length > 0);
    assert.equal(result.findings[0].severity, "low");
  });
});

// --- Cost ---

describe("cost", () => {
  it("detects missing max_tokens", () => {
    const code = `
response = client.messages.create(
    model="claude-opus-4",
    messages=[{"role": "user", "content": prompt}]
)`;
    const result = cost.scanFile("agent.py", code);
    assert.ok(result.findings.some((f) => f.rule === "missing_max_tokens"));
  });

  it("detects expensive model in loop", () => {
    const code = `
for item in batch:
    response = client.messages.create(
        model="claude-opus-4",
        max_tokens=500,
        messages=[{"role": "user", "content": item}]
    )`;
    const result = cost.scanFile("batch.py", code);
    assert.ok(result.findings.some((f) => f.rule === "expensive_in_loop"));
  });

  it("suggests downgrade for simple tasks", () => {
    const code = `
# classify the text
response = client.messages.create(
    model="gpt-4o",
    max_tokens=100,
    messages=[{"role": "user", "content": "classify: " + text}]
)`;
    const result = cost.scanFile("classify.py", code);
    const downgrade = result.findings.find((f) => f.rule === "model_downgrade");
    assert.ok(downgrade);
    assert.ok(downgrade.suggestion.includes("gpt-4o-mini"));
  });

  it("ignores non-code files", () => {
    const result = cost.scanFile("data.json", '{"model": "gpt-4o"}');
    assert.equal(result.findings.length, 0);
  });
});

// --- Integration ---

describe("audit (integration)", () => {
  it("runs on fixture directory", () => {
    const fixtureDir = path.join(__dirname, "fixtures");
    const result = audit(fixtureDir, { format: "text" });
    assert.ok(typeof result.score === "number");
    assert.ok(result.grade);
    assert.ok(result.report.length > 0);
  });

  it("produces markdown output", () => {
    const fixtureDir = path.join(__dirname, "fixtures");
    const result = audit(fixtureDir, { format: "markdown" });
    assert.ok(result.report.includes("AI Project Audit"));
    assert.ok(result.report.includes("Badge for README"));
  });

  it("produces json output", () => {
    const fixtureDir = path.join(__dirname, "fixtures");
    const result = audit(fixtureDir, { format: "json" });
    const parsed = JSON.parse(result.report);
    assert.ok(typeof parsed.score === "number");
    assert.ok(parsed.grade);
  });
});
