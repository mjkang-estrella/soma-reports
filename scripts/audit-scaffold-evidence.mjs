#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";
import {
  officialOutputCaptureSchema,
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";
import {
  defaultOfficialOutputPromotionReviewPath,
  loadOfficialOutputPromotionReview,
  officialOutputPromotionReviewFor,
} from "./lib/official-output-promotion-review.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const rejectionLedgerPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const wgsOrderBoundaryLedgerPath = "reference/catalog/wgs-order-route-boundary-ledger-2026-06-23.json";
const publicDraftRouteFallbackLedgerPath = "reference/catalog/public-draft-route-fallback-ledger-2026-06-23.json";
const officialOutputPromotionReviewPath = defaultOfficialOutputPromotionReviewPath;
const reportPackagesPath = "convex/reportPackages.ts";

if (!existsSync(rejectionLedgerPath)) {
  throw new Error(`Missing scaffold blocker ledger at ${rejectionLedgerPath}`);
}

const ledger = readJson(rejectionLedgerPath);
const wgsOrderBoundaryLedger = existsSync(wgsOrderBoundaryLedgerPath) ? readJson(wgsOrderBoundaryLedgerPath) : null;
const publicDraftRouteFallbackLedger = existsSync(publicDraftRouteFallbackLedgerPath)
  ? readJson(publicDraftRouteFallbackLedgerPath)
  : null;
const officialOutputPromotionReview = loadOfficialOutputPromotionReview(officialOutputPromotionReviewPath);
const reportPackagesSource = existsSync(reportPackagesPath) ? readFileSync(reportPackagesPath, "utf8") : "";
const wgsOrderBoundarySlugs = [
  "comprehensive-health-screen-wgs-bundle",
  "expedited-advanced-health-screen-wgs-bundle",
  "ultra-rapid-professional-health-screen-wgs-bundle",
];
const publicDraftRouteFallbackSlugs = [
  "ehlers-danlos-syndrome",
  "marfan-syndrome",
  "mitchell-syndrome",
  "pediatric-health",
];
const normalizeUrl = (value) => (typeof value === "string" ? value.replace(/\/$/, "") : value);

const parseMappedDetailArtifacts = () => {
  const match = reportPackagesSource.match(
    /const authenticatedDetailEvidenceArtifactBySlug: Record<string, string> = \{([\s\S]*?)\n\};/,
  );
  if (!match) {
    return new Map();
  }

  const mapped = new Map();
  const entryPattern =
    /^\s*(?:(?:"([^"]+)")|([A-Za-z_$][\w$]*)):\s*(?:"([^"]+)"\s*,|\n\s*"([^"]+)"\s*,)/gm;
  let entryMatch;
  while ((entryMatch = entryPattern.exec(match[1])) !== null) {
    mapped.set(entryMatch[1] ?? entryMatch[2], entryMatch[3] ?? entryMatch[4]);
  }
  return mapped;
};

const mappedDetailArtifacts = parseMappedDetailArtifacts();
const acceptedDetailArtifactSchemas = new Set([
  "soma-reports.authenticated-detail-evidence.v1",
  officialOutputCaptureSchema,
]);

const localDetailArtifactsFor = (slug) =>
  readdirSync("reference/catalog")
    .filter(
      (file) =>
        (file.startsWith(`${slug}-authenticated-detail-`) ||
          file.startsWith(`${slug}-official-output-capture-`)) &&
        file.endsWith(".json"),
    )
    .map((file) => `reference/catalog/${file}`)
    .sort();

const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const compactText = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

const outputKeyPattern =
  /^(reportFile|sampleRows|sample_rows|resultRows|result_rows|results|findings|generatedOutput|generated_output|mockReport|mock_report|sampleReport|sample_report|formalFields|formal_fields|citationBindings|citation_bindings)$/i;
const weakOutputTextPattern = /\b(sample|mock report|report file|output|result rows?|table|graph|download|pdf)\b/i;
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

const scanOutputSignals = (value, path = "$", signals = []) => {
  if (Array.isArray(value)) {
    if (value.length > 0 && outputKeyPattern.test(path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "")) {
      signals.push({ path, kind: "non-empty-output-array", count: value.length });
    }
    value.forEach((entry, index) => scanOutputSignals(entry, `${path}[${index}]`, signals));
    return signals;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (outputKeyPattern.test(key)) {
        if (isNonEmptyString(entry)) {
          signals.push({ path: childPath, kind: "non-empty-output-string", preview: compactText(entry).slice(0, 160) });
        } else if (Array.isArray(entry) && entry.length > 0) {
          signals.push({ path: childPath, kind: "non-empty-output-array", count: entry.length });
        } else if (entry && typeof entry === "object" && Object.keys(entry).length > 0) {
          signals.push({ path: childPath, kind: "non-empty-output-object", keys: Object.keys(entry).sort() });
        }
      }
      scanOutputSignals(entry, childPath, signals);
    }
  }
  return signals;
};

