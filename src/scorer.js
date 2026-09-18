"use strict";

const WEIGHTS = {
  security: 40,
  license: 20,
  privacy: 20,
  cost: 20,
};

const SEVERITY_PENALTY = {
  high: 10,
  medium: 5,
  low: 2,
};

function gradeFromScore(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function badgeColor(grade) {
  if (grade.startsWith("A")) return "brightgreen";
  if (grade.startsWith("B")) return "green";
  if (grade.startsWith("C")) return "yellow";
  if (grade.startsWith("D")) return "orange";
  return "red";
}

function computeModuleScore(maxPoints, findings) {
  let penalty = 0;
  for (const f of findings) {
    const sev = f.severity || "medium";
    penalty += SEVERITY_PENALTY[sev] || 5;
  }
  return Math.max(0, maxPoints - penalty);
}

/** Compute overall audit score from all module results. */
function computeScore(results) {
  const modules = {};

  for (const [name, weight] of Object.entries(WEIGHTS)) {
    const findings = results[name] || [];
    const score = computeModuleScore(weight, findings);
    modules[name] = { maxPoints: weight, score, findings: findings.length };
  }

  const totalScore = Object.values(modules).reduce((s, m) => s + m.score, 0);
  const grade = gradeFromScore(totalScore);

  return {
    score: totalScore,
    maxScore: 100,
    grade,
    color: badgeColor(grade),
    modules,
  };
}

module.exports = { computeScore, gradeFromScore, badgeColor };
