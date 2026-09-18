'use strict';

// Model cost tiers
const EXPENSIVE_MODELS = ['gpt-4o', 'gpt-4', 'gpt-4-turbo', 'claude-opus-4', 'claude-sonnet-4', 'gemini-1.5-pro', 'gemini-2.0-pro'];
const MID_MODELS = ['gpt-4o-mini', 'claude-haiku', 'gemini-1.5-flash', 'gemini-2.0-flash', 'mistral-large', 'command-r-plus'];
const CHEAP_MODELS = ['gpt-3.5-turbo', 'claude-haiku-3', 'gemini-flash', 'mistral-small', 'command-r'];

const ALL_MODELS = [...EXPENSIVE_MODELS, ...MID_MODELS, ...CHEAP_MODELS];

// Patterns that identify an LLM API call
const LLM_CALL_PATTERNS = [
  /completions\.create\s*\(/,
  /messages\.create\s*\(/,
  /generate_content\s*\(/,
  /\.chat\s*\([\s\S]*model\s*[=:]/,
];

// Keywords suggesting classification/extraction tasks (for downgrade rule)
const SIMPLE_TASK_KEYWORDS = ['classify', 'extract', 'label', 'tag', 'categorize', 'summarize', 'translate'];

// Loop constructs
const LOOP_PATTERNS = [/\bfor\s+/, /\bfor\s*\(/, /\bwhile\s+/, /\bwhile\s*\(/, /\.forEach\s*\(/, /\.map\s*\(/];

// Error-handling constructs
const ERROR_HANDLING_PATTERNS = [
  /\btry\s*[{:]/, /\btry\s*$/, /\.catch\s*\(/, /\brescue\b/, /\bcatch\s*\(/, /\bdefer\b/, /\.unwrap_or/, /\?\s*;/,
];

const SUPPORTED_EXTENSIONS = ['.py', '.ts', '.js', '.java', '.go', '.rs', '.kt'];

/**
 * Return the leading whitespace length of a line.
 */
function indentLevel(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

/**
 * Check whether a line matches any LLM API call pattern.
 */
function isLLMCall(line) {
  return LLM_CALL_PATTERNS.some((p) => p.test(line));
}

/**
 * Find which model name appears on a line (or null).
 */
function findModel(line) {
  for (const m of ALL_MODELS) {
    if (line.includes(m)) return m;
  }
  return null;
}

/**
 * Determine the cost tier of a model name.
 */
function modelTier(name) {
  if (EXPENSIVE_MODELS.includes(name)) return 'expensive';
  if (MID_MODELS.includes(name)) return 'mid';
  if (CHEAP_MODELS.includes(name)) return 'cheap';
  return null;
}

/**
 * Suggest a cheaper alternative for an expensive model.
 */
function cheaperAlternative(model) {
  if (model.startsWith('gpt-4o')) return 'gpt-4o-mini';
  if (model.startsWith('gpt-4')) return 'gpt-4o-mini';
  if (model.startsWith('claude-opus')) return 'claude-haiku';
  if (model.startsWith('claude-sonnet')) return 'claude-haiku';
  if (model.startsWith('gemini')) return 'gemini-2.0-flash';
  return null;
}

/**
 * Check whether max_tokens (or max_output_tokens) appears within windowSize
 * lines after the given index.
 */
function hasMaxTokensNearby(lines, startIdx, windowSize) {
  const end = Math.min(startIdx + windowSize, lines.length);
  for (let i = startIdx; i < end; i++) {
    if (/max_tokens|max_output_tokens|maxTokens|MaxTokens/.test(lines[i])) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether a loop construct appears within windowSize lines above
 * the given index, at the same or lower indent level.
 */
function isInsideLoop(lines, idx, windowSize) {
  const callIndent = indentLevel(lines[idx]);
  const start = Math.max(0, idx - windowSize);
  for (let i = start; i < idx; i++) {
    const lineIndent = indentLevel(lines[i]);
    if (lineIndent <= callIndent && LOOP_PATTERNS.some((p) => p.test(lines[i]))) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether error handling wraps the region around idx.
 * Looks up to windowSize lines above and below.
 */
function hasErrorHandling(lines, idx, windowSize) {
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(idx + windowSize, lines.length);
  for (let i = start; i < end; i++) {
    if (ERROR_HANDLING_PATTERNS.some((p) => p.test(lines[i]))) {
      return true;
    }
  }
  return false;
}

/**
 * Check whether any simple-task keyword appears within windowSize lines
 * around the given index.
 */
function hasSimpleTaskKeyword(lines, idx, windowSize) {
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(idx + windowSize, lines.length);
  for (let i = start; i < end; i++) {
    const lower = lines[i].toLowerCase();
    if (SIMPLE_TASK_KEYWORDS.some((kw) => lower.includes(kw))) {
      return true;
    }
  }
  return false;
}

/**
 * Scan a single file's content for LLM cost anti-patterns.
 * @param {string} filePath - Path to the file being scanned.
 * @param {string} content - The file's text content.
 * @returns {{ file: string, findings: Array<{line: number, rule: string, severity: string, message: string, suggestion: string}> }}
 */
function scanFile(filePath, content) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return { file: filePath, findings: [] };
  }

  const lines = content.split('\n');
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isLLMCall(line)) continue;

    const model = findModel(line) || findModelNearby(lines, i, 5);
    const lineNum = i + 1;

    // Rule 1: missing max_tokens
    if (!hasMaxTokensNearby(lines, i, 10)) {
      findings.push({
        line: lineNum,
        rule: 'missing_max_tokens',
        severity: 'high',
        message: `No max_tokens set on ${model || 'LLM'} call — risk of unbounded cost`,
        suggestion: 'Add max_tokens=1000 (or appropriate limit)',
      });
    }

    // Rule 2: expensive model in loop
    if (model && modelTier(model) === 'expensive' && isInsideLoop(lines, i, 20)) {
      findings.push({
        line: lineNum,
        rule: 'expensive_in_loop',
        severity: 'high',
        message: `Expensive model "${model}" called inside a loop — costs multiply per iteration`,
        suggestion: `Batch requests, cache results, or switch to ${cheaperAlternative(model) || 'a cheaper model'}`,
      });
    }

    // Rule 3: model downgrade suggestion
    if (model && modelTier(model) === 'expensive' && hasSimpleTaskKeyword(lines, i, 10)) {
      const alt = cheaperAlternative(model);
      findings.push({
        line: lineNum,
        rule: 'model_downgrade',
        severity: 'low',
        message: `"${model}" used for what looks like a simple task (classify/extract/summarize)`,
        suggestion: alt
          ? `Consider ${alt} for this task — similar quality at lower cost`
          : 'Consider a cheaper model for this task',
      });
    }

    // Rule 4: no error handling
    if (!hasErrorHandling(lines, i, 8)) {
      findings.push({
        line: lineNum,
        rule: 'no_error_handling',
        severity: 'medium',
        message: 'LLM call has no error handling — unhandled failures may trigger costly retries',
        suggestion: 'Wrap in try/except (Python), try/catch (JS/TS), or equivalent error handling',
      });
    }
  }

  return { file: filePath, findings };
}

/**
 * Look for a model name within a few lines of the given index.
 */
function findModelNearby(lines, idx, windowSize) {
  const start = Math.max(0, idx - windowSize);
  const end = Math.min(idx + windowSize, lines.length);
  for (let i = start; i < end; i++) {
    const m = findModel(lines[i]);
    if (m) return m;
  }
  return null;
}

/**
 * Scan multiple files for LLM cost anti-patterns.
 * @param {Array<{path: string, content: string}>} files - Files to scan.
 * @returns {Array<{file: string, findings: Array}>}
 */
function scanFiles(files) {
  return files.map((f) => scanFile(f.path, f.content)).filter((r) => r.findings.length > 0);
}

module.exports = { scanFile, scanFiles };