const detailAuditFor = (path) => {
  if (!existsSync(path)) {
    return {
      path,
      exists: false,
      strongSignals: [],
      weakSignals: [],
      problems: [`missing detail artifact: ${path}`],
    };
  }

  const artifact = readJson(path);
  const strongSignals = [];
  const weakSignals = [];
  const formalFieldNearMissSignals = [];
  const problems = [];
  let officialOutputCaptureValidation = null;

  if (!acceptedDetailArtifactSchemas.has(artifact.schema)) {
    problems.push(
      `detail artifact schema is not one of ${Array.from(acceptedDetailArtifactSchemas).join(", ")}`,
    );
  }
  if (artifact.schema === officialOutputCaptureSchema) {
    officialOutputCaptureValidation = validateOfficialOutputCaptureArtifact(artifact, {
      path,
      expectedSlug: basename(path).replace(/-official-output-capture-\d{4}-\d{2}-\d{2}\.json$/, ""),
    });
    problems.push(
      ...officialOutputCaptureValidation.problems.map(
        (problem) => `official-output-capture ${problem.path}: ${problem.message}`,
      ),
    );
  }

  const canPromoteOutputSignals =
    artifact.schema !== officialOutputCaptureSchema || officialOutputCaptureValidation?.ok === true;

  if (isNonEmptyString(artifact.reportFile)) {
    if (canPromoteOutputSignals) {
      strongSignals.push({ path: "$.reportFile", kind: "non-empty-report-file", value: artifact.reportFile });
    }
  }

  if (canPromoteOutputSignals) {
    for (const signal of scanOutputSignals(artifact)) {
      if (signal.path === "$.reportFile" && signal.kind === "non-empty-output-string") {
        continue;
      }
      strongSignals.push(signal);
    }
  }

  const weakTextFields = [
    ["$.bodyPreview", artifact.bodyPreview],
    ["$.summaryPreview", artifact.summaryPreview],
    ...(Array.isArray(artifact.visibleParagraphs)
      ? artifact.visibleParagraphs.map((paragraph, index) => [`$.visibleParagraphs[${index}]`, paragraph])
      : []),
    ...(Array.isArray(artifact.evidenceNotes)
      ? artifact.evidenceNotes.map((note, index) => [`$.evidenceNotes[${index}]`, note])
      : []),
  ];

  for (const [pathLabel, text] of weakTextFields) {
    const compact = compactText(text);
    if (compact && weakOutputTextPattern.test(compact)) {
      weakSignals.push({ path: pathLabel, kind: "output-language", preview: compact.slice(0, 180) });
    }
    if (compact && formalFieldTextPattern.test(compact)) {
      formalFieldNearMissSignals.push({
        path: pathLabel,
        kind: "formal-field-language",
        fields: extractFormalFieldTerms(compact),
        preview: compact.slice(0, 220),
      });
    }
  }

  return {
    path,
    exists: true,
    title: artifact.title ?? null,
    url: artifact.url ?? null,
    finalUrl: artifact.finalUrl ?? null,
    reportFile: artifact.reportFile ?? null,
    reportDataKeys: artifact.reportDataKeys ?? [],
    officialOutputCaptureValidation,
    strongSignals,
    weakSignals,
    formalFieldNearMissSignals,
    problems,
  };
};

