#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

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
const evidencePath = args.get("--evidence");
const bundlePath = args.get("--bundle") ?? (reportSlug ? `tmp/agent-bundles/${reportSlug}.validated.json` : null);
const outPath = args.get("--out") ?? (reportSlug ? `tmp/agent-runs/${reportSlug}.agent-input.json` : null);
const allowPartialEvidence = args.get("--allow-partial") === "true";
const allowEmptyEvidence = args.get("--allow-empty") === "true" || args.get("--allow-unavailable") === "true";
const allowScaffoldOnly =
  args.get("--allow-local-scaffold") === "true" ||
  args.get("--allow-scaffold-only") === "true" ||
  args.get("--allow-scaffold") === "true";

if (!reportSlug || !evidencePath || !bundlePath || !outPath) {
  throw new Error(
    "Usage: npm run agent:prepare -- --report <slug> --evidence <derived-evidence.json> [--bundle tmp/agent-bundles/<slug>.validated.json] [--out tmp/agent-runs/<slug>.agent-input.json] [--allow-partial true] [--allow-empty true] [--allow-local-scaffold true]",
  );
}

if (!existsSync(bundlePath)) {
  throw new Error(`Missing validated bundle at ${bundlePath}. Run npm run agent:export first, or pass --bundle.`);
}

if (!existsSync(evidencePath)) {
  throw new Error(`Missing derived evidence file at ${evidencePath}`);
}

const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const sha256 = (value) => sha256Text(JSON.stringify(value));
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const localRunAgentInstructions = (instructions) =>
  (Array.isArray(instructions) ? instructions : []).filter(
    (instruction) =>
      typeof instruction !== "string" ||
      !instruction.includes("Use fixture.genomeEvidence, fixture.referenceResources, and formalArtifacts as evidence."),
  );
const localRunCustomerFacingEvidenceInstructions = [
  "Mirror every agentRunInput.genomeEvidence[] row in appendix.genotypeSummary[] with observedValue and matchStatus.",
  "When a local observation supplies a usable observedValue, include that observation in a customer-facing result row in plain English; do not leave usable local evidence only in the appendix.",
  "Keep probability, confidence, calibration, and uncertainty out of main findings; use appendix.probabilities: [] when no calibrated source model is supplied.",
];

const evidenceText = readFileSync(evidencePath, "utf8");
const evidenceInput = JSON.parse(evidenceText);
const bundle = readJson(bundlePath);

if (bundle.reportSlug !== reportSlug) {
  throw new Error(`Bundle slug mismatch: expected ${reportSlug}, found ${bundle.reportSlug ?? "unknown"}`);
}

if (!bundle.readiness || typeof bundle.readiness.sampleBackedFormalReady !== "boolean") {
  throw new Error("Bundle is missing readiness metadata. Re-run npm run agent:export and retry agent:prepare.");
}

if (bundle.readiness.localScaffoldOnly === true && !allowScaffoldOnly) {
  const gaps = Array.isArray(bundle.readiness.gaps) ? bundle.readiness.gaps.join(", ") : "formal evidence pending";
  throw new Error(
    [
      `Bundle ${reportSlug} is local-scaffold-only and is not source-backed formal Sequencing.com report output.`,
      `Pending gaps: ${gaps || "formal evidence pending"}.`,
      "Use --allow-local-scaffold true only when intentionally preparing a provisional local schema/reference run.",
    ].join("\n"),
  );
}

const evidenceRows = Array.isArray(evidenceInput) ? evidenceInput : evidenceInput.genomeEvidence;
if (!Array.isArray(evidenceRows)) {
  throw new Error("Derived evidence must be an array or an object with genomeEvidence[]");
}

const rawFieldNames = new Set([
  "bam",
  "bases",
  "cram",
  "fastq",
  "genotypeCalls",
  "rawFileContents",
  "rawGenome",
  "rawGenomeData",
  "rawGenotypeRows",
  "rawVariants",
  "rawLine",
  "reads",
  "sam",
  "sequence",
  "vcf",
  "vcfLine",
]);

