#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";
import {
  defaultOfficialOutputPromotionReviewPath,
  loadOfficialOutputPromotionReview,
  officialOutputPromotionReviewFor,
} from "./lib/official-output-promotion-review.mjs";

const ledgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const wgsOrderBoundaryLedgerPath = "reference/catalog/wgs-order-route-boundary-ledger-2026-06-23.json";
const publicDraftRouteFallbackLedgerPath = "reference/catalog/public-draft-route-fallback-ledger-2026-06-23.json";
const officialOutputPromotionReviewPath = defaultOfficialOutputPromotionReviewPath;
const authenticatedBlockerDetailInspectionPath =
  "reference/catalog/authenticated-blocker-detail-inspection-2026-06-24.json";
const authenticatedMarketplaceNormalizedPath =
  "reference/catalog/sequencing-authenticated-marketplace-normalized-2026-06-21.json";
const authenticatedMissingDetailRouteProbePrefix = "authenticated-missing-detail-route-probe-";
const publicWgsBundleEvidencePrefix = "public-wgs-bundle-evidence-";
const scaffoldAuditScriptPath = "scripts/audit-scaffold-evidence.mjs";
const detailArtifactDirectory = "reference/catalog";
const captureTemplateDirectory = "tmp/capture-templates";
const expectedCaptureSchema = "soma-reports.official-output-capture.v1";
const acceptedCaptureSchemas = [
  "soma-reports.authenticated-detail-evidence.v1",
  expectedCaptureSchema,
];

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
const format = args.get("--format") ?? "json";
const outPath = args.get("--out") ?? null;
const targetClass = args.get("--class") ?? "all";

