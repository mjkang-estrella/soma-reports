#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const parseArgs = () => {
  const parsed = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    parsed.set(arg, next && !next.startsWith("--") ? next : "true");
    if (next && !next.startsWith("--")) {
      index += 1;
    }
  }
  return parsed;
};

const args = parseArgs();
const reportSlug = args.get("--report");
const vcfPath = args.get("--vcf") ?? args.get("--genome") ?? null;
const qcSummaryPath = args.get("--qc-summary") ?? args.get("--depth-summary") ?? args.get("--derived-qc") ?? null;
const runnerCommand = args.get("--runner-command") ?? args.get("--runner") ?? null;
const generateDeterministicResult =
  args.get("--deterministic-result") === "true" ||
  args.get("--generate-result") === "true" ||
  args.get("--generate-local-result") === "true";
const format = args.get("--format") ?? "json";
const allowLocalScaffold =
  args.get("--allow-local-scaffold") === "true" ||
  args.get("--allow-scaffold") === "true" ||
  args.get("--allow-scaffold-only") === "true";
const allowPartial = args.get("--allow-partial") === "true";
const allowEmpty = args.get("--allow-empty") === "true" || args.get("--allow-unavailable") === "true";
const allowFiltered = args.get("--allow-filtered") === "true";
const sample = args.get("--sample") ?? null;
const assembly = args.get("--assembly") ?? null;
const refreshBundle = args.get("--refresh-bundle") === "true";
const saveValidationLedger = args.get("--save-validation-ledger") === "true";
const outDir = args.get("--out-dir") ?? null;

if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

if (!reportSlug || (vcfPath && qcSummaryPath) || (!vcfPath && !qcSummaryPath)) {
  throw new Error(
    "Usage: npm run agent:local-run -- --report <slug> (--vcf /path/to/local.vcf[.gz] | --qc-summary /path/to/depth-summary.json) [--runner-command '/path/to/local-json-runner' | --deterministic-result true] [--assembly GRCh38|GRCh37] [--allow-local-scaffold true]",
  );
}
if (runnerCommand && generateDeterministicResult) {
  throw new Error("Use either --runner-command or --deterministic-result true, not both");
}

const localInputPath = vcfPath ?? qcSummaryPath;
if (!existsSync(localInputPath)) {
  throw new Error("Missing local genome/QC input path. The raw path is intentionally not echoed.");
}

const baseOutDir = outDir ? outDir.replace(/\/$/, "") : null;
const bundlePath =
  args.get("--bundle") ?? (baseOutDir ? `${baseOutDir}/${reportSlug}.validated.json` : `tmp/agent-bundles/${reportSlug}.validated.json`);
const templatePath =
  args.get("--template") ??
  (baseOutDir
    ? `${baseOutDir}/${reportSlug}.derived-evidence-template.json`
    : `tmp/evidence-templates/${reportSlug}.derived-evidence-template.json`);
const evidencePath =
  args.get("--evidence") ??
  (baseOutDir
    ? `${baseOutDir}/${reportSlug}.filled-derived-evidence.json`
    : `tmp/evidence-templates/${reportSlug}.filled-derived-evidence.json`);
const inputPath =
  args.get("--input") ??
  (baseOutDir ? `${baseOutDir}/${reportSlug}.agent-input.json` : `tmp/agent-runs/${reportSlug}.agent-input.json`);
const resultPath =
  args.get("--result") ??
  (baseOutDir ? `${baseOutDir}/${reportSlug}.agent-result.json` : `tmp/agent-runs/${reportSlug}.agent-result.json`);
const validationPath =
  args.get("--validation") ??
  (baseOutDir ? `${baseOutDir}/${reportSlug}.validation.json` : `tmp/agent-runs/${reportSlug}.validation.json`);
const fixturePath = `fixtures/synthetic/${reportSlug}.fixture.json`;
const deterministicResultPath = `fixtures/synthetic/${reportSlug}.result.json`;

for (const path of [fixturePath, deterministicResultPath]) {
  if (!existsSync(path)) {
    throw new Error(`Missing required report artifact: ${path}`);
  }
}