const longDnaSequence = /\b[ACGTN]{80,}\b/i;
const vcfHeader = /#CHROM\s+POS\s+ID\s+REF\s+ALT/i;
const vcfRecord =
  /(^|\n)(?:chr)?(?:[0-9]{1,2}|X|Y|M|MT)\t\d+\t[^\t]*\t[ACGTN.]+\t(?:[ACGTN,<>.]+)\t/i;
const fastqShape = /(^|\n)@[^\n]+\n[ACGTN]{20,}\n\+\n[!-~]{20,}/i;
const rawGenomeFileReference = /(?:^|[\s"'(])(?:[~./]|[A-Za-z0-9_-])[\w./~ -]*\.(?:bam|cram|fastq|fq|gvcf|sam|vcf)(?:\.gz)?(?=$|[\s"',)])/i;

const validateNoRawGenomeLeakage = (value, rootPath) => {
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (isPlainObject(node)) {
      for (const [key, entry] of Object.entries(node)) {
        const childPath = `${path}.${key}`;
        if (rawFieldNames.has(key)) {
          privacyProblems.push(`${childPath} looks like raw genome data`);
        }
        visit(entry, childPath);
      }
      return;
    }
    if (typeof node !== "string") {
      return;
    }
    if (vcfHeader.test(node) || vcfRecord.test(node) || fastqShape.test(node) || longDnaSequence.test(node)) {
      privacyProblems.push(`${path} contains raw-sequence-like content`);
    }
    if (rawGenomeFileReference.test(node)) {
      privacyProblems.push(`${path} points at a raw genome file; use a derived-evidence manifest label instead`);
    }
  };

  visit(value, rootPath);
};

const privacyProblems = [];
const normalizedRows = evidenceRows.map((row, index) => {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    privacyProblems.push(`genomeEvidence[${index}] must be an object`);
    return row;
  }

  validateNoRawGenomeLeakage(row, `genomeEvidence[${index}]`);

  for (const key of ["inputId", "gene", "observedValue", "assembly", "matchStatus"]) {
    if (typeof row[key] !== "string" || row[key].trim().length === 0) {
      privacyProblems.push(`genomeEvidence[${index}].${key} must be a non-empty string`);
    }
  }

  return {
    inputId: row.inputId,
    ...(typeof row.rsid === "string" ? { rsid: row.rsid } : {}),
    ...(typeof row.starAllele === "string" ? { starAllele: row.starAllele } : {}),
    ...(typeof row.haplotype === "string" ? { haplotype: row.haplotype } : {}),
    ...(typeof row.chrom === "string" ? { chrom: row.chrom } : {}),
    ...(typeof row.contig === "string" ? { contig: row.contig } : {}),
    ...(Number.isFinite(row.pos) ? { pos: row.pos } : {}),
    ...(Number.isFinite(row.position) ? { position: row.position } : {}),
    gene: row.gene,
    observedValue: row.observedValue,
    assembly: row.assembly,
    matchStatus: row.matchStatus,
    ...(typeof row.sourceFile === "string" ? { sourceFile: basename(row.sourceFile) } : {}),
    ...(typeof row.sourceArtifact === "string" ? { sourceArtifact: row.sourceArtifact } : {}),
    ...(isPlainObject(row.derivation) ? { derivation: row.derivation } : {}),
  };
});

if (evidenceInput?.inputManifest?.rawGenomeReturned === true) {
  privacyProblems.push("inputManifest.rawGenomeReturned must not be true for local-agent payloads");
}

if (privacyProblems.length > 0) {
  throw new Error(`Derived evidence failed local privacy checks:\n- ${privacyProblems.join("\n- ")}`);
}

