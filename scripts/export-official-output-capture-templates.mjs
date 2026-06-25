#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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
const args = parseArgs();
const outDir = args.get("--out-dir") ?? "tmp/capture-templates";
const targetClass = args.get("--class") ?? "all";
const overwrite = args.get("--overwrite") === "true" || args.get("--force") === "true";
const dryRun = args.get("--dry-run") === "true";
const explicitSlugs = new Set([...asArray(args.get("--report")), ...asArray(args.get("--slug"))]);
const limitArg = args.get("--limit");
const limit = limitArg === undefined ? null : Number.parseInt(limitArg, 10);

if (!["all", "missing-exact-detail", "metadata-only"].includes(targetClass)) {
  throw new Error(`Unsupported --class ${targetClass}; expected all, missing-exact-detail, or metadata-only`);
}

if (limitArg !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
  throw new Error(`Unsupported --limit ${limitArg}; expected a positive integer`);
}

const runNode = (script, scriptArgs = []) =>
  execFileSync(process.execPath, [script, ...scriptArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const plan = JSON.parse(runNode("scripts/export-evidence-capture-plan.mjs", ["--class", targetClass]));
const plannedTargets = plan.targets.filter((target) => explicitSlugs.size === 0 || explicitSlugs.has(target.slug));
const selectedTargets = limit === null ? plannedTargets : plannedTargets.slice(0, limit);

if (explicitSlugs.size > 0) {
  const plannedSlugs = new Set(plan.targets.map((target) => target.slug));
  const missingSlugs = [...explicitSlugs].filter((slug) => !plannedSlugs.has(slug));
  if (missingSlugs.length > 0) {
    throw new Error(`No scaffold formal-evidence target found for slug(s): ${missingSlugs.join(", ")}`);
  }
}

const generated = [];
const skipped = [];
const failed = [];

if (!dryRun) {
  mkdirSync(outDir, { recursive: true });
}

for (const target of selectedTargets) {
  const outPath = join(outDir, `${target.slug}-official-output-capture-template.json`);
  const command = `npm run scaffold:capture-template -- --report ${target.slug} --out ${outPath}`;

  if (existsSync(outPath) && !overwrite) {
    skipped.push({
      slug: target.slug,
      title: target.title,
      path: outPath,
      reason: "template already exists; pass --overwrite true to regenerate",
      command,
    });
    continue;
  }

  if (dryRun) {
    generated.push({
      slug: target.slug,
      title: target.title,
      path: outPath,
      dryRun: true,
      command,
    });
    continue;
  }

  try {
    const result = JSON.parse(
      runNode("scripts/export-official-output-capture-template.mjs", [
        "--report",
        target.slug,
        "--out",
        outPath,
      ]),
    );
    generated.push({
      slug: target.slug,
      title: target.title,
      path: outPath,
      expectedRepositoryPath: result.expectedRepositoryPath,
      validationCommand: result.validationCommand,
      command,
    });
  } catch (error) {
    failed.push({
      slug: target.slug,
      title: target.title,
      path: outPath,
      command,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const summary = {
  schemaVersion: "soma-reports.official-output-capture-template-batch.v1",
  generatedAt: new Date().toISOString(),
  ok: failed.length === 0,
  sourcePlanSchemaVersion: plan.schemaVersion,
  sourceLedger: plan.sourceLedger,
  targetClass,
  outDir,
  overwrite,
  dryRun,
  requestedReports: [...explicitSlugs],
  selectedTargets: selectedTargets.length,
  generated: generated.length,
  skipped: skipped.length,
  failed: failed.length,
  generatedTemplates: generated,
  skippedTemplates: skipped,
  failedTemplates: failed,
  nextCommands: [
    `npm run scaffold:capture-plan -- --format md --out tmp/evidence-capture-plan.md`,
    `npm run scaffold:validate-captures`,
  ],
  note:
    "Generated templates intentionally contain placeholders and belong in tmp/ until official sample/completed-output rows and source bindings are filled.",
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
