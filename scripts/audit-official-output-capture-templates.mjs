#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import {
  officialOutputCaptureSchema,
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";

const parseArgs = () => {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      const existing = args.get(arg);
      args.set(arg, existing === undefined ? next : Array.isArray(existing) ? [...existing, next] : [existing, next]);
      index += 1;
    } else {
      args.set(arg, "true");
    }
  }
  return args;
};

const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const runNode = (script, scriptArgs = []) =>
  execFileSync(process.execPath, [script, ...scriptArgs], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 40,
    stdio: ["ignore", "pipe", "pipe"],
  });

const args = parseArgs();
const templateDir = args.get("--dir") ?? "tmp/capture-templates";
const targetClass = args.get("--class") ?? "all";
const strictExtra = args.get("--strict-extra") === "true";
const explicitSlugs = new Set([...asArray(args.get("--report")), ...asArray(args.get("--slug"))]);

if (!["all", "missing-exact-detail", "metadata-only"].includes(targetClass)) {
  throw new Error(`Unsupported --class ${targetClass}; expected all, missing-exact-detail, or metadata-only`);
}

const plan = JSON.parse(runNode("scripts/export-evidence-capture-plan.mjs", ["--class", targetClass]));
const allTargets = plan.targets.filter((target) => explicitSlugs.size === 0 || explicitSlugs.has(target.slug));

if (explicitSlugs.size > 0) {
  const plannedSlugs = new Set(plan.targets.map((target) => target.slug));
  const missingSlugs = [...explicitSlugs].filter((slug) => !plannedSlugs.has(slug));
  if (missingSlugs.length > 0) {
    throw new Error(`No scaffold formal-evidence target found for slug(s): ${missingSlugs.join(", ")}`);
  }
}

const templatePattern = /^(.+)-official-output-capture-template\.json$/;
const templateFiles = existsSync(templateDir)
  ? readdirSync(templateDir)
      .filter((file) => templatePattern.test(file))
      .map((file) => `${templateDir}/${file}`)
      .sort()
  : [];
const templateSlugByPath = new Map(
  templateFiles.map((path) => [path, templatePattern.exec(basename(path))?.[1] ?? null]),
);
const pathBySlug = new Map([...templateSlugByPath].map(([path, slug]) => [slug, path]));
const targetBySlug = new Map(allTargets.map((target) => [target.slug, target]));
const expectedTemplateSlugs = new Set(allTargets.map((target) => target.slug));
const referenceTemplateFiles = existsSync("reference/catalog")
  ? readdirSync("reference/catalog")
      .filter((file) => templatePattern.test(file))
      .map((file) => `reference/catalog/${file}`)
      .sort()
  : [];