const fixtureEvidence = bundle.fixture?.genomeEvidence ?? [];
const expectedInputIds = new Set(fixtureEvidence.map((row) => row.inputId).filter(Boolean));
const expectedRsids = new Set(fixtureEvidence.map((row) => row.rsid).filter(Boolean));
const expectedGenes = new Set(fixtureEvidence.map((row) => row.gene).filter(Boolean));
const suppliedInputIds = new Set(normalizedRows.map((row) => row.inputId).filter(Boolean));
const suppliedRsids = new Set(normalizedRows.map((row) => row.rsid).filter(Boolean));
const suppliedGenes = new Set(normalizedRows.map((row) => row.gene).filter(Boolean));
const intersect = (left, right) => [...left].filter((value) => right.has(value)).sort();
const usableMatchStatuses = new Set(["observed", "observed_record_no_genotype", "reference_block_covered"]);
const isExpectedRow = (row) =>
  expectedInputIds.has(row.inputId) || (typeof row.rsid === "string" && expectedRsids.has(row.rsid));

const integrityProblems = [];
normalizedRows.forEach((row, index) => {
  if (row.matchStatus === "sample_pdf_match") {
    integrityProblems.push(`genomeEvidence[${index}].matchStatus looks like copied sample fixture evidence`);
  }
  if (typeof row.sourceFile === "string" && /synthetic/i.test(row.sourceFile)) {
    integrityProblems.push(`genomeEvidence[${index}].sourceFile points at the synthetic fixture`);
  }
  if (
    typeof row.sourceArtifact === "string" &&
    /(?:synthetic|sample[_-]?report|reference\/sources\/.*\.pdf|\.pdf$)/i.test(row.sourceArtifact)
  ) {
    integrityProblems.push(`genomeEvidence[${index}].sourceArtifact looks like sample or synthetic fixture evidence`);
  }
});

if (integrityProblems.length > 0) {
  throw new Error(`Derived evidence failed local integrity checks:\n- ${integrityProblems.join("\n- ")}`);
}

const expectedRows = normalizedRows.filter(isExpectedRow);
const usableExpectedRows = expectedRows.filter((row) => usableMatchStatuses.has(row.matchStatus));

const inputManifest = {
  hash: sha256Text(evidenceText),
  genomeBuild:
    evidenceInput?.inputManifest?.genomeBuild ??
    normalizedRows.find((row) => typeof row.assembly === "string" && row.assembly.trim())?.assembly ??
    "derived-local",
  rawGenomeReturned: false,
  source: evidenceInput?.inputManifest?.source ?? basename(evidencePath),
};

const evidenceReview = {
  schemaVersion: "soma-reports.local-evidence-review.v1",
  derivedEvidenceRows: normalizedRows.length,
  expectedFixtureRows: fixtureEvidence.length,
  partialEvidenceAllowed: allowPartialEvidence,
  emptyEvidenceAllowed: allowEmptyEvidence,
  scaffoldOnlyAllowed: allowScaffoldOnly,
  usableExpectedRows: usableExpectedRows.length,
  matchedInputIds: intersect(expectedInputIds, suppliedInputIds),
  matchedRsids: intersect(expectedRsids, suppliedRsids),
  matchedGenes: intersect(expectedGenes, suppliedGenes),
  unmatchedExpectedInputIds: [...expectedInputIds].filter((value) => !suppliedInputIds.has(value)).sort(),
  unmatchedExpectedRsids: [...expectedRsids].filter((value) => !suppliedRsids.has(value)).sort(),
  suppliedGenesOutsideFixture: [...suppliedGenes].filter((value) => !expectedGenes.has(value)).sort(),
  note:
    "Template-row matching is strict by default. The local agent must use supplied derived evidence only and mark unsupported report fields unavailable.",
};

const missingTemplateEvidence = [
  ...evidenceReview.unmatchedExpectedInputIds.map((value) => `inputId:${value}`),
  ...evidenceReview.unmatchedExpectedRsids.map((value) => `rsid:${value}`),
];

if (!allowPartialEvidence && missingTemplateEvidence.length > 0) {
  throw new Error(
    [
      "Derived evidence does not cover the expected template rows for this report.",
      `Missing: ${missingTemplateEvidence.join(", ")}`,
      "Use --allow-partial true only when intentionally preparing an incomplete local run.",
    ].join("\n"),
  );
}

if (!allowEmptyEvidence && expectedInputIds.size + expectedRsids.size > 0 && usableExpectedRows.length === 0) {
  throw new Error(
    [
      "Derived evidence has no usable local observations for the expected template rows.",
      "Use --allow-empty true only when intentionally preparing an all-unavailable local run.",
    ].join("\n"),
  );
}

