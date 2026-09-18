# ai-audit

[![npm](https://img.shields.io/npm/v/ai-project-audit)](https://www.npmjs.com/package/ai-project-audit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Audit AI projects for security, license compliance, privacy & cost issues.**

One command scans your codebase and produces a grade (A+ through F) with actionable findings across 4 modules:

| Module | What it checks |
|--------|---------------|
| **Security** (40pts) | Prompt injection, hardcoded keys, unsanitized input, eval risks |
| **License** (20pts) | AI model license restrictions (Llama, Gemma, Mistral, etc. — 30+ models) |
| **Privacy** (20pts) | Hardcoded PII — emails, SSN, credit cards, API keys, AWS keys |
| **Cost** (20pts) | Missing max_tokens, expensive models in loops, downgrade opportunities |

## Quick Start

### CLI

```bash
npx ai-project-audit .
```

### GitHub Action

```yaml
# .github/workflows/ai-audit.yml
name: AI Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: TimurRakhmatullin86/ai-audit@main
        with:
          fail-below: 70  # optional: fail PR if score < 70
```

The action posts a comment on your PR with the full audit report and a badge.

## CLI Options

```
ai-project-audit [dir] [options]

Options:
  --format text|json|markdown   Output format (default: text)
  --json                        Shorthand for --format json
  --md, --markdown              Shorthand for --format markdown
  --exit-code                   Exit with code 1 if grade is below B
```

## Badge

Add to your README after running the audit:

```markdown
![AI Audit: A+](https://img.shields.io/badge/AI_Audit-A%2B-brightgreen)
```

## Example Output

```
AI Project Audit — Grade: A (92/100)
Scanned 47 files

🛡️ Security: 40/40
  OK

📜 License: 18/20
  [LOW] src/agent.py:12 — gpt-4o — OpenAI API Terms of Service

🔒 Privacy: 20/20
  OK

💰 Cost: 14/20
  [HIGH] src/batch.py:8 — No max_tokens set on gpt-4o call
  [MEDIUM] src/batch.py:8 — LLM call has no error handling
```

## License Models Database

The license module covers 30+ patterns across 13 model families:

- **High risk**: Meta Llama (700M MAU cap), Mistral Large/Medium (research-only)
- **Medium risk**: Google Gemma (Prohibited Use Policy), Qwen (MAU limits), Stability AI (revenue cap)
- **Low risk**: OpenAI, Anthropic, DeepSeek (MIT), Phi (MIT), Yi (Apache 2.0)

## License

MIT