const decisions = ledger.decisions ?? [];
const rows = decisions.map((decision) => {
  const mappedPath = mappedDetailArtifacts.get(decision.slug) ?? null;
  const localPaths = localDetailArtifactsFor(decision.slug);
  const detailPaths = [...new Set([...(mappedPath ? [mappedPath] : []), ...localPaths])];
  const detailAudits = detailPaths.map(detailAuditFor);
  const strongSignals = detailAudits.flatMap((audit) =>
    audit.strongSignals.map((signal) => ({ artifact: audit.path, ...signal })),
  );
  const weakSignals = detailAudits.flatMap((audit) => audit.weakSignals.map((signal) => ({ artifact: audit.path, ...signal })));
  const formalFieldNearMissSignals = detailAudits.flatMap((audit) =>
    audit.formalFieldNearMissSignals.map((signal) => ({ artifact: audit.path, ...signal })),
  );
  const officialOutputReview = officialOutputPromotionReviewFor(
    officialOutputPromotionReview,
    decision.slug,
    detailPaths,
  );
  let verdict = "blocked";
  if (strongSignals.length > 0) {
    if (officialOutputReview?.reviewClass === "reviewed-boundary-only") {
      verdict = "reviewed-boundary-only";
    } else if (officialOutputReview?.reviewClass === "reviewed-promotion-candidate") {
      verdict = "reviewed-no-promote";
    } else {
      verdict = "output-signal-review";
    }
  }

  return {
    slug: decision.slug,
    title: decision.title,
    verdict,
    officialOutputReview,
    blockerDecision: decision.decision,
    blockerReason: decision.reason,
    evidenceStatus: decision.evidenceStatus,
    requiredEvidenceForPromotion: decision.requiredEvidenceForPromotion ?? [],
    mappedDetailArtifact: mappedPath,
    localDetailArtifacts: localPaths,
    reportFileStatus: decision.reportFileStatus ?? null,
    detailAudits,
    strongSignals,
    weakSignals,
    formalFieldNearMissSignals,
  };
});

const candidateRows = rows.filter((row) => row.verdict === "output-signal-review" || row.verdict === "candidate-review");
const reviewedNoPromoteRows = rows.filter((row) => row.verdict === "reviewed-no-promote");
const reviewedBoundaryOnlyRows = rows.filter((row) => row.verdict === "reviewed-boundary-only");
const reviewedMetadataOnlyRows = rows.filter(
  (row) => row.officialOutputReview?.reviewClass === "reviewed-metadata-only",
);
const rawCandidateRows = rows.filter((row) => row.strongSignals.length > 0);
const missingDetailRows = rows.filter((row) => row.localDetailArtifacts.length === 0 && !row.mappedDetailArtifact);
const exactMetadataOnlyRows = rows.filter(
  (row) => row.localDetailArtifacts.length > 0 && row.strongSignals.length === 0,
);
const describedFieldBoundaryRows = rows.filter(
  (row) => row.formalFieldNearMissSignals.length > 0 && row.strongSignals.length === 0,
);
const problems = rows.flatMap((row) =>
  row.detailAudits.flatMap((audit) => audit.problems.map((problem) => `${row.slug}: ${problem}`)),
);
problems.push(...officialOutputPromotionReview.problems);

const validateWgsOrderBoundaryLedger = () => {
  const ledgerProblems = [];
  if (!wgsOrderBoundaryLedger) {
    return {
      rows: [],
      problems: [`missing WGS order-route boundary ledger: ${wgsOrderBoundaryLedgerPath}`],
    };
  }
  if (wgsOrderBoundaryLedger.schemaVersion !== "soma-reports.wgs-order-route-boundary-ledger.v1") {
    ledgerProblems.push("WGS order-route boundary ledger schemaVersion is invalid");
  }
  const boundary = wgsOrderBoundaryLedger.promotionBoundary ?? {};
  for (const key of ["promotesDetailParity", "promotesSampleRows", "promotesFormalFields", "promotesCitationBindings"]) {
    if (boundary[key] !== false) {
      ledgerProblems.push(`WGS order-route boundary ledger promotionBoundary.${key} must be false`);
    }
  }

  const entries = Array.isArray(wgsOrderBoundaryLedger.entries) ? wgsOrderBoundaryLedger.entries : [];
  const entryBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  for (const slug of wgsOrderBoundarySlugs) {
    const entry = entryBySlug.get(slug);
    const decision = decisions.find((candidate) => candidate.slug === slug);
    if (!entry) {
      ledgerProblems.push(`WGS order-route boundary ledger missing ${slug}`);
      continue;
    }
    if (!decision) {
      ledgerProblems.push(`WGS order-route boundary ${slug} has no no-promotion decision`);
    } else {
      if (decision.evidenceStatus !== "card-and-order-evidence-only") {
        ledgerProblems.push(`WGS order-route boundary ${slug} decision must remain card-and-order-evidence-only`);
      }
      const normalizedDecisionSources = new Set((decision.sources ?? []).map(normalizeUrl));
      if (!normalizedDecisionSources.has(normalizeUrl(entry.orderUrl))) {
        ledgerProblems.push(`WGS order-route boundary ${slug} orderUrl is not listed in no-promotion sources`);
      }
    }
    if (entry.finalUrlKind !== "order") {
      ledgerProblems.push(`WGS order-route boundary ${slug} finalUrlKind must be order`);
    }
    if (!/^https:\/\/sequencing\.com\/order\//.test(entry.orderUrl ?? "")) {
      ledgerProblems.push(`WGS order-route boundary ${slug} orderUrl must be a Sequencing.com order URL`);
    }
    if (entry.canonicalSlug !== slug) {
      ledgerProblems.push(`WGS order-route boundary ${slug} canonicalSlug mismatch`);
    }
    if (entry.reportFile !== "" || entry.reportFileStatus !== "empty") {
      ledgerProblems.push(`WGS order-route boundary ${slug} must keep reportFile empty`);
    }
    for (const key of ["promotesDetailParity", "promotesSampleRows", "promotesFormalFields", "promotesCitationBindings"]) {
      if (entry[key] !== false) {
        ledgerProblems.push(`WGS order-route boundary ${slug}.${key} must be false`);
      }
    }
  }

  return {
    rows: entries,
    problems: ledgerProblems,
  };
};