const agentRunInput = {
  ...bundle.agentRunInput,
  inputManifest,
  genomeEvidence: normalizedRows,
  evidenceReview,
  reportPurpose: bundle.agentRunInput?.reportPurpose ?? bundle.fixture?.reportPurpose,
  missingInputPolicy: bundle.agentRunInput?.missingInputPolicy ?? bundle.fixture?.missingInputPolicy,
  consumerTone: bundle.agentRunInput?.consumerTone ?? bundle.fixture?.consumerTone,
};

const scaffoldBoundary =
  bundle.readiness.localScaffoldOnly === true
    ? {
        allowed: allowScaffoldOnly,
        sampleBackedFormalReady: false,
        localScaffoldOnly: true,
        usageBoundary: bundle.readiness.usageBoundary,
        gaps: bundle.readiness.gaps ?? [],
        formalEvidenceBlocker: bundle.readiness.formalEvidenceBlocker ?? null,
        warning:
          "This payload is a provisional local prompt/schema run only; it is not source-backed Sequencing.com formal sample evidence.",
      }
    : {
        allowed: false,
        sampleBackedFormalReady: bundle.readiness.sampleBackedFormalReady,
        localScaffoldOnly: false,
        usageBoundary: bundle.readiness.usageBoundary,
        gaps: bundle.readiness.gaps ?? [],
      };

const payload = {
  schemaVersion: "soma-reports.local-agent-run-input.v1",
  generatedAt: new Date().toISOString(),
  reportSlug,
  bundlePath,
  evidencePath,
  bundleHash: bundle.bundleHash,
  localRunHash: sha256(agentRunInput),
  readiness: bundle.readiness,
  scaffoldBoundary,
  privacyBoundary: {
    rawGenomeIncluded: false,
    derivedEvidenceOnly: true,
    uploadRequired: false,
    rawGenomePolicy:
      "This file is safe to hand to a local agent because it contains only derived evidence rows and no VCF/gVCF/FASTQ/BAM/CRAM records.",
  },
  prompt: bundle.prompt,
  outputValidation: bundle.outputValidation,
  formalArtifacts: bundle.formalArtifacts,
  agentRunInput,
  agentInstructions: [
    ...localRunAgentInstructions(bundle.agentInstructions),
    "Use agentRunInput.genomeEvidence as the user's local derived evidence; do not use fixture.genomeEvidence as user evidence.",
    ...localRunCustomerFacingEvidenceInstructions,
    "If a required variant, model output, clinical context, or formal sample row is absent from agentRunInput.genomeEvidence, mark that result unavailable.",
    ...(bundle.readiness.localScaffoldOnly
      ? [
          "This is a local-scaffold-only package. Do not claim Sequencing.com sample parity, source-backed formal readiness, or official generated output.",
        ]
      : []),
  ],
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      reportSlug,
      outPath,
      bundlePath,
      derivedEvidenceRows: normalizedRows.length,
      matchedInputIds: evidenceReview.matchedInputIds.length,
      matchedRsids: evidenceReview.matchedRsids.length,
      matchedGenes: evidenceReview.matchedGenes.length,
      usableExpectedRows: evidenceReview.usableExpectedRows,
      unmatchedExpectedInputIds: evidenceReview.unmatchedExpectedInputIds.length,
      unmatchedExpectedRsids: evidenceReview.unmatchedExpectedRsids.length,
      partialEvidenceAllowed: allowPartialEvidence,
      emptyEvidenceAllowed: allowEmptyEvidence,
      scaffoldOnlyAllowed: allowScaffoldOnly,
      scaffoldBoundary,
      localRunHash: payload.localRunHash,
      rawGenomeIncluded: false,
      readiness: {
        evidenceStatus: bundle.readiness?.evidenceStatus,
        sampleBackedFormalReady: bundle.readiness?.sampleBackedFormalReady,
        localScaffoldOnly: bundle.readiness?.localScaffoldOnly,
      },
    },
    null,
    2,
  ),
);