if (!["json", "md", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json, md, or compact`);
}

if (!["all", "missing-exact-detail", "metadata-only"].includes(targetClass)) {
  throw new Error(`Unsupported --class ${targetClass}; expected all, missing-exact-detail, or metadata-only`);
}

const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
const decisions = Array.isArray(ledger.decisions) ? ledger.decisions : [];
const catalogFiles = readdirSync(detailArtifactDirectory);
const latestCatalogPathFor = (prefix) => {
  const latestFile = catalogFiles
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"))
    .sort()
    .at(-1);
  return latestFile ? `${detailArtifactDirectory}/${latestFile}` : null;
};
const officialOutputPromotionReview = loadOfficialOutputPromotionReview(officialOutputPromotionReviewPath);
const authenticatedBlockerDetailInspection = existsSync(authenticatedBlockerDetailInspectionPath)
  ? JSON.parse(readFileSync(authenticatedBlockerDetailInspectionPath, "utf8"))
  : null;
const authenticatedBlockerDetailInspectionBySlug = new Map(
  (authenticatedBlockerDetailInspection?.targets ?? []).map((target) => [target.slug, target]),
);
const authenticatedMissingDetailRouteProbePath = latestCatalogPathFor(authenticatedMissingDetailRouteProbePrefix);
const authenticatedMissingDetailRouteProbe = authenticatedMissingDetailRouteProbePath
  ? JSON.parse(readFileSync(authenticatedMissingDetailRouteProbePath, "utf8"))
  : null;
const authenticatedMissingDetailRouteProbeBySlug = new Map(
  (authenticatedMissingDetailRouteProbe?.entries ?? []).map((entry) => [entry.slug, entry]),
);
const publicWgsBundleEvidencePath = latestCatalogPathFor(publicWgsBundleEvidencePrefix);
const publicWgsBundleEvidence = publicWgsBundleEvidencePath
  ? JSON.parse(readFileSync(publicWgsBundleEvidencePath, "utf8"))
  : null;
const publicWgsBundleEvidenceBySlug = new Map(
  (publicWgsBundleEvidence?.entries ?? []).map((entry) => [entry.slug, entry]),
);
const authenticatedMarketplaceNormalized = existsSync(authenticatedMarketplaceNormalizedPath)
  ? JSON.parse(readFileSync(authenticatedMarketplaceNormalizedPath, "utf8"))
  : null;
const authenticatedMarketplacePositionsByCanonicalSlug = new Map();
for (const position of authenticatedMarketplaceNormalized?.positionLedger?.positions ?? []) {
  const canonicalSlug = position.canonicalSlug ?? position.slug ?? null;
  if (!canonicalSlug) {
    continue;
  }
  if (!authenticatedMarketplacePositionsByCanonicalSlug.has(canonicalSlug)) {
    authenticatedMarketplacePositionsByCanonicalSlug.set(canonicalSlug, []);
  }
  authenticatedMarketplacePositionsByCanonicalSlug.get(canonicalSlug).push(position);
}
const publicSlugsNotSeenInAuthenticatedCapture = new Set(
  authenticatedMarketplaceNormalized?.publicSlugsNotSeenInAuthenticatedCapture ?? [],
);
const orderAliasSlugsByCanonicalSlug = new Map();
for (const [orderSlug, canonicalSlug] of Object.entries(authenticatedMarketplaceNormalized?.orderSlugAliases ?? {})) {
  if (!orderAliasSlugsByCanonicalSlug.has(canonicalSlug)) {
    orderAliasSlugsByCanonicalSlug.set(canonicalSlug, []);
  }
  orderAliasSlugsByCanonicalSlug.get(canonicalSlug).push(orderSlug);
}

const highValueOrder = [
  "sequencing-depth-and-coverage",
  "genome-explorer-dna-data-search",
  "convert-rsids-coordinates",
  "imputation-analysis",
  "variant-effect-predictor",
  "variant-discovery-bioinformatics-secondary-analysis",
  "genome-short-read-mapper",
  "promethease",
  "whole-genome-sequencing-30x",
  "comprehensive-health-screen-wgs-bundle",
  "expedited-advanced-health-screen-wgs-bundle",
  "ultra-rapid-professional-health-screen-wgs-bundle",
];
const highValueRank = new Map(highValueOrder.map((slug, index) => [slug, index + 1]));

const externalSource = (decision) => decision.sources?.find((source) => /^https?:\/\//i.test(source)) ?? null;
const compactText = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const uniqueStrings = (values) => [
  ...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)),
];

const evidenceClassFor = (decision) =>
  String(decision.evidenceStatus ?? "").startsWith("route-fallback") ||
  decision.evidenceStatus === "card-and-order-evidence-only"
    ? "missing-exact-detail"
    : "metadata-only";

const actionFor = (evidenceClass) =>
  evidenceClass === "missing-exact-detail"
    ? "Capture the exact authenticated detail route, then look for an official sample/completed output artifact."
    : "Capture an official Sequencing.com sample, mock report, completed result, non-empty reportFile, or export for this exact package.";

const sourceCoverageFor = (decision) => {
  const authenticatedPositions = authenticatedMarketplacePositionsByCanonicalSlug.get(decision.slug) ?? [];
  const publicCatalogOnly = publicSlugsNotSeenInAuthenticatedCapture.has(decision.slug);
  const sourceUrl = externalSource(decision);
  const sourceClass = authenticatedPositions.some((position) => position.kind === "order")
    ? "authenticated-order-alias"
    : authenticatedPositions.length > 0
      ? "authenticated-position"
      : publicCatalogOnly
        ? "public-only"
        : "unknown";
  const labels = {
    "authenticated-order-alias": "Authenticated order alias inside 164-position marketplace",
    "authenticated-position": "Authenticated marketplace position inside 164-position capture",
    "public-only": "Public catalog only; not seen in authenticated 164-position capture",
    unknown: "Not classified in current authenticated/public catalog snapshot",
  };
  const boundary =
    sourceClass === "authenticated-order-alias"
      ? "The package is represented by an authenticated order-card alias, but formal promotion still requires official completed-output rows and source bindings."
      : sourceClass === "authenticated-position"
        ? "The package appears in the authenticated marketplace card capture, but formal promotion still requires official completed-output rows and source bindings."
        : sourceClass === "public-only"
          ? "The package exists in the public catalog ledger but was not present in the authenticated 164-position marketplace capture; do not keep probing authenticated exact routes unless new source evidence appears."
          : "The package source is not classified by the current catalog snapshots; inspect source evidence before capture.";

  return {
    class: sourceClass,
    label: labels[sourceClass],
    sourceCatalogPath: authenticatedMarketplaceNormalized ? authenticatedMarketplaceNormalizedPath : null,
    sourceUrl,
    authenticatedMarketplacePositionTotal:
      authenticatedMarketplaceNormalized?.totals?.authenticatedCardPositions ?? null,
    namedIdentityTotal: authenticatedMarketplaceNormalized?.totals?.namedIdentityTotal ?? null,
    publicCatalogOnly,
    authenticatedPositionCount: authenticatedPositions.length,
    authenticatedPositionNumbers: authenticatedPositions.map((position) => position.positionNumber).filter(Boolean),
    authenticatedGroupLabels: uniqueStrings(authenticatedPositions.map((position) => position.groupLabel)),
    authenticatedKinds: uniqueStrings(authenticatedPositions.map((position) => position.kind)),
    authenticatedHrefs: uniqueStrings(authenticatedPositions.map((position) => position.href)),
    orderAliasSlugs: orderAliasSlugsByCanonicalSlug.get(decision.slug) ?? [],
    boundary,
  };
};

const artifactPathFor = (slug) => `reference/catalog/${slug}-official-output-capture-YYYY-MM-DD.json`;
const captureTemplatePathFor = (slug) =>
  `${captureTemplateDirectory}/${slug}-official-output-capture-template.json`;
const templateCommandFor = (slug) =>
  `npm run scaffold:capture-template -- --report ${slug} --out ${captureTemplatePathFor(slug)}`;
const redactionInputPathFor = (slug) =>
  `.soma/private/official-output-redactions/${slug}-redaction-input.json`;
const redactionTemplateCommandFor = (slug) => `npm run scaffold:redaction-template -- --report ${slug}`;
const sanitizeRedactionCommandFor = (slug) =>
  `npm run scaffold:sanitize-output -- --input ${redactionInputPathFor(slug)}`;
const promotionPreviewCommandFor = (slug) =>
  `npm run scaffold:promotion-preview -- --path reference/catalog/${slug}-official-output-capture-YYYY-MM-DD.json`;
const promotionPreviewCommandForPath = (path) => `npm run scaffold:promotion-preview -- --path ${path}`;
const validateCaptureCommandForPath = (path) => `npm run scaffold:validate-captures -- --path ${path}`;

const formalFieldTextPattern =
  /\b(each row|columns? such as|columns? include|fields? include|search by|provides information on a position|graph and table|average, maximum, and minimum depth|depth for your entire genome|broken down by each chromosome|truly sequenced at 30x)\b/i;
const formalFieldListPatterns = [
  /\bcolumns? (?:such as|include|including)\s+([^.;]+)/gi,
  /\bfields? (?:such as|include|including)\s+([^.;]+)/gi,
  /\bsearch by\s+([^.;]+)/gi,
];

const extractFormalFieldTerms = (text) => {
  const terms = [];
  for (const pattern of formalFieldListPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fragment = match[1].split(/\b(?:when|if|where)\b/i)[0];
      for (const term of fragment.replace(/\s+and\s+/gi, ", ").split(",")) {
        const cleaned = term.trim().replace(/^(?:and|or)\s+/i, "");
        if (cleaned.length > 0 && cleaned.length <= 48) {
          terms.push(cleaned);
        }
      }
    }
  }
  if (
    /\b(depth|coverage)\b/i.test(text) &&
    /\b(graph|table|average|maximum|minimum|chromosome|30x)\b/i.test(text)
  ) {
    terms.push("scope", "chromosome", "averageDepth", "maximumDepth", "minimumDepth", "thirtyXDepthCheck");
  }
  return [...new Set(terms)];
};

const fieldLabelAliases = new Map([
  ["reference", "ref"],
  ["alternate allele", "alt"],
  ["user data", "your data"],
  ["status", "your status"],
]);

const normalizedFieldLabel = (label) => {
  const normalized = label.replace(/\W+/g, " ").trim().toLowerCase();
  return fieldLabelAliases.get(normalized) ?? normalized;
};

const uniqueFieldLabels = (labels) => {
  const seen = new Set();
  const unique = [];
  for (const label of labels) {
    const compact = compactText(label);
    if (!compact) {
      continue;
    }
    const key = normalizedFieldLabel(compact);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(compact);
  }
  return unique;
};

const currentDetailArtifactsFor = (slug) =>
  catalogFiles
    .filter(
      (file) =>
        (file.startsWith(`${slug}-authenticated-detail-`) ||
          file.startsWith(`${slug}-official-output-capture-`)) &&
        file.endsWith(".json"),
    )
    .map((file) => `${detailArtifactDirectory}/${file}`)
    .sort();

const currentOfficialOutputCaptureArtifactsFor = (slug) =>
  catalogFiles
    .filter((file) => file.startsWith(`${slug}-official-output-capture-`) && file.endsWith(".json"))
    .map((file) => `${detailArtifactDirectory}/${file}`)
    .sort();

const validateOfficialOutputCapturePath = (path, slug) => {
  let artifact;
  try {
    artifact = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      ok: false,
      path,
      slug,
      problems: [{ path: "$", message: error instanceof Error ? error.message : String(error) }],
      warnings: [],
      outputSignals: {},
      rowEvidenceReady: false,
      promotionSafeProvenance: false,
      outputSignalReview: false,
      outputSignalReviewCandidate: false,
      rowEvidencePromotionReady: false,
      promotionCandidate: false,
    };
  }

  return validateOfficialOutputCaptureArtifact(artifact, {
    path,
    expectedSlug: slug,
  });
};

const captureWorkflowFor = ({
  slug,
  currentOfficialOutputCaptureArtifacts,
  officialOutputCaptureValidations,
  officialOutputReview,
}) => {
  const readyValidation = officialOutputCaptureValidations.find(
    (validation) => validation.rowEvidencePromotionReady ?? (validation.rowEvidenceReady && validation.promotionSafeProvenance),
  );
  if (readyValidation) {
    return {
      stage: "row-evidence-ready",
      nextAction:
        "Run the promotion preview, review the seed fragment, then edit Convex package data only after manual review.",
      nextCommand: promotionPreviewCommandForPath(readyValidation.path),
    };
  }

  const invalidValidation = officialOutputCaptureValidations.find((validation) => !validation.ok);
  if (invalidValidation) {
    return {
      stage: "capture-needs-rework",
      nextAction:
        "Fix the commit-safe official-output capture until validation passes with source-bound rows and fields.",
      nextCommand: validateCaptureCommandForPath(invalidValidation.path),
    };
  }

  if (officialOutputReview) {
    const stage =
      officialOutputReview.reviewClass === "reviewed-boundary-only"
        ? "reviewed-boundary-only"
        : officialOutputReview.reviewClass === "reviewed-metadata-only"
          ? "reviewed-metadata-only"
          : "reviewed-no-promote";
    return {
      stage,
      nextAction:
        stage === "reviewed-metadata-only"
          ? "Reviewed current sources remain metadata-only. Start a private-output redaction input only after an official completed output or non-private sample/export is available."
          : "Reviewed capture remains boundary-only. Start a private-output redaction input only when you can preserve official non-private rows and source bindings.",
      nextCommand: redactionTemplateCommandFor(slug),
    };
  }

  const candidateValidation = officialOutputCaptureValidations.find(
    (validation) => validation.outputSignalReview ?? validation.promotionCandidate,
  );
  if (candidateValidation) {
    return {
      stage: "output-signal-review",
      nextAction:
        "Review the capture because it has output-shape signals, but do not run a promotion preview until validation reports rowEvidenceReady: true.",
      nextCommand: validateCaptureCommandForPath(candidateValidation.path),
    };
  }

  const templatePath = captureTemplatePathFor(slug);
  if (existsSync(templatePath)) {
    return {
      stage: "template-ready",
      nextAction:
        "Fill the public capture template from a non-private official source, or fill an ignored private redaction input from completed output and commit only the reviewed commit-safe capture.",
      nextCommand: redactionTemplateCommandFor(slug),
    };
  }

  if (currentOfficialOutputCaptureArtifacts.length === 0) {
    return {
      stage: "template-needed",
      nextAction:
        "Generate a local capture template, then use the authenticated Sequencing.com page or completed report output to fill it.",
      nextCommand: templateCommandFor(slug),
    };
  }

  return {
    stage: "blocked",
    nextAction: "Inspect the capture artifacts manually; no automated next step was inferred.",
    nextCommand: validateCaptureCommandForPath(artifactPathFor(slug)),
  };
};

const describedOutputFieldSignalsFor = (artifactPath) => {
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const fieldDefinitionLabels = Array.isArray(artifact.fieldDefinitions)
    ? artifact.fieldDefinitions.map((field) => compactText(field?.label)).filter(Boolean)
    : [];
  const fieldDefinitionSignals =
    fieldDefinitionLabels.length > 0
      ? [
          {
            artifact: artifactPath,
            path: "$.fieldDefinitions[]",
            fields: uniqueFieldLabels(fieldDefinitionLabels),
            preview: uniqueFieldLabels(fieldDefinitionLabels).join(", "),
          },
        ]
      : [];
  const fields = [
    ["$.bodyPreview", artifact.bodyPreview],
    ["$.summaryPreview", artifact.summaryPreview],
    ...(Array.isArray(artifact.visibleParagraphs)
      ? artifact.visibleParagraphs.map((paragraph, index) => [`$.visibleParagraphs[${index}]`, paragraph])
      : []),
    ...(Array.isArray(artifact.evidenceNotes)
      ? artifact.evidenceNotes.map((note, index) => [`$.evidenceNotes[${index}]`, note])
      : []),
  ];

  const textSignals = fields.flatMap(([path, text]) => {
    const compact = compactText(text);
    if (!compact || !formalFieldTextPattern.test(compact)) {
      return [];
    }
    return [
      {
        artifact: artifactPath,
        path,
        fields: extractFormalFieldTerms(compact),
        preview: compact.slice(0, 220),
      },
    ];
  });

  return [...fieldDefinitionSignals, ...textSignals];
};

const acceptanceCriteriaFor = (decision) => [
  `Artifact is official Sequencing.com output for exact package slug ${decision.slug}.`,
  `Sanitized capture uses schema ${expectedCaptureSchema}; legacy authenticated detail captures are also audited when they expose strong output signals.`,
  "Artifact exposes generated report rows, a sample/mock report body, a non-empty reportFile, formal result table, or completed package export.",
  "Captured fields are sufficient to map sampleRows[], formalFields[], and citationBindings[] for this package.",
  "Marketing copy, order pages, public education pages, generic detail metadata, and sibling samples remain non-promotional.",
  "If the artifact comes from a personal completed run, keep full private output outside the repo and commit only sanitized field structure and row-level source bindings.",
  "After capture, npm run scaffold:evidence-audit must report this package as candidate-review before any readiness promotion.",
];

const validationCommands = [
  "npm run scaffold:validate-captures",
  "npm run scaffold:evidence-audit",
  "npm run readiness:audit:summary",
  "npm run agent:validate:all",
];

const liveDetailInspectionFor = (slug) => {
  const target = authenticatedBlockerDetailInspectionBySlug.get(slug);
  if (!target) {
    return null;
  }

  return {
    slug: target.slug,
    inspectedAt: target.inspectedAt ?? null,
    requestedUrl: target.requestedUrl ?? null,
    finalUrl: target.finalUrl ?? null,
    exactRoute: Boolean(target.exactRoute),
    routeKind: target.routeKind ?? null,
    pageTitle: target.pageTitle ?? null,
    startButtonText: target.startButtonText ?? "",
    apiAppId: target.apiAppId ?? null,
    appBackend: target.appBackend ?? null,
    appLabel: target.appLabel ?? null,
    productId: target.productId ?? null,
    price: target.price ?? "",
    reportFile: target.reportFile ?? "",
    scriptSignals: target.scriptSignals ?? {},
    privacyBoundary: target.privacyBoundary ?? authenticatedBlockerDetailInspection?.privacyBoundary ?? "",
  };
};

const latestRouteProbeFor = (slug) => {
  const entry = authenticatedMissingDetailRouteProbeBySlug.get(slug);
  if (!entry) {
    return null;
  }

  return {
    slug: entry.slug,
    capturedAt: authenticatedMissingDetailRouteProbe?.capturedAt ?? null,
    artifactPath: authenticatedMissingDetailRouteProbePath,
    requestedUrl: entry.requestedUrl ?? null,
    finalUrl: entry.finalUrl ?? null,
    finalUrlKind: entry.finalUrlKind ?? null,
    documentTitle: entry.documentTitle ?? "",
    h1: entry.h1 ?? "",
    pagePropsReportData: Boolean(entry.pagePropsReportData),
    reportTitle: entry.reportTitle ?? null,
    reportUri: entry.reportUri ?? null,
    reportFile: entry.reportFile ?? null,
    productId: entry.productId ?? null,
    appId: entry.appId ?? null,
    startButtonText: entry.startButtonText ?? "",
    notFound: Boolean(entry.notFound),
    promotesDetailParity: Boolean(entry.promotesDetailParity),
    promotesSampleRows: Boolean(entry.promotesSampleRows),
    promotesFormalFields: Boolean(entry.promotesFormalFields),
    promotesCitationBindings: Boolean(entry.promotesCitationBindings),
    privacyBoundary: authenticatedMissingDetailRouteProbe?.privacyBoundary ?? "",
    promotionBoundary: authenticatedMissingDetailRouteProbe?.promotionBoundary ?? null,
  };
};

const publicBundleEvidenceFor = (slug) => {
  const entry = publicWgsBundleEvidenceBySlug.get(slug);
  if (!entry) {
    return null;
  }

  return {
    slug: entry.slug,
    capturedAt: publicWgsBundleEvidence?.capturedAt ?? null,
    artifactPath: publicWgsBundleEvidencePath,
    evidenceUse: entry.evidenceUse ?? "",
    sourceIds: Array.isArray(entry.sourceIds) ? entry.sourceIds : [],
    evidencePresent: Array.isArray(entry.evidencePresent) ? entry.evidencePresent : [],
    evidenceMissingForPromotion: Array.isArray(entry.evidenceMissingForPromotion)
      ? entry.evidenceMissingForPromotion
      : [],
    promotionBoundary: publicWgsBundleEvidence?.promotionBoundary ?? null,
  };
};

const targets = decisions
  .map((decision) => {
    const evidenceClass = evidenceClassFor(decision);
    const currentOfficialOutputCaptureArtifacts = currentOfficialOutputCaptureArtifactsFor(decision.slug);
    const officialOutputCaptureValidations = currentOfficialOutputCaptureArtifacts.map((path) =>
      validateOfficialOutputCapturePath(path, decision.slug),
    );
    const officialOutputReview = officialOutputPromotionReviewFor(
      officialOutputPromotionReview,
      decision.slug,
      currentOfficialOutputCaptureArtifacts,
    );
    const captureTemplatePath = captureTemplatePathFor(decision.slug);
    const captureWorkflow = captureWorkflowFor({
      slug: decision.slug,
      currentOfficialOutputCaptureArtifacts,
      officialOutputCaptureValidations,
      officialOutputReview,
    });
    return {
      slug: decision.slug,
      title: decision.title,
      priority: highValueRank.get(decision.slug) ?? 100 + decisions.indexOf(decision),
      evidenceClass,
      action: actionFor(evidenceClass),
      captureUrl: externalSource(decision),
      sourceCoverage: sourceCoverageFor(decision),
      currentEvidenceStatus: decision.evidenceStatus,
      routeBehavior: decision.routeBehavior,
      reportFileStatus: decision.reportFileStatus,
      currentSampleRows: decision.sampleRows,
      currentDetailArtifacts: currentDetailArtifactsFor(decision.slug),
      liveDetailInspection: liveDetailInspectionFor(decision.slug),
      latestRouteProbe: latestRouteProbeFor(decision.slug),
      publicBundleEvidence: publicBundleEvidenceFor(decision.slug),
      currentOfficialOutputCaptureArtifacts,
      officialOutputPromotionReview: officialOutputReview,
      officialOutputCaptureValidations,
      officialOutputCaptureStatus: {
        captures: currentOfficialOutputCaptureArtifacts.length,
        valid: officialOutputCaptureValidations.filter((validation) => validation.ok).length,
        invalid: officialOutputCaptureValidations.filter((validation) => !validation.ok).length,
        rowEvidenceReady: officialOutputCaptureValidations.filter((validation) => validation.rowEvidenceReady).length,
        rowEvidencePromotionReady: officialOutputCaptureValidations.filter(
          (validation) => validation.rowEvidencePromotionReady,
        ).length,
        promotionSafeProvenance: officialOutputCaptureValidations.filter((validation) => validation.promotionSafeProvenance)
          .length,
        outputSignalReviews: officialOutputCaptureValidations.filter(
          (validation) => validation.outputSignalReview ?? validation.promotionCandidate,
        ).length,
        promotionCandidates: officialOutputCaptureValidations.filter((validation) => validation.promotionCandidate).length,
      },
      requiredEvidenceForPromotion: decision.requiredEvidenceForPromotion ?? [],
      expectedSanitizedArtifactPath: artifactPathFor(decision.slug),
      redactionInputPath: redactionInputPathFor(decision.slug),
      redactionTemplateCommand: redactionTemplateCommandFor(decision.slug),
      sanitizeRedactionCommand: sanitizeRedactionCommandFor(decision.slug),
      captureTemplatePath,
      captureTemplateExists: existsSync(captureTemplatePath),
      captureWorkflow,
      templateCommand: templateCommandFor(decision.slug),
      promotionPreviewCommand: promotionPreviewCommandFor(decision.slug),
      validationCommandForExpectedCapture: validateCaptureCommandForPath(artifactPathFor(decision.slug)),
      expectedCaptureSchema,
      acceptedCaptureSchemas,
      acceptanceCriteria: acceptanceCriteriaFor(decision),
      nonPromotionBoundary: ledger.promotionStandard ?? [],
      validationCommands,
      currentSources: decision.sources ?? [],
    };
  })
  .map((target) => {
    const describedOutputFieldSignals = target.currentDetailArtifacts.flatMap(describedOutputFieldSignalsFor);
    const structuredOutputFieldSignals = describedOutputFieldSignals.filter(
      (signal) => signal.path === "$.fieldDefinitions[]",
    );
    const textOutputFieldSignals = describedOutputFieldSignals.filter(
      (signal) => signal.path !== "$.fieldDefinitions[]",
    );
    return {
      ...target,
      describedOutputFieldSignals,
      describedOutputFields: uniqueFieldLabels([
        ...structuredOutputFieldSignals.flatMap((signal) => signal.fields),
        ...textOutputFieldSignals.flatMap((signal) => signal.fields),
      ]),
      describedOutputFieldBoundary:
        describedOutputFieldSignals.length > 0
          ? "Official detail text describes possible columns/fields, but these remain output-shape hints until official sample/export rows and row-level bindings are captured."
          : null,
    };
  })
  .filter((target) => targetClass === "all" || target.evidenceClass === targetClass)
  .sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));

const sourceCoverageCounts = targets.reduce((counts, target) => {
  const sourceClass = target.sourceCoverage?.class ?? "unknown";
  counts[sourceClass] = (counts[sourceClass] ?? 0) + 1;
  return counts;
}, {});

const plan = {
  schemaVersion: "soma-reports.evidence-capture-plan.v1",
  generatedAt: new Date().toISOString(),
  sourceLedger: ledgerPath,
  purpose:
    "Prioritized capture checklist for the scaffold-only packages that need official Sequencing.com output evidence before promotion.",
  sourceData: {
    blockerLedger: ledgerPath,
    wgsOrderBoundaryLedger: wgsOrderBoundaryLedgerPath,
    publicDraftRouteFallbackLedger: publicDraftRouteFallbackLedgerPath,
    officialOutputPromotionReview: officialOutputPromotionReviewPath,
    authenticatedMarketplaceNormalized: authenticatedMarketplaceNormalizedPath,
    authenticatedBlockerDetailInspection: authenticatedBlockerDetailInspectionPath,
    authenticatedMissingDetailRouteProbe: authenticatedMissingDetailRouteProbePath,
    publicWgsBundleEvidence: publicWgsBundleEvidencePath,
    scaffoldAuditScript: scaffoldAuditScriptPath,
    detailArtifactDirectory,
    captureTemplateDirectory,
    acceptedCaptureSchemas,
  },
  baselineAuditExpectation: {
    command: "npm run scaffold:evidence-audit",
    scaffoldPackages: decisions.length,
    candidatePromotions: 0,
  },
  catalogSnapshot: ledger.catalogSnapshot,
  promotionStandard: ledger.promotionStandard,
  privacyBoundary:
    "Do not commit raw genome files or private completed-report payloads. Commit sanitized official/sample output structure only.",
  totals: {
    targets: targets.length,
    allScaffoldPackages: decisions.length,
    missingExactDetailTargets: targets.filter((target) => target.evidenceClass === "missing-exact-detail").length,
    metadataOnlyTargets: targets.filter((target) => target.evidenceClass === "metadata-only").length,
    sourceCoverageCounts,
    authenticatedPositionTargets: sourceCoverageCounts["authenticated-position"] ?? 0,
    authenticatedOrderAliasTargets: sourceCoverageCounts["authenticated-order-alias"] ?? 0,
    publicOnlyTargets: sourceCoverageCounts["public-only"] ?? 0,
    unknownSourceCoverageTargets: sourceCoverageCounts.unknown ?? 0,
    captureTemplatesPresent: targets.filter((target) => target.captureTemplateExists).length,
    officialOutputCaptureArtifacts: targets.reduce(
      (count, target) => count + target.currentOfficialOutputCaptureArtifacts.length,
      0,
    ),
    invalidOfficialOutputCaptureArtifacts: targets.reduce(
      (count, target) => count + target.officialOutputCaptureStatus.invalid,
      0,
    ),
    rowEvidenceReadyTargets: targets.filter(
      (target) =>
        target.officialOutputCaptureStatus.rowEvidenceReady > 0 &&
        target.officialOutputCaptureStatus.promotionSafeProvenance > 0,
    ).length,
    outputSignalReviewTargets: targets.filter((target) => target.officialOutputCaptureStatus.outputSignalReviews > 0).length,
    promotionCandidateTargets: targets.filter((target) => target.officialOutputCaptureStatus.promotionCandidates > 0).length,
    rowEvidencePromotionReadyTargets: targets.filter(
      (target) => target.officialOutputCaptureStatus.rowEvidencePromotionReady > 0,
    ).length,
    reviewedNoPromoteTargets: targets.filter(
      (target) => target.officialOutputPromotionReview?.reviewClass === "reviewed-promotion-candidate",
    ).length,
    reviewedBoundaryOnlyTargets: targets.filter(
      (target) => target.officialOutputPromotionReview?.reviewClass === "reviewed-boundary-only",
    ).length,
    reviewedMetadataOnlyTargets: targets.filter(
      (target) => target.officialOutputPromotionReview?.reviewClass === "reviewed-metadata-only",
    ).length,
    unreviewedPromotionCandidateTargets: targets.filter(
      (target) =>
        target.officialOutputCaptureStatus.promotionCandidates > 0 && !target.officialOutputPromotionReview,
    ).length,
    unreviewedOutputSignalReviewTargets: targets.filter(
      (target) =>
        target.officialOutputCaptureStatus.outputSignalReviews > 0 && !target.officialOutputPromotionReview,
    ).length,
    liveDetailInspectionTargets: targets.filter((target) => target.liveDetailInspection).length,
    liveDetailInspectionExactRoutes: targets.filter((target) => target.liveDetailInspection?.exactRoute).length,
    liveDetailInspectionApiAppIds: targets.filter((target) => target.liveDetailInspection?.apiAppId).length,
    liveDetailInspectionReportFiles: targets.filter((target) => target.liveDetailInspection?.reportFile).length,
    latestRouteProbeTargets: targets.filter((target) => target.latestRouteProbe).length,
    latestRouteProbeReportData: targets.filter((target) => target.latestRouteProbe?.pagePropsReportData).length,
    latestRouteProbeNotFound: targets.filter((target) => target.latestRouteProbe?.notFound).length,
    latestRouteProbeFallbacks: targets.filter(
      (target) => target.latestRouteProbe?.finalUrlKind === "marketplace-index-fallback",
    ).length,
    publicBundleEvidenceTargets: targets.filter((target) => target.publicBundleEvidence).length,
  },
  officialOutputPromotionReview: {
    present: officialOutputPromotionReview.present,
    path: officialOutputPromotionReview.path,
    entries: officialOutputPromotionReview.entries.length,
    problems: officialOutputPromotionReview.problems,
  },
  targets,
};

const renderMarkdown = () => {
  const lines = [
    "# SomaReports Evidence Capture Plan",
    "",
    `Generated: ${plan.generatedAt}`,
    `Source ledger: \`${plan.sourceLedger}\``,
    "",
    `Targets: ${plan.totals.targets} (${plan.totals.missingExactDetailTargets} exact-route, ${plan.totals.metadataOnlyTargets} output-artifact)`,
    `Source coverage: ${plan.totals.authenticatedPositionTargets} authenticated positions; ${plan.totals.authenticatedOrderAliasTargets} authenticated order aliases; ${plan.totals.publicOnlyTargets} public-only; ${plan.totals.unknownSourceCoverageTargets} unknown`,
    `Templates present: ${plan.totals.captureTemplatesPresent}; official captures: ${plan.totals.officialOutputCaptureArtifacts}; row-evidence ready: ${plan.totals.rowEvidenceReadyTargets}`,
    `Reviewed no-promote: ${plan.totals.reviewedNoPromoteTargets}; reviewed boundary-only: ${plan.totals.reviewedBoundaryOnlyTargets}; reviewed metadata-only: ${plan.totals.reviewedMetadataOnlyTargets}; unreviewed output-signal reviews: ${plan.totals.unreviewedOutputSignalReviewTargets}`,
    "",
    "## Promotion Standard",
    "",
    ...plan.promotionStandard.map((standard) => `- ${standard}`),
    "",
    "## Targets",
    "",
  ];

  for (const target of plan.targets) {
    lines.push(
      `### ${target.priority}. ${target.title}`,
      "",
      `- Slug: \`${target.slug}\``,
      `- Class: \`${target.evidenceClass}\``,
      `- Current status: \`${target.currentEvidenceStatus}\`; report file: \`${target.reportFileStatus}\`; sample rows: ${target.currentSampleRows}`,
      `- Source coverage: ${target.sourceCoverage.label}; positions: ${
        target.sourceCoverage.authenticatedPositionNumbers.length > 0
          ? target.sourceCoverage.authenticatedPositionNumbers.join(", ")
          : "none"
      }`,
      `- Capture URL: ${target.captureUrl ?? "not available"}`,
      `- Live route: ${
        target.liveDetailInspection
          ? `${target.liveDetailInspection.exactRoute ? "exact" : "fallback"}; app ID: ${
              target.liveDetailInspection.apiAppId ?? "none"
            }; start action: ${target.liveDetailInspection.startButtonText || "unknown"}`
          : "not inspected"
      }`,
      `- Latest route probe: ${
        target.latestRouteProbe
          ? `${target.latestRouteProbe.finalUrlKind}; reportData: ${
              target.latestRouteProbe.pagePropsReportData ? "yes" : "no"
            }; artifact: ${target.latestRouteProbe.artifactPath}`
          : "not probed"
      }`,
      `- Public bundle evidence: ${
        target.publicBundleEvidence
          ? `${target.publicBundleEvidence.evidenceUse}; artifact: ${target.publicBundleEvidence.artifactPath}`
          : "none"
      }`,
      `- Action: ${target.action}`,
      `- Expected schema: \`${target.expectedCaptureSchema}\``,
      `- Sanitized artifact path: \`${target.expectedSanitizedArtifactPath}\``,
      `- Capture stage: \`${target.captureWorkflow.stage}\``,
      `- Capture template: \`${target.captureTemplatePath}\` (${target.captureTemplateExists ? "present" : "missing"})`,
      `- Official captures: ${target.currentOfficialOutputCaptureArtifacts.length}`,
      `- Row-evidence ready captures: ${target.officialOutputCaptureStatus.rowEvidenceReady}`,
      `- Official-output review: ${
        target.officialOutputPromotionReview
          ? `${target.officialOutputPromotionReview.decision} (${target.officialOutputPromotionReview.reviewClass})`
          : "none"
      }`,
      `- Template command: \`${target.templateCommand}\``,
      `- Next command: \`${target.captureWorkflow.nextCommand}\``,
      `- Next action: ${target.captureWorkflow.nextAction}`,
      `- Promotion preview command: \`${
        target.officialOutputCaptureStatus.rowEvidencePromotionReady > 0 && !target.officialOutputPromotionReview
          ? target.promotionPreviewCommand
          : "hidden until rowEvidencePromotionReady is true and no manual review block is present"
      }\``,
      `- Current detail artifacts: ${
        target.currentDetailArtifacts.length > 0 ? target.currentDetailArtifacts.map((path) => `\`${path}\``).join(", ") : "none"
      }`,
      `- Officially described fields: ${
        target.describedOutputFields.length > 0 ? target.describedOutputFields.map((field) => `\`${field}\``).join(", ") : "none"
      }`,
      "- Required evidence:",
      ...target.requiredEvidenceForPromotion.map((evidence) => `  - ${evidence}`),
      "- Acceptance criteria:",
      ...target.acceptanceCriteria.map((criterion) => `  - ${criterion}`),
      "",
    );
  }

  return `${lines.join("\n").trimEnd()}\n`;
};

const renderCompact = () =>
  `${JSON.stringify(
    {
      schemaVersion: plan.schemaVersion,
      generatedAt: plan.generatedAt,
      sourceLedger: plan.sourceLedger,
      totals: plan.totals,
      baselineAuditExpectation: plan.baselineAuditExpectation,
      privacyBoundary: plan.privacyBoundary,
      promotionStandard: plan.promotionStandard,
      sourceData: plan.sourceData,
      targets: plan.targets.map((target) => ({
        slug: target.slug,
        title: target.title,
        priority: target.priority,
        evidenceClass: target.evidenceClass,
        currentEvidenceStatus: target.currentEvidenceStatus,
        routeBehavior: target.routeBehavior,
        reportFileStatus: target.reportFileStatus,
        currentSampleRows: target.currentSampleRows,
        captureUrl: target.captureUrl,
        sourceCoverage: target.sourceCoverage,
        captureTemplatePath: target.captureTemplatePath,
        captureTemplateExists: target.captureTemplateExists,
        redactionInputPath: target.redactionInputPath,
        redactionTemplateCommand: target.redactionTemplateCommand,
        sanitizeRedactionCommand: target.sanitizeRedactionCommand,
        expectedSanitizedArtifactPath: target.expectedSanitizedArtifactPath,
        captureWorkflow: {
          stage: target.captureWorkflow.stage,
          nextAction: target.captureWorkflow.nextAction,
          nextCommand: target.captureWorkflow.nextCommand,
        },
        officialOutputCaptureStatus: target.officialOutputCaptureStatus,
        officialOutputPromotionReview: target.officialOutputPromotionReview
          ? {
              decision: target.officialOutputPromotionReview.decision,
              reviewClass: target.officialOutputPromotionReview.reviewClass,
              reviewedAt: target.officialOutputPromotionReview.reviewedAt,
            }
          : null,
        liveDetailInspection: target.liveDetailInspection
          ? {
              exactRoute: Boolean(target.liveDetailInspection.exactRoute),
              routeKind: target.liveDetailInspection.routeKind ?? null,
              apiAppId: target.liveDetailInspection.apiAppId ?? null,
              startButtonText: target.liveDetailInspection.startButtonText ?? "",
              reportFile: target.liveDetailInspection.reportFile ?? null,
            }
          : null,
        latestRouteProbe: target.latestRouteProbe
          ? {
              finalUrlKind: target.latestRouteProbe.finalUrlKind ?? null,
              pagePropsReportData: Boolean(target.latestRouteProbe.pagePropsReportData),
              notFound: Boolean(target.latestRouteProbe.notFound),
              artifactPath: target.latestRouteProbe.artifactPath ?? null,
            }
          : null,
        publicBundleEvidence: target.publicBundleEvidence
          ? {
              evidenceUse: target.publicBundleEvidence.evidenceUse,
              artifactPath: target.publicBundleEvidence.artifactPath,
            }
          : null,
        describedOutputFields: target.describedOutputFields,
        describedOutputFieldBoundary: target.describedOutputFieldBoundary,
        requiredEvidenceForPromotion: target.requiredEvidenceForPromotion,
        acceptanceCriteria: target.acceptanceCriteria,
      })),
    },
    null,
    2,
  )}\n`;

const output = format === "json" ? `${JSON.stringify(plan, null, 2)}\n` : format === "compact" ? renderCompact() : renderMarkdown();

if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, output);
} else {
  process.stdout.write(output);
}