const wgsOrderBoundaryAudit = validateWgsOrderBoundaryLedger();
problems.push(...wgsOrderBoundaryAudit.problems);

const validatePublicDraftRouteFallbackLedger = () => {
  const ledgerProblems = [];
  if (!publicDraftRouteFallbackLedger) {
    return {
      rows: [],
      problems: [`missing public draft route fallback ledger: ${publicDraftRouteFallbackLedgerPath}`],
    };
  }
  if (publicDraftRouteFallbackLedger.schemaVersion !== "soma-reports.public-draft-route-fallback-ledger.v1") {
    ledgerProblems.push("public draft route fallback ledger schemaVersion is invalid");
  }
  const boundary = publicDraftRouteFallbackLedger.promotionBoundary ?? {};
  for (const key of ["promotesDetailParity", "promotesSampleRows", "promotesFormalFields", "promotesCitationBindings"]) {
    if (boundary[key] !== false) {
      ledgerProblems.push(`public draft route fallback ledger promotionBoundary.${key} must be false`);
    }
  }

  const entries = Array.isArray(publicDraftRouteFallbackLedger.entries) ? publicDraftRouteFallbackLedger.entries : [];
  const entryBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  for (const slug of publicDraftRouteFallbackSlugs) {
    const entry = entryBySlug.get(slug);
    const decision = decisions.find((candidate) => candidate.slug === slug);
    if (!entry) {
      ledgerProblems.push(`public draft route fallback ledger missing ${slug}`);
      continue;
    }
    if (!decision) {
      ledgerProblems.push(`public draft route fallback ${slug} has no no-promotion decision`);
    } else {
      if (!String(decision.evidenceStatus ?? "").startsWith("route-fallback-")) {
        ledgerProblems.push(`public draft route fallback ${slug} decision must remain route-fallback-only`);
      }
      const normalizedDecisionSources = new Set((decision.sources ?? []).map(normalizeUrl));
      if (!normalizedDecisionSources.has(normalizeUrl(entry.requestedUrl))) {
        ledgerProblems.push(`public draft route fallback ${slug} requestedUrl is not listed in no-promotion sources`);
      }
    }
    if (entry.finalUrlKind !== "marketplace-index-fallback") {
      ledgerProblems.push(`public draft route fallback ${slug} finalUrlKind must be marketplace-index-fallback`);
    }
    if (normalizeUrl(entry.finalUrl) !== "https://sequencing.com/marketplace") {
      ledgerProblems.push(`public draft route fallback ${slug} finalUrl must be the Sequencing.com marketplace index`);
    }
    if (entry.requestedUrl !== `https://sequencing.com/marketplace/${slug}`) {
      ledgerProblems.push(`public draft route fallback ${slug} requestedUrl mismatch`);
    }
    if (entry.canonical !== "https://sequencing.com/marketplace") {
      ledgerProblems.push(`public draft route fallback ${slug} canonical must be the marketplace index`);
    }
    if (entry.pagePropsReportData !== false) {
      ledgerProblems.push(`public draft route fallback ${slug} must keep pagePropsReportData false`);
    }
    if (entry.reportFile !== null || entry.reportFileStatus !== "none" || entry.sampleRows !== 0) {
      ledgerProblems.push(`public draft route fallback ${slug} must keep reportFile null, reportFileStatus none, and sampleRows 0`);
    }
    for (const key of ["promotesDetailParity", "promotesSampleRows", "promotesFormalFields", "promotesCitationBindings"]) {
      if (entry[key] !== false) {
        ledgerProblems.push(`public draft route fallback ${slug}.${key} must be false`);
      }
    }
  }

  return {
    rows: entries,
    problems: ledgerProblems,
  };
};