const sanitizeText = (value) =>
  String(value ?? "")
    .replaceAll(localInputPath, "[local-genome-input]")
    .replaceAll(vcfPath ?? "", vcfPath ? "[local-genome-input]" : "")
    .replaceAll(qcSummaryPath ?? "", qcSummaryPath ? "[local-qc-input]" : "");
const parseJsonOutput = (stdout) => {
  const text = sanitizeText(stdout).trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};
const sha256File = (path) =>
  existsSync(path) ? `sha256:${createHash("sha256").update(readFileSync(path)).digest("hex")}` : null;
const compactParsed = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    ok: value.ok,
    reportSlug: value.reportSlug,
    outPath: value.outPath,
    templateRows: value.templateRows,
    matchedRows: value.matchedRows,
    unavailableRows: value.unavailableRows,
    filteredRows: value.filteredRows,
    derivedEvidenceRows: value.derivedEvidenceRows,
    matchedInputIds: value.matchedInputIds,
    usableExpectedRows: value.usableExpectedRows,
    unmatchedExpectedInputIds: value.unmatchedExpectedInputIds,
    rawGenomeIncluded: value.rawGenomeIncluded,
    summary: value.summary,
    evidenceCounts: value.evidenceCounts,
    resultRows: value.resultRows,
    genotypeSummaryRows: value.genotypeSummaryRows,
    localEvidenceRows: value.localEvidenceRows,
    usableLocalEvidenceRows: value.usableLocalEvidenceRows,
    localObservedValuesInBody: value.localObservedValuesInBody,
    resultHash: value.resultHash,
  };
};

const steps = [];
const runNodeJson = (name, script, scriptArgs) => {
  const run = spawnSync(process.execPath, [script, ...scriptArgs], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 40,
  });
  const parsed = parseJsonOutput(run.stdout);
  const step = {
    name,
    exitCode: run.status,
    ok: run.status === 0 && (parsed?.ok ?? true) !== false,
    parsed: compactParsed(parsed),
    stderr: run.stderr ? sanitizeText(run.stderr).trim().slice(0, 2000) : null,
  };
  steps.push(step);
  return { run, parsed, step };
};

const stopIfFailed = (step) => {
  if (step.ok) {
    return;
  }
  throw new Error(`${step.name} failed`);
};

let workflowPreflight = null;
let workflowStrict = null;
let validation = null;
let runner = null;
let deterministicResult = null;