const parseJson = (path) => {
  try {
    return { value: JSON.parse(readFileSync(path, "utf8")), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const allowedTemplateValidationProblem = (artifact, problem) => {
  if (problem.message === "placeholder text must be replaced before validation") {
    return true;
  }
  if (
    problem.path === "$.capturedAt" &&
    problem.message === "must be an ISO timestamp" &&
    typeof artifact?.capturedAt === "string" &&
    /\breplace-(?:me|with)\b/i.test(artifact.capturedAt)
  ) {
    return true;
  }
  return false;
};

const templateShapeProblems = (artifact, target) => {
  const problems = [];
  if (!isPlainObject(artifact)) {
    return ["template must be a JSON object"];
  }
  if (artifact.schema !== officialOutputCaptureSchema) {
    problems.push(`schema must be ${officialOutputCaptureSchema}`);
  }
  if (artifact.slug !== target.slug) {
    problems.push(`slug must be ${target.slug}`);
  }
  if (artifact.title !== target.title) {
    problems.push(`title must be ${target.title}`);
  }
  if (!isNonEmptyString(artifact.captureUrl) || !/^https:\/\/(?:www\.)?sequencing\.com\//i.test(artifact.captureUrl)) {
    problems.push("captureUrl must point to Sequencing.com");
  }
  if (!isPlainObject(artifact.privacyBoundary)) {
    problems.push("privacyBoundary must be present");
  } else {
    if (artifact.privacyBoundary.rawGenomeIncluded !== false) {
      problems.push("privacyBoundary.rawGenomeIncluded must be false");
    }
    if (artifact.privacyBoundary.privateValuesRedacted !== true) {
      problems.push("privacyBoundary.privateValuesRedacted must be true");
    }
    if (artifact.privacyBoundary.commitSafe !== true) {
      problems.push("privacyBoundary.commitSafe must be true");
    }
  }
  if (!Array.isArray(artifact.sampleRows) || artifact.sampleRows.length === 0) {
    problems.push("sampleRows must include at least one placeholder row");
  }
  if (!Array.isArray(artifact.formalFields) || artifact.formalFields.length === 0) {
    problems.push("formalFields must include at least one placeholder or described field");
  }
  if (!Array.isArray(artifact.citationBindings) || artifact.citationBindings.length === 0) {
    problems.push("citationBindings must include at least one placeholder binding");
  }
  if (artifact.promotionBoundary?.targetStartsAsScaffoldOnly !== true) {
    problems.push("promotionBoundary.targetStartsAsScaffoldOnly must be true");
  }
  if (!Array.isArray(artifact.promotionBoundary?.requiredEvidenceForPromotion)) {
    problems.push("promotionBoundary.requiredEvidenceForPromotion must be listed");
  }
  if (!Array.isArray(artifact.validationCommands) || !artifact.validationCommands.includes("npm run scaffold:evidence-audit")) {
    problems.push("validationCommands must include scaffold:evidence-audit");
  }
  return problems;
};

const rows = allTargets.map((target) => {
  const path = pathBySlug.get(target.slug) ?? null;
  if (!path) {
    return {
      slug: target.slug,
      title: target.title,
      path: `${templateDir}/${target.slug}-official-output-capture-template.json`,
      exists: false,
      status: "missing-template",
      validationOk: false,
      rowEvidenceReady: false,
      promotionSafeProvenance: false,
      outputSignalReview: false,
      outputSignalReviewCandidate: false,
      rowEvidencePromotionReady: false,
      promotionCandidate: false,
      expectedPlaceholderOnly: false,
      problems: ["template is missing"],
      warnings: [],
    };
  }

  const parsed = parseJson(path);
  if (parsed.error) {
    return {
      slug: target.slug,
      title: target.title,
      path,
      exists: true,
      status: "invalid-json",
      validationOk: false,
      rowEvidenceReady: false,
      promotionSafeProvenance: false,
      outputSignalReview: false,
      outputSignalReviewCandidate: false,
      rowEvidencePromotionReady: false,
      promotionCandidate: false,
      expectedPlaceholderOnly: false,
      problems: [parsed.error],
      warnings: [],
    };
  }

  const validation = validateOfficialOutputCaptureArtifact(parsed.value, {
    path,
    expectedSlug: target.slug,
  });
  const shapeProblems = templateShapeProblems(parsed.value, target);
  const unexpectedValidationProblems = validation.problems.filter(
    (problem) => !allowedTemplateValidationProblem(parsed.value, problem),
  );
  const expectedPlaceholderProblems = validation.problems.filter((problem) =>
    allowedTemplateValidationProblem(parsed.value, problem),
  );
  const expectedPlaceholderOnly =
    !validation.ok && expectedPlaceholderProblems.length > 0 && unexpectedValidationProblems.length === 0;
  const status = validation.ok
    ? validation.rowEvidenceReady
      ? "filled-row-evidence-ready"
      : "filled-output-signal-only"
    : expectedPlaceholderOnly
      ? "placeholder-template"
      : "invalid-template";

  return {
    slug: target.slug,
    title: target.title,
    path,
    exists: true,
    status,
    validationOk: validation.ok,
    rowEvidenceReady: validation.rowEvidenceReady,
    promotionSafeProvenance: validation.promotionSafeProvenance,
    outputSignalReview: validation.outputSignalReview,
    outputSignalReviewCandidate: validation.outputSignalReviewCandidate,
    rowEvidencePromotionReady: validation.rowEvidencePromotionReady,
    promotionCandidate: validation.promotionCandidate,
    expectedPlaceholderOnly,
    placeholderProblems: expectedPlaceholderProblems.length,
    validationProblems: validation.problems,
    problems: [
      ...shapeProblems,
      ...unexpectedValidationProblems.map((problem) => `${problem.path}: ${problem.message}`),
    ],
    warnings: validation.warnings,
    outputSignals: validation.outputSignals,
  };
});

const extraTemplates = [...templateSlugByPath]
  .filter(([, slug]) => slug && !expectedTemplateSlugs.has(slug))
  .map(([path, slug]) => ({ slug, path }));
const rowProblems = rows.flatMap((row) => row.problems.map((problem) => `${row.slug}: ${problem}`));
const problems = [
  ...rowProblems,
  ...referenceTemplateFiles.map((path) => `template draft must not live in reference/catalog: ${path}`),
  ...(strictExtra ? extraTemplates.map((entry) => `unexpected template: ${entry.path}`) : []),
];

const summary = {
  schemaVersion: "soma-reports.official-output-capture-template-audit.v1",
  generatedAt: new Date().toISOString(),
  ok: problems.length === 0,
  sourcePlanSchemaVersion: plan.schemaVersion,
  sourceLedger: plan.sourceLedger,
  templateDir,
  targetClass,
  requestedReports: [...explicitSlugs],
  strictExtra,
  totals: {
    expectedTemplates: allTargets.length,
    existingTemplates: rows.filter((row) => row.exists).length,
    missingTemplates: rows.filter((row) => !row.exists).length,
    placeholderTemplates: rows.filter((row) => row.status === "placeholder-template").length,
    filledRowEvidenceReadyTemplates: rows.filter((row) => row.status === "filled-row-evidence-ready").length,
    filledOutputSignalOnlyTemplates: rows.filter((row) => row.status === "filled-output-signal-only").length,
    invalidTemplates: rows.filter((row) => ["invalid-json", "invalid-template"].includes(row.status)).length,
    extraTemplates: extraTemplates.length,
    referenceCatalogTemplateDrafts: referenceTemplateFiles.length,
  },
  problems,
  warnings: [
    ...(!strictExtra ? extraTemplates.map((entry) => `unexpected template ignored by default: ${entry.path}`) : []),
    ...rows.flatMap((row) => row.warnings.map((warning) => `${row.slug}: ${warning.path}: ${warning.message}`)),
  ],
  rows,
  nextCommands: [
    "npm run scaffold:capture-templates",
    "npm run scaffold:capture-plan -- --format md --out tmp/evidence-capture-plan.md",
    "npm run scaffold:validate-captures",
  ],
  note:
    "A placeholder-template row is expected for local drafts. It proves the template is present and structurally usable, not that official output evidence has been captured.",
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