const publicDraftRouteFallbackAudit = validatePublicDraftRouteFallbackLedger();
problems.push(...publicDraftRouteFallbackAudit.problems);

const summary = {
  schemaVersion: "soma-reports.scaffold-evidence-audit.v1",
  generatedAt: new Date().toISOString(),
  ok: problems.length === 0,
  ledgerPath: rejectionLedgerPath,
  wgsOrderBoundaryLedgerPath,
  publicDraftRouteFallbackLedgerPath,
  officialOutputPromotionReviewPath,
  scaffoldPackages: rows.length,
  outputSignalReviewRows: rawCandidateRows.length,
  unreviewedOutputSignalReviews: candidateRows.length,
  reviewedOutputSignalNoPromote: reviewedNoPromoteRows.length,
  candidatePromotions: candidateRows.length,
  rawCandidatePromotions: rawCandidateRows.length,
  reviewedNoPromoteCandidates: reviewedNoPromoteRows.length,
  reviewedBoundaryOnlyCaptures: reviewedBoundaryOnlyRows.length,
  reviewedMetadataOnlyTargets: reviewedMetadataOnlyRows.length,
  unreviewedPromotionCandidatePromotions: candidateRows.length,
  missingDetailArtifacts: missingDetailRows.length,
  exactMetadataOnly: exactMetadataOnlyRows.length,
  wgsOrderBoundaryRows: wgsOrderBoundaryAudit.rows.length,
  wgsOrderBoundarySlugs: wgsOrderBoundaryAudit.rows.map((entry) => entry.slug),
  publicDraftRouteFallbackRows: publicDraftRouteFallbackAudit.rows.length,
  publicDraftRouteFallbackSlugs: publicDraftRouteFallbackAudit.rows.map((entry) => entry.slug),
  describedFieldBoundaryRows: describedFieldBoundaryRows.length,
  describedFieldBoundarySlugs: describedFieldBoundaryRows.map((row) => row.slug),
  describedFieldBoundaryRule:
    "Described fields come from marketplace overview/body text or rendered detail text only. They are not promoted to source-backed formal fields without official sample/generated output rows and row-level bindings.",
  weakSignalRows: rows.filter((row) => row.weakSignals.length > 0).length,
  formalFieldNearMissRows: rows.filter((row) => row.formalFieldNearMissSignals.length > 0).length,
  promotionStandard: ledger.promotionStandard ?? [],
  officialOutputPromotionReview: {
    present: officialOutputPromotionReview.present,
    path: officialOutputPromotionReview.path,
    entries: officialOutputPromotionReview.entries.length,
    reviewedPromotionCandidates: officialOutputPromotionReview.entries.filter(
      (entry) => entry.reviewClass === "reviewed-promotion-candidate",
    ).length,
    reviewedBoundaryOnlyCaptures: officialOutputPromotionReview.entries.filter(
      (entry) => entry.reviewClass === "reviewed-boundary-only",
    ).length,
    reviewedMetadataOnlyTargets: officialOutputPromotionReview.entries.filter(
      (entry) => entry.reviewClass === "reviewed-metadata-only",
    ).length,
    problems: officialOutputPromotionReview.problems,
  },
  candidateSlugs: candidateRows.map((row) => row.slug),
  reviewedNoPromoteSlugs: reviewedNoPromoteRows.map((row) => row.slug),
  reviewedBoundaryOnlySlugs: reviewedBoundaryOnlyRows.map((row) => row.slug),
  reviewedMetadataOnlySlugs: reviewedMetadataOnlyRows.map((row) => row.slug),
  rawCandidateSlugs: rawCandidateRows.map((row) => row.slug),
  formalFieldNearMissSlugs: rows
    .filter((row) => row.formalFieldNearMissSignals.length > 0)
    .map((row) => row.slug),
  missingDetailSlugs: missingDetailRows.map((row) => row.slug),
  problems,
  rows,
};

console.log(JSON.stringify(summary, null, 2));

if (problems.length > 0) {
  process.exit(1);
}