try {
  if (refreshBundle || !existsSync(bundlePath)) {
    const bundle = runNodeJson("agent:bundle", "scripts/agent-bundle.mjs", [
      "--report",
      reportSlug,
      "--fixture",
      fixturePath,
      "--result",
      deterministicResultPath,
      "--out",
      bundlePath,
    ]);
    stopIfFailed(bundle.step);
  } else {
    steps.push({
      name: "agent:bundle",
      exitCode: 0,
      ok: true,
      skipped: true,
      reason: "validated bundle already exists; pass --refresh-bundle true to rebuild",
      parsed: { ok: true, reportSlug, outPath: bundlePath },
      stderr: null,
    });
  }

  const templateArgs = ["--report", reportSlug, "--bundle", bundlePath, "--out", templatePath];
  if (assembly) {
    templateArgs.push("--assembly", assembly);
  }
  const template = runNodeJson("agent:evidence-template", "scripts/export-local-evidence-template.mjs", templateArgs);
  stopIfFailed(template.step);

  const deriveArgs = ["--template", templatePath, "--out", evidencePath];
  if (vcfPath) {
    deriveArgs.push("--vcf", vcfPath);
  } else {
    deriveArgs.push("--qc-summary", qcSummaryPath);
  }
  if (sample) {
    deriveArgs.push("--sample", sample);
  }
  if (assembly) {
    deriveArgs.push("--assembly", assembly);
  }
  if (allowEmpty) {
    deriveArgs.push("--allow-empty", "true");
  }
  if (allowFiltered) {
    deriveArgs.push("--allow-filtered", "true");
  }
  const derived = runNodeJson("agent:derive-evidence", "scripts/derive-local-evidence-from-genome.mjs", deriveArgs);
  stopIfFailed(derived.step);

  const prepareArgs = ["--report", reportSlug, "--bundle", bundlePath, "--evidence", evidencePath, "--out", inputPath];
  if (allowPartial) {
    prepareArgs.push("--allow-partial", "true");
  }
  if (allowEmpty) {
    prepareArgs.push("--allow-empty", "true");
  }
  if (allowLocalScaffold) {
    prepareArgs.push("--allow-local-scaffold", "true");
  }
  const prepared = runNodeJson("agent:prepare", "scripts/prepare-local-agent-run.mjs", prepareArgs);
  stopIfFailed(prepared.step);

  const checkArgs = [
    "--report",
    reportSlug,
    "--bundle",
    bundlePath,
    "--evidence",
    evidencePath,
    "--input",
    inputPath,
    "--result",
    resultPath,
    "--format",
    "compact",
  ];
  if (allowLocalScaffold) {
    checkArgs.push("--allow-local-scaffold", "true");
  }
  workflowPreflight = runNodeJson("agent:workflow-check", "scripts/check-local-agent-workflow.mjs", checkArgs);
  stopIfFailed(workflowPreflight.step);

  if (runnerCommand) {
    mkdirSync(dirname(resultPath), { recursive: true });
    const runnerRun = spawnSync(runnerCommand, {
      cwd: process.cwd(),
      input: readFileSync(inputPath, "utf8"),
      shell: true,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 40,
    });
    runner = {
      name: "local-runner",
      exitCode: runnerRun.status,
      ok: runnerRun.status === 0 && runnerRun.stdout.trim().length > 0,
      stderr: runnerRun.stderr ? sanitizeText(runnerRun.stderr).trim().slice(0, 2000) : null,
      resultPath,
    };
    if (runnerRun.status === 0 && runnerRun.stdout.trim().length > 0) {
      writeFileSync(resultPath, runnerRun.stdout);
    } else if (runnerRun.status === 0) {
      runner.stderr = runner.stderr
        ? `${runner.stderr}\nlocal runner exited successfully but produced no JSON stdout`
        : "local runner exited successfully but produced no JSON stdout";
    }
    steps.push(runner);
    stopIfFailed(runner);
  }

  if (generateDeterministicResult) {
    deterministicResult = runNodeJson("agent:generate-local-result", "scripts/generate-local-agent-result.mjs", [
      "--input",
      inputPath,
      "--base-result",
      deterministicResultPath,
      "--out",
      resultPath,
      "--format",
      "compact",
    ]);
    stopIfFailed(deterministicResult.step);
  }

  if (runnerCommand || generateDeterministicResult) {
    const validateArgs = ["--input", inputPath, "--result", resultPath];
    if (saveValidationLedger) {
      validateArgs.push("--out", validationPath);
    }
    validation = runNodeJson("agent:validate-run", "scripts/validate-local-agent-run.mjs", validateArgs);
    stopIfFailed(validation.step);

    workflowStrict = runNodeJson("agent:workflow-check:strict", "scripts/check-local-agent-workflow.mjs", [
      ...checkArgs,
      "--strict",
      "true",
    ]);
    stopIfFailed(workflowStrict.step);
  }
} catch (error) {
  const summary = {
    schemaVersion: "soma-reports.local-genome-report-run.v1",
    generatedAt: new Date().toISOString(),
    ok: false,
    reportSlug,
    runnerInvoked: Boolean(runnerCommand),
    deterministicResultGenerated: generateDeterministicResult && existsSync(resultPath),
    stoppedAt: steps.find((step) => !step.ok)?.name ?? "unknown",
    error: sanitizeText(error.message),
    paths: { bundlePath, templatePath, evidencePath, inputPath, resultPath, validationPath },
    steps,
    privacyBoundary: {
      rawGenomeIncluded: false,
      rawGenomePathPrinted: false,
      localGenomeInputReadOnly: true,
      note:
        "The raw local input path is used only as script input and is redacted from wrapper output. Generated files stay under ignored tmp/ paths.",
    },
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exit(1);
}

const allStepsOk = steps.every((step) => step.ok);
const deriveStep = steps.find((step) => step.name === "agent:derive-evidence");
const prepareStep = steps.find((step) => step.name === "agent:prepare");
const localCounts = {
  templateRows: deriveStep?.parsed?.templateRows ?? null,
  matchedRows: deriveStep?.parsed?.matchedRows ?? null,
  unavailableRows:
    deriveStep?.parsed?.unavailableRows ??
    (Number.isFinite(deriveStep?.parsed?.templateRows) && Number.isFinite(deriveStep?.parsed?.matchedRows)
      ? deriveStep.parsed.templateRows - deriveStep.parsed.matchedRows
      : null),
  filteredRows: deriveStep?.parsed?.filteredRows ?? null,
  usableExpectedRows: prepareStep?.parsed?.usableExpectedRows ?? null,
};
const hashes = {
  bundleHash: sha256File(bundlePath),
  evidenceHash: sha256File(evidencePath),
  localRunHash: existsSync(inputPath) ? JSON.parse(readFileSync(inputPath, "utf8")).localRunHash ?? sha256File(inputPath) : null,
  resultHash: (runnerCommand || generateDeterministicResult) && existsSync(resultPath) ? sha256File(resultPath) : null,
};
const output = {
  schemaVersion: "soma-reports.local-prepared-input.v1",
  generatedAt: new Date().toISOString(),
  ok: allStepsOk,
  reportSlug,
  modelInvoked: Boolean(runnerCommand),
  runnerInvoked: Boolean(runnerCommand),
  deterministicResultGenerated: generateDeterministicResult && existsSync(resultPath),
  sourceKind: vcfPath ? "local-vcf-or-gvcf" : "local-qc-summary",
  paths: {
    bundlePath,
    templatePath,
    evidencePath,
    inputPath,
    resultPath: runnerCommand || generateDeterministicResult ? resultPath : null,
    validationPath,
  },
  hashes,
  counts: localCounts,
  generatedFiles: {
    bundle: existsSync(bundlePath),
    evidenceTemplate: existsSync(templatePath),
    derivedEvidence: existsSync(evidencePath),
    preparedInput: existsSync(inputPath),
    agentResult: Boolean(runnerCommand || generateDeterministicResult) && existsSync(resultPath),
    validationLedger: Boolean((runnerCommand || generateDeterministicResult) && saveValidationLedger) && existsSync(validationPath),
    priorAgentResultPresent: !runnerCommand && !generateDeterministicResult && existsSync(resultPath),
    priorValidationLedgerPresent: !runnerCommand && !generateDeterministicResult && existsSync(validationPath),
  },
  readiness: workflowPreflight?.parsed?.readiness ?? null,
  evidenceCounts: workflowPreflight?.parsed?.evidenceCounts ?? null,
  resultCounts: workflowStrict?.parsed?.resultCounts ?? workflowPreflight?.parsed?.resultCounts ?? null,
  nextStep: runnerCommand || generateDeterministicResult
    ? "Review the validated local-agent result and optional ledger."
    : `Run a local JSON runner with: SOMA_LOCAL_RUNNER=/absolute/path/to/local-json-runner; "$SOMA_LOCAL_RUNNER" < ${inputPath} > ${resultPath}`,
  steps,
  privacyBoundary: {
    rawGenomeIncluded: false,
    rawGenomePathPrinted: false,
    localGenomeInputReadOnly: true,
    generatedArtifactsIgnored: true,
    note:
      "The raw local input path is used only as script input and is redacted from wrapper output. Generated files stay under ignored tmp/ paths and contain derived evidence only.",
  },
};

const compact = {
  schemaVersion: output.schemaVersion,
  generatedAt: output.generatedAt,
  ok: output.ok,
  reportSlug,
  modelInvoked: output.modelInvoked,
  runnerInvoked: output.runnerInvoked,
  deterministicResultGenerated: output.deterministicResultGenerated,
  sourceKind: output.sourceKind,
  paths: output.paths,
  hashes: output.hashes,
  counts: output.counts,
  generatedFiles: output.generatedFiles,
  readiness: output.readiness,
  evidenceCounts: output.evidenceCounts,
  resultCounts: output.resultCounts,
  nextStep: output.nextStep,
  steps: steps.map((step) => ({
    name: step.name,
    ok: step.ok,
    exitCode: step.exitCode,
    skipped: step.skipped,
    parsed: step.parsed,
  })),
  privacyBoundary: output.privacyBoundary,
};

console.log(JSON.stringify(format === "compact" ? compact : output, null, 2));
process.exitCode = output.ok ? 0 : 1;
