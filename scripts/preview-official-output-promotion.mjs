#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  slugFromOfficialOutputCapturePath,
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";
import {
  defaultOfficialOutputPromotionReviewPath,
  loadOfficialOutputPromotionReview,
} from "./lib/official-output-promotion-review.mjs";

const blockerLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const officialOutputPromotionReviewPath = defaultOfficialOutputPromotionReviewPath;

const parseArgs = () => {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(arg, next);
      index += 1;
    } else {
      args.set(arg, "true");
    }
  }
  return args;
};

const args = parseArgs();
const capturePath = args.get("--path") ?? args.get("--artifact");
const outPath = args.get("--out") ?? null;
const format = args.get("--format") ?? "json";

if (!capturePath) {
  throw new Error(
    "Usage: npm run scaffold:promotion-preview -- --path reference/catalog/<slug>-official-output-capture-YYYY-MM-DD.json [--format json|md] [--out tmp/promotion-previews/<slug>.json]",
  );
}
if (!["json", "md"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or md`);
}

const asString = (value, fallback = "") =>
  typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : fallback;

const firstString = (row, keys) => {
  for (const key of keys) {
    const value = asString(row?.[key]);
    if (value) {
      return value;
    }
  }
  return "";
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const artifact = readJson(capturePath);
const validation = validateOfficialOutputCaptureArtifact(artifact, {
  path: capturePath,
  expectedSlug: slugFromOfficialOutputCapturePath(capturePath) ?? artifact.slug,
});
const blockerLedger = existsSync(blockerLedgerPath) ? readJson(blockerLedgerPath) : { decisions: [] };
const blockerDecision = (blockerLedger.decisions ?? []).find((decision) => decision.slug === artifact.slug) ?? null;
const ledgerStatus = blockerDecision ? "current-blocker" : "outside-current-blocker-ledger";
const officialOutputPromotionReview = loadOfficialOutputPromotionReview(officialOutputPromotionReviewPath);
const officialOutputPathReview = officialOutputPromotionReview.entriesByPath.get(capturePath) ?? null;
const officialOutputSlugReview = officialOutputPromotionReview.entriesBySlug.get(artifact.slug) ?? null;
const officialOutputReview = officialOutputPathReview ?? (!blockerDecision ? officialOutputSlugReview : null);

const manualProblems = [];
const manualWarnings = [];

if (officialOutputPromotionReview.problems.length > 0) {
  manualProblems.push(
    `official output promotion review artifact has problems: ${officialOutputPromotionReview.problems
      .slice(0, 3)
      .join("; ")}`,
  );
}

if (!validation.ok) {
  manualProblems.push("capture artifact must pass scaffold:validate-captures before promotion preview is usable");
}
if (!validation.rowEvidenceReady) {
  manualProblems.push("capture artifact must expose source-bound sampleRows, covered formalFields, and citationBindings");
}
if (!validation.promotionSafeProvenance) {
  manualProblems.push(
    "capture artifact must be a committed reference/catalog official-output capture with no tmp, smoke, template, placeholder, or dry-run provenance",
  );
}
if (!blockerDecision) {
  if (validation.ok && validation.rowEvidenceReady) {
    manualWarnings.push(
      `capture slug ${
        artifact.slug ?? "(missing)"
      } is outside the current formal evidence blocker ledger; treat this as an already-promoted or non-blocker official-output handoff after promotion verification passes`,
    );
  } else {
    manualProblems.push(`capture slug ${artifact.slug ?? "(missing)"} is not in the current formal evidence blocker ledger`);
  }
}
if (officialOutputReview) {
  manualProblems.push(
    `official output promotion review blocks promotion for ${artifact.slug}: ${officialOutputReview.decision} (${officialOutputReview.reviewClass})`,
  );
}

const asArray = (value) => (Array.isArray(value) ? value : []);
const sourceArtifacts = [...asArray(artifact.sourceArtifacts), ...asArray(artifact.sourceResources)];
const sourceArtifactReferences = sourceArtifacts
  .map((source) =>
    typeof source === "string"
      ? source
      : asString(source?.url ?? source?.href ?? source?.sourceArtifact ?? source?.resourceId ?? source?.id),
  )
  .filter(Boolean);
const sourceArtifactIds = sourceArtifacts.map((source, index) => {
  if (typeof source === "string") {
    return `${artifact.slug}-official-output-${index + 1}`;
  }
  return asString(source.resourceId ?? source.id, `${artifact.slug}-official-output-${index + 1}`);
});

const sourceArtifactResources = sourceArtifacts.map((source, index) => {
  if (typeof source === "string") {
    return {
      resourceId: sourceArtifactIds[index],
      title: `${artifact.title} official output artifact ${index + 1}`,
      url: source,
      sourceType: "official_output_capture",
      theme: "Official Sequencing.com output",
      note: "Sanitized official/sample/completed-output capture used for report structure and row bindings.",
      evidenceLevel: "official-output",
      extractionStatus: "direct",
      scope: "report_specific",
      sourceArtifact: capturePath,
      usedFor: ["sampleRows", "formalFields", "citationBindings"],
    };
  }

  return {
    resourceId: sourceArtifactIds[index],
    title: asString(source.title, `${artifact.title} official output artifact ${index + 1}`),
    url: asString(source.url ?? source.href ?? artifact.captureUrl),
    sourceType: asString(source.sourceType, "official_output_capture"),
    theme: asString(source.theme, "Official Sequencing.com output"),
    note: asString(
      source.note,
      "Sanitized official/sample/completed-output capture used for report structure and row bindings.",
    ),
    evidenceLevel: asString(source.evidenceLevel, "official-output"),
    extractionStatus: "direct",
    scope: "report_specific",
    sourceArtifact: capturePath,
    usedFor: ["sampleRows", "formalFields", "citationBindings"],
  };
});

const knownSourceIds = new Set(sourceArtifactResources.map((resource) => resource.resourceId));
for (const [index, row] of (artifact.sampleRows ?? []).entries()) {
  const sourceIds = row.sourceResourceIds ?? row.sourceIds ?? [];
  for (const sourceId of sourceIds) {
    if (!knownSourceIds.has(sourceId)) {
      manualProblems.push(`sampleRows[${index}] cites source id ${sourceId} that is not listed in sourceArtifacts`);
    }
  }
}

const sampleRowsPreview = (artifact.sampleRows ?? []).map((row, index) => {
  const geneticAnalysis = firstString(row, [
    "geneticAnalysis",
    "analysis",
    "result",
    "value",
    "observedValue",
    "officialValue",
    "summary",
  ]);
  if (!geneticAnalysis) {
    manualProblems.push(`sampleRows[${index}] needs a seed geneticAnalysis/result/value mapping`);
  }

  return {
    sortOrder: Number.isFinite(row.sortOrder) ? row.sortOrder : index + 1,
    groupTitle: firstString(row, ["groupTitle", "section", "category", "table"], "Official output"),
    item: firstString(row, ["item", "label", "rowLabel", "rowId", "observedField"], `Official row ${index + 1}`),
    brandName: firstString(row, ["brandName", "brand"], ""),
    geneticAnalysis,
    description: firstString(row, ["description", "notes", "plainEnglishMeaning"]) || undefined,
    genes: Array.isArray(row.genes) ? row.genes.filter((gene) => typeof gene === "string") : [],
    sourceLabel: firstString(row, ["sourceLabel"], "Official Sequencing.com output"),
    sourceResourceIds: row.sourceResourceIds ?? row.sourceIds ?? [],
    sourceBindingStatus: row.sourceBindingStatus,
    sourceBindingNote: firstString(
      row,
      ["sourceBindingNote"],
      "Bound to commit-safe official sample, export, or completed-output capture.",
    ),
    extractionStatus: "direct",
  };
});

const formalFieldsPreview = (artifact.formalFields ?? []).map((field, index) => ({
  sortOrder: Number.isFinite(field.sortOrder) ? field.sortOrder : index + 1,
  sourceLabel: firstString(field, ["sourceLabel"], "Official Sequencing.com output"),
  observedField: firstString(field, ["observedField", "label", "key"], `officialField${index + 1}`),
  outputPath: firstString(field, ["outputPath", "fieldPath"], `resultRows[].${field.key ?? `field${index + 1}`}`),
  status: field.status === "not_applicable" ? "not_applicable" : "covered",
  notes: firstString(field, ["notes"], "Mapped from commit-safe official-output capture."),
}));

const reportSlug = artifact.slug ?? slugFromOfficialOutputCapturePath(capturePath) ?? "<slug>";
const fixturePath = `fixtures/synthetic/${reportSlug}.fixture.json`;
const resultPath = `fixtures/synthetic/${reportSlug}.result.json`;
const promptPath = `prompts/${reportSlug}.md`;
const formalValidatorCommand = `npm run agent:bundle -- --report ${reportSlug} --fixture ${fixturePath} --result ${resultPath} --validation-mode formal-ready`;
const blockerLedgerUpdate = blockerDecision
  ? [
      {
        path: blockerLedgerPath,
        action:
          "Remove the slug from the formal blocker ledger only after the seed no longer reads as local-scaffold and before formal-ready validation.",
      },
    ]
  : [];
const requiredFileUpdates = [
  {
    path: capturePath,
    action: "Keep the commit-safe official-output capture in reference/catalog after privacy and row-binding validation.",
  },
  {
    path: "convex/reportPackages.ts",
    action:
      "Apply the reviewed seedFragment: official output reference resources, sourceArtifacts, sampleRows, formalFields, citationBindings, and curation completeness.",
  },
  {
    path: promptPath,
    action:
      "Keep the local-agent prompt aligned with the promoted official output structure, plain-English tone, appendix-only probabilities, and privacy boundaries.",
  },
  {
    path: fixturePath,
    action:
      "Regenerate or edit the local fixture so assert-local-artifact-sync sees the same package-local fixture as the Convex seed.",
  },
  {
    path: resultPath,
    action:
      "Regenerate or edit the deterministic result so it preserves official sample-row fingerprints and cites known fixture reference IDs.",
  },
  ...blockerLedgerUpdate,
  {
    path: "reference/catalog/official-output-capture-status.json",
    action:
      "Regenerate with npm run scaffold:capture-status:snapshot so the app no longer presents the slug as a current official-output blocker.",
  },
];
const promotionOrder = blockerDecision
  ? [
      `Validate the capture: npm run scaffold:validate-captures -- --path ${capturePath}`,
      `Review this preview: npm run scaffold:promotion-preview -- --path ${capturePath} --format md`,
      "Apply the seedFragment manually to convex/reportPackages.ts and synchronize prompt, fixture, and deterministic result artifacts.",
      `Run npm run scaffold:promotion-verify -- --path ${capturePath} and confirm the capture fingerprint landed in seed, prompt, fixture, and result artifacts.`,
      "Run npm run readiness:audit:summary and confirm the slug leaves localScaffoldSlugs.",
      "Remove the slug from reference/catalog/sample-promotion-rejections-2026-06-23.json once the seed is no longer local-scaffold.",
      `Run ${formalValidatorCommand}`,
      "Run npm run agent:assert-sync, npm run scaffold:evidence-audit, and npm run completion:audit -- --format compact.",
    ]
  : [
      `Validate the capture: npm run scaffold:validate-captures -- --path ${capturePath}`,
      `Review this preview: npm run scaffold:promotion-preview -- --path ${capturePath} --format md`,
      `Run npm run scaffold:promotion-verify -- --path ${capturePath} and confirm the capture fingerprint landed in seed, prompt, fixture, and result artifacts.`,
      `Run ${formalValidatorCommand}`,
	      "Run npm run agent:assert-sync, npm run scaffold:evidence-audit, and npm run completion:audit -- --format compact.",
    ];
const promotionReady =
  validation.ok &&
  validation.rowEvidenceReady &&
  validation.promotionSafeProvenance &&
  validation.rowEvidencePromotionReady &&
  manualProblems.length === 0;
const blockedPromotionChecklist = {
  blocked: true,
  reason: "Promotion preview is intentionally suppressed until validation, row evidence, provenance, and manual review gates all pass.",
  nextCommands: [`npm run scaffold:validate-captures -- --path ${capturePath}`],
};

const preview = {
  schemaVersion: "soma-reports.official-output-promotion-preview.v1",
  generatedAt: new Date().toISOString(),
  ok: promotionReady,
  capturePath,
  reportSlug,
  title: artifact.title ?? null,
  blockerLedgerPath,
  ledgerStatus,
  blockerDecision,
  validation: {
    ok: validation.ok,
    rowEvidenceReady: validation.rowEvidenceReady,
    rowEvidencePromotionReady: validation.rowEvidencePromotionReady,
    promotionSafeProvenance: validation.promotionSafeProvenance,
    outputSignalReview: validation.outputSignalReview,
    outputSignalReviewCandidate: validation.outputSignalReviewCandidate,
    promotionCandidate: validation.promotionCandidate,
    outputSignals: validation.outputSignals,
    problems: validation.problems,
    warnings: validation.warnings,
  },
  manualReview: {
    officialOutputPromotionReview: {
      path: officialOutputPromotionReview.path,
      present: officialOutputPromotionReview.present,
      blockingEntry: officialOutputReview,
    },
    problems: manualProblems,
    warnings: manualWarnings,
  },
  seedFragment: promotionReady
    ? {
        curationCompletenessPatch: {
          sampleReport: true,
          formalFields: true,
          citationBindings: true,
        },
        sampleReportStatus: "official-output-capture",
        sourceArtifacts: [...new Set([...sourceArtifactReferences, capturePath])],
        references: sourceArtifactResources,
        sampleRows: sampleRowsPreview,
        formalFields: formalFieldsPreview,
        citationBindings: artifact.citationBindings ?? [],
      }
    : null,
  ledgerFollowUp: promotionReady
    ? blockerDecision
      ? {
          removeFromBlockerLedgerOnlyAfter: [
            "convex/reportPackages.ts seed fragment is reviewed and applied",
            "npm run scaffold:evidence-audit reports the slug as output-signal-review before promotion",
            "npm run readiness:audit:summary shows the slug leaving localScaffoldSlugs",
            "npm run agent:validate:formal passes for the promoted slug",
          ],
        }
      : {
          alreadyOutsideBlockerLedger: true,
          requiredVerification: [
            `npm run scaffold:promotion-verify -- --path ${capturePath}`,
            formalValidatorCommand,
            "npm run completion:audit -- --format compact",
          ],
        }
    : null,
  promotionChecklist: promotionReady
    ? {
        requiredFileUpdates,
        promotionOrder,
        formalValidatorCommand,
      }
    : blockedPromotionChecklist,
  verificationCommands: promotionReady
    ? [
        `npm run scaffold:validate-captures -- --path ${capturePath}`,
        `npm run scaffold:promotion-preview -- --path ${capturePath}`,
        `npm run scaffold:promotion-preview -- --path ${capturePath} --format md --out tmp/promotion-previews/${reportSlug}.md`,
        `npm run scaffold:promotion-verify -- --path ${capturePath}`,
        formalValidatorCommand,
        "npm run scaffold:evidence-audit",
        "npm run readiness:audit:summary",
        "npm run agent:validate:formal",
        "npm run completion:audit",
      ]
    : [`npm run scaffold:validate-captures -- --path ${capturePath}`],
};

const renderMarkdown = () => {
  const lines = [
    `# Official Output Promotion Preview: ${preview.title ?? preview.reportSlug}`,
    "",
    `Generated: ${preview.generatedAt}`,
    `Status: ${preview.ok ? "ready for manual seed promotion" : "not ready for promotion"}`,
    `Capture: \`${preview.capturePath}\``,
    `Report slug: \`${preview.reportSlug}\``,
    `Ledger status: \`${preview.ledgerStatus}\``,
    "",
    "## Validation",
    "",
    `- Capture valid: ${preview.validation.ok ? "yes" : "no"}`,
    `- Row-evidence ready: ${preview.validation.rowEvidenceReady ? "yes" : "no"}`,
    `- Promotion-safe provenance: ${preview.validation.promotionSafeProvenance ? "yes" : "no"}`,
    `- Output-signal review: ${preview.validation.outputSignalReview ? "yes" : "no"}`,
    `- Output signals: \`${JSON.stringify(preview.validation.outputSignals)}\``,
    "",
    "## Manual Review Problems",
    "",
    ...(preview.manualReview.problems.length > 0
      ? preview.manualReview.problems.map((problem) => `- ${problem}`)
      : ["- none"]),
    "",
    "## Manual Review Warnings",
    "",
    ...(preview.manualReview.warnings.length > 0
      ? preview.manualReview.warnings.map((warning) => `- ${warning}`)
      : ["- none"]),
    "",
    ...(preview.ok
      ? [
          "## Required File Updates",
          "",
          ...preview.promotionChecklist.requiredFileUpdates.map((item) => `- \`${item.path}\`: ${item.action}`),
          "",
          "## Safe Promotion Order",
          "",
          ...preview.promotionChecklist.promotionOrder.map((step, index) => `${index + 1}. ${step}`),
        ]
      : [
          "## Promotion Checklist",
          "",
          `- ${preview.promotionChecklist.reason}`,
          ...preview.promotionChecklist.nextCommands.map((command) => `- \`${command}\``),
        ]),
    "",
    "## Seed Fragment",
    "",
    ...(preview.seedFragment
      ? ["```json", JSON.stringify(preview.seedFragment, null, 2), "```"]
      : ["Seed fragment suppressed because the capture is not ready for promotion."]),
    "",
    "## Verification Commands",
    "",
    ...preview.verificationCommands.map((command) => `- \`${command}\``),
    "",
  ];

  return `${lines.join("\n").trimEnd()}\n`;
};

const output = format === "md" ? renderMarkdown() : `${JSON.stringify(preview, null, 2)}\n`;
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
} else {
  process.stdout.write(output);
}

if (!preview.ok) {
  process.exit(1);
}
