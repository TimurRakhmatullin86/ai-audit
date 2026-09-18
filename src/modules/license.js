const fs = require('fs');
const path = require('path');

const licenseDb = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'license-db.json'), 'utf8')
);

// Patterns to extract model name strings from source code.
// Each regex captures the model name in group 1.
const MODEL_PATTERNS = [
  // model="name" or model='name'
  /model\s*=\s*["']([^"']+)["']/gi,
  // model: "name" or model: 'name' (YAML/JSON style)
  /model:\s*["']([^"']+)["']/gi,
  // "model": "name" (JSON config)
  /["']model["']\s*:\s*["']([^"']+)["']/gi,
  // MODEL_NAME = "name" or MODEL = "name" (constants)
  /[A-Z_]*MODEL[A-Z_]*\s*=\s*["']([^"']+)["']/gi,
];

const SUPPORTED_EXTENSIONS = new Set([
  '.py', '.ts', '.js', '.java', '.go', '.rs', '.kt',
  '.jsx', '.tsx', '.mjs', '.cjs',
]);

/**
 * Look up license info for a model name. Returns the matching license-db
 * entry or null if no pattern matches.
 * @param {string} modelName
 * @returns {object|null}
 */
function getLicenseInfo(modelName) {
  const lower = modelName.toLowerCase();
  for (const [pattern, entry] of Object.entries(licenseDb)) {
    if (lower.includes(pattern) || lower.startsWith(pattern)) {
      return { pattern, ...entry };
    }
  }
  return null;
}

/**
 * Extract model name references from file content using regex patterns.
 * Returns deduplicated array of { line, column, model } objects.
 * @param {string} content
 * @returns {Array<{line: number, column: number, model: string}>}
 */
function extractModelNames(content) {
  const lines = content.split('\n');
  const found = [];
  const seen = new Set();

  for (const pattern of MODEL_PATTERNS) {
    // Reset lastIndex for each pattern since they have the /g flag
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const modelName = match[1];
      const beforeMatch = content.slice(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const column = match.index - lastNewline;

      // Deduplicate by line+model
      const key = `${lineNumber}:${modelName}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ line: lineNumber, column, model: modelName });
      }
    }
  }

  return found.sort((a, b) => a.line - b.line);
}

/**
 * Scan a single file for AI model references and match them against
 * the license database. Returns findings for models with known licenses.
 * @param {string} filePath — absolute or relative file path
 * @param {string} content — file content as string
 * @returns {{file: string, models: Array<{line: number, column: number, model: string, license: object}>}}
 */
function scanFile(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    return { file: filePath, models: [] };
  }

  const refs = extractModelNames(content);
  const models = [];

  for (const ref of refs) {
    const license = getLicenseInfo(ref.model);
    if (license) {
      models.push({
        line: ref.line,
        column: ref.column,
        model: ref.model,
        license,
      });
    }
  }

  return { file: filePath, models };
}

/**
 * Scan multiple files for AI model references. Each entry should have
 * { path, content }. Returns array of per-file findings (only files
 * with at least one match are included).
 * @param {Array<{path: string, content: string}>} files
 * @returns {Array<{file: string, models: Array}>}
 */
function scanFiles(files) {
  const results = [];
  for (const file of files) {
    const result = scanFile(file.path, file.content);
    if (result.models.length > 0) {
      results.push(result);
    }
  }
  return results;
}

module.exports = { scanFile, scanFiles, getLicenseInfo };
