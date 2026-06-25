#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename } from "node:path";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const coveragePath = "reference/catalog/sequencing-marketplace-coverage.json";
const publicCatalogPath = "reference/catalog/sequencing-public-marketplace-catalog.json";
const normalizedAuthenticatedPath = "reference/catalog/sequencing-authenticated-marketplace-normalized-2026-06-21.json";
const authenticatedCardsPath = "reference/catalog/sequencing-authenticated-marketplace-cards-2026-06-21.json";
const authenticatedPagePropsPath = "reference/catalog/sequencing-authenticated-marketplace-pageprops-2026-06-21.json";
const samplePromotionRejectionsPath = "reference/catalog/sample-promotion-rejections-2026-06-23.json";
const reportPackagesPath = "convex/reportPackages.ts";

const slugsForFiles = (dir, suffix) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => file.endsWith(suffix))
        .map((file) => basename(file, suffix))
        .sort()
    : [];

const coverage = readJson(coveragePath);
const publicCatalog = readJson(publicCatalogPath);
const normalizedAuthenticated = readJson(normalizedAuthenticatedPath);
const authenticatedCards = readJson(authenticatedCardsPath);
const authenticatedPageProps = readJson(authenticatedPagePropsPath);
const samplePromotionRejections = existsSync(samplePromotionRejectionsPath)
  ? readJson(samplePromotionRejectionsPath)
  : null;
const reportPackagesSource = readFileSync(reportPackagesPath, "utf8");

const expectedOrderSlugAliases = {
  "comprehensive-wgs-health-screen-bundle": "comprehensive-health-screen-wgs-bundle",
  "expedited-advanced-wgs-health-screen-bundle": "expedited-advanced-health-screen-wgs-bundle",
  "ultra-rapid-professional-wgs-health-screen-bundle": "ultra-rapid-professional-health-screen-wgs-bundle",
};
const authenticatedOnlySlugAliases = normalizedAuthenticated.orderSlugAliases ?? expectedOrderSlugAliases;

const canonicalAuthenticatedSlug = (slug) => authenticatedOnlySlugAliases[slug] ?? slug;

const publicSlugs = new Set((publicCatalog.catalog ?? []).map((entry) => entry.slug));
const authenticatedPagePropsItems = authenticatedPageProps.groups.flatMap((group) => group.items);
const authenticatedCardItems = authenticatedCards.pages.flatMap((page) => page.cards);
const authenticatedOnlyNamedSlugs = new Set([
  ...(normalizedAuthenticated.authenticatedMarketplaceSlugsNotInPublicCatalog ?? []),
  ...(normalizedAuthenticated.uniqueOrderSlugs ?? []).map(canonicalAuthenticatedSlug),
]);
const namedSlugs = [...new Set([...publicSlugs, ...authenticatedOnlyNamedSlugs])].sort();
const namedSlugSet = new Set(namedSlugs);
const placeholderSlugs = [...(coverage.unidentifiedSlots ?? [])].sort();

const promptSlugs = new Set(slugsForFiles("prompts", ".md"));
const fixtureSlugs = new Set(slugsForFiles("fixtures/synthetic", ".fixture.json"));
const resultSlugs = new Set(slugsForFiles("fixtures/synthetic", ".result.json"));

const missingArtifacts = namedSlugs
  .map((slug) => ({
    slug,
    prompt: promptSlugs.has(slug),
    fixture: fixtureSlugs.has(slug),
    result: resultSlugs.has(slug),
  }))
  .filter((entry) => !entry.prompt || !entry.fixture || !entry.result);

const extraArtifacts = {
  prompts: [...promptSlugs].filter((slug) => !namedSlugs.includes(slug) && !placeholderSlugs.includes(slug)).sort(),
  fixtures: [...fixtureSlugs].filter((slug) => !namedSlugs.includes(slug) && !placeholderSlugs.includes(slug)).sort(),
  results: [...resultSlugs].filter((slug) => !namedSlugs.includes(slug) && !placeholderSlugs.includes(slug)).sort(),
};

const placeholderArtifacts = placeholderSlugs
  .map((slug) => ({
    slug,
    prompt: promptSlugs.has(slug),
    fixture: fixtureSlugs.has(slug),
    result: resultSlugs.has(slug),
  }))
	  .filter((entry) => entry.prompt || entry.fixture || entry.result);

const orderUrlFromSlug = (slug) => `https://sequencing.com/order/${slug}`;
const capturedOrderUrls = new Set([
  ...(normalizedAuthenticated.uniqueOrderSlugs ?? []).map(orderUrlFromSlug),
  ...authenticatedCardItems.map((card) => card.href).filter((href) => href?.startsWith("https://sequencing.com/order/")),
  ...authenticatedPagePropsItems
    .map((item) => item.url || item.href || item.link || (item.uri ? `https://sequencing.com/${item.uri}` : ""))
    .filter((href) => href?.startsWith("https://sequencing.com/order/")),
]);
const ledgerOrderUrlProblems = (samplePromotionRejections?.decisions ?? [])
  .flatMap((decision) =>
    (decision.sources ?? [])
      .filter((source) => typeof source === "string" && source.startsWith("https://sequencing.com/order/"))
      .map((url) => ({ slug: decision.slug, url })),
  )
  .filter(({ url }) => !capturedOrderUrls.has(url));

const parseAuthenticatedDetailArtifacts = () => {
  const match = reportPackagesSource.match(
    /const authenticatedDetailEvidenceArtifactBySlug: Record<string, string> = \{([\s\S]*?)\n\};/,
  );
  if (!match) {
    return { entries: [], parseErrors: ["authenticatedDetailEvidenceArtifactBySlug map was not found"] };
  }

  const entries = [];
  const parseErrors = [];
  const entryPattern =
    /^\s*(?:(?:"([^"]+)")|([A-Za-z_$][\w$]*)):\s*(?:"([^"]+)"\s*,|\n\s*"([^"]+)"\s*,)/gm;
  let entryMatch;
  while ((entryMatch = entryPattern.exec(match[1])) !== null) {
    entries.push({
      slug: entryMatch[1] ?? entryMatch[2],
      path: entryMatch[3] ?? entryMatch[4],
    });
  }

  if (entries.length === 0) {
    parseErrors.push("authenticatedDetailEvidenceArtifactBySlug map did not contain parseable entries");
  }

  return { entries, parseErrors };
};

const { entries: authenticatedDetailArtifacts, parseErrors: detailArtifactParseErrors } =
  parseAuthenticatedDetailArtifacts();
const detailArtifactProblems = [...detailArtifactParseErrors];
const detailArtifactSlugs = new Set();
const detailArtifactPaths = new Set();

for (const { slug, path } of authenticatedDetailArtifacts) {
  const expectedUrl = `https://sequencing.com/marketplace/${slug}`;
  const expectedUri = `marketplace/${slug}`;

  if (detailArtifactSlugs.has(slug)) {
    detailArtifactProblems.push(`${slug}: duplicate authenticated detail slug mapping`);
  }
  detailArtifactSlugs.add(slug);

  if (detailArtifactPaths.has(path)) {
    detailArtifactProblems.push(`${slug}: duplicate authenticated detail artifact path ${path}`);
  }
  detailArtifactPaths.add(path);

  if (!existsSync(path)) {
    detailArtifactProblems.push(`${slug}: mapped authenticated detail artifact is missing at ${path}`);
    continue;
  }

  let artifact;
  try {
    artifact = readJson(path);
  } catch (error) {
    detailArtifactProblems.push(`${slug}: mapped authenticated detail artifact is not valid JSON (${error.message})`);
    continue;
  }

  if (artifact.schema !== "soma-reports.authenticated-detail-evidence.v1") {
    detailArtifactProblems.push(`${slug}: detail artifact schema mismatch`);
  }
  if (artifact.url !== expectedUrl) {
    detailArtifactProblems.push(`${slug}: detail artifact url must be ${expectedUrl}`);
  }
  if (artifact.finalUrl !== expectedUrl) {
    detailArtifactProblems.push(`${slug}: detail artifact finalUrl must be the exact report page, not a redirect`);
  }
  if (artifact.uri !== expectedUri) {
    detailArtifactProblems.push(`${slug}: detail artifact uri must be ${expectedUri}`);
  }
}

const ledgerSnapshotProblems = [];
if (samplePromotionRejections?.catalogSnapshot) {
  const snapshot = samplePromotionRejections.catalogSnapshot;
  const snapshotExpectations = [
    ["authenticatedMarketplacePositions", coverage.targetTotal],
    ["identifiedNamedPackages", namedSlugs.length],
    ["authenticatedUniqueHrefs", normalizedAuthenticated.totals.authenticatedUniqueHrefs],
    ["authenticatedDuplicateCardPositions", normalizedAuthenticated.totals.authenticatedDuplicateCardPositions],
    ["authenticatedPagePropsItems", normalizedAuthenticated.totals.authenticatedPagePropsItems],
    ["authenticatedDetailArtifacts", authenticatedDetailArtifacts.length],
    ["formalPendingPackages", samplePromotionRejections.decisions.length],
  ];

  for (const [key, expected] of snapshotExpectations) {
    if (snapshot[key] !== expected) {
      ledgerSnapshotProblems.push({ key, expected, actual: snapshot[key] });
    }
  }
}

const formalBlockerLedgerProblems = [];
const formalBlockerDecisionCounts = new Map();
for (const decision of samplePromotionRejections?.decisions ?? []) {
  const slug = decision?.slug;
  if (typeof slug !== "string" || slug.trim().length === 0) {
    formalBlockerLedgerProblems.push("formal blocker decision is missing slug");
    continue;
  }

  formalBlockerDecisionCounts.set(slug, (formalBlockerDecisionCounts.get(slug) ?? 0) + 1);

  if (!namedSlugSet.has(slug)) {
    formalBlockerLedgerProblems.push(`${slug}: formal blocker decision does not map to a named package`);
  }
  if (decision.decision !== "keep-local-scaffold") {
    formalBlockerLedgerProblems.push(`${slug}: formal blocker decision must be keep-local-scaffold`);
  }
  if (decision.sampleRows !== 0) {
    formalBlockerLedgerProblems.push(`${slug}: formal blocker decision sampleRows must stay 0`);
  }
  if (typeof decision.reason !== "string" || decision.reason.trim().length === 0) {
    formalBlockerLedgerProblems.push(`${slug}: formal blocker decision needs a reason`);
  }
  if (!Array.isArray(decision.requiredEvidenceForPromotion) || decision.requiredEvidenceForPromotion.length === 0) {
    formalBlockerLedgerProblems.push(`${slug}: formal blocker decision needs requiredEvidenceForPromotion`);
  }
  if (!Array.isArray(decision.sources) || decision.sources.length === 0) {
    formalBlockerLedgerProblems.push(`${slug}: formal blocker decision needs sources`);
    continue;
  }

  for (const source of decision.sources) {
    if (typeof source === "string" && source.startsWith("reference/") && !existsSync(source)) {
      formalBlockerLedgerProblems.push(`${slug}: formal blocker source is missing at ${source}`);
    }
  }

  if (typeof decision.evidenceStatus === "string" && decision.evidenceStatus.startsWith("exact-")) {
    const mappedDetailPath = authenticatedDetailArtifacts.find((entry) => entry.slug === slug)?.path;
    if (!mappedDetailPath || !decision.sources.includes(mappedDetailPath)) {
      formalBlockerLedgerProblems.push(`${slug}: exact formal blocker decision must cite its mapped detail artifact`);
    }
  }
}

for (const [slug, count] of formalBlockerDecisionCounts.entries()) {
  if (count > 1) {
    formalBlockerLedgerProblems.push(`${slug}: duplicate formal blocker decisions`);
  }
}

const expectedNamedTotal = coverage.counts.publicUrlDistinct + coverage.counts.authenticatedOnlyNamed;
const expectedTargetTotal = coverage.counts.authenticatedStructuredCardPositions;
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

assert(coverage.targetTotal === expectedTargetTotal, "coverage targetTotal must equal authenticated structured card positions");
assert(
  coverage.targetTotal === coverage.authenticatedBrowserCapture.visibleCardTotal,
  "coverage targetTotal must match authenticated visible card/report positions",
);
assert(
  coverage.targetTotal === authenticatedPagePropsItems.length,
  "coverage targetTotal must match authenticated page-props item positions",
);
assert(publicCatalog.count === coverage.counts.publicUrlDistinct, "public catalog count must match coverage");
assert(namedSlugs.length === expectedNamedTotal, "named slug count must match public + authenticated-only named count");
assert(placeholderSlugs.length === coverage.counts.unidentifiedAuthenticatedSlots, "placeholder count must match coverage");
assert(coverage.counts.unidentifiedAuthenticatedSlots === 0, "authenticated page props must leave no unidentified slots");
assert(
  coverage.counts.seededRecordsExpected === expectedNamedTotal,
  "seeded expectation must match named identities only; duplicate card positions are not seeded as duplicate packages",
);
assert(
  JSON.stringify(normalizedAuthenticated.orderSlugAliases ?? {}) === JSON.stringify(expectedOrderSlugAliases),
  "normalized authenticated artifact must expose expected raw order slug aliases",
);
assert(
  JSON.stringify(normalizedAuthenticated.uniqueCanonicalOrderSlugs ?? []) ===
    JSON.stringify((normalizedAuthenticated.uniqueOrderSlugs ?? []).map(canonicalAuthenticatedSlug).sort()),
  "normalized authenticated canonical order slugs must match alias table",
);
assert(coverage.authenticatedBrowserCapture.visibleCardTotal === 164, "authenticated card-position evidence must remain 164");
assert(
  coverage.authenticatedPagePropsCapture.structuredItemTotal === 164,
  "authenticated page-props item evidence must remain 164",
);
assert(missingArtifacts.length === 0, "every named report must have prompt, fixture, and result artifacts");
assert(extraArtifacts.prompts.length === 0, "prompt artifacts must map to named reports only");
assert(extraArtifacts.fixtures.length === 0, "fixture artifacts must map to named reports only");
assert(extraArtifacts.results.length === 0, "result artifacts must map to named reports only");
assert(placeholderArtifacts.length === 0, "placeholders must not have local artifacts until identities are known");
assert(
  normalizedAuthenticated.totals.coverageUnidentifiedAuthenticatedSlots === coverage.counts.unidentifiedAuthenticatedSlots,
  "normalized authenticated placeholder count must match coverage",
);
for (const problem of detailArtifactProblems) {
  errors.push(`authenticated detail artifact invalid: ${problem}`);
}
for (const { slug, url } of ledgerOrderUrlProblems) {
  errors.push(`sample promotion ledger order URL invalid: ${slug} references uncaptured order URL ${url}`);
}
for (const { key, expected, actual } of ledgerSnapshotProblems) {
  errors.push(`sample promotion ledger catalogSnapshot.${key} must be ${expected}, got ${actual}`);
}
for (const problem of formalBlockerLedgerProblems) {
  errors.push(`sample promotion ledger invalid: ${problem}`);
}

const summary = {
  ok: errors.length === 0,
  targetTotal: coverage.targetTotal,
  identifiedNamedTotal: namedSlugs.length,
  unidentifiedAuthenticatedSlots: placeholderSlugs.length,
  promptArtifacts: promptSlugs.size,
  fixtureArtifacts: fixtureSlugs.size,
  resultArtifacts: resultSlugs.size,
  authenticatedCardPositions: normalizedAuthenticated.totals.authenticatedCardPositions,
  authenticatedUniqueHrefs: normalizedAuthenticated.totals.authenticatedUniqueHrefs,
  authenticatedDuplicateCardPositions: normalizedAuthenticated.totals.authenticatedDuplicateCardPositions,
  authenticatedPagePropsItems: normalizedAuthenticated.totals.authenticatedPagePropsItems,
  authenticatedPagePropsUniqueHrefs: normalizedAuthenticated.totals.authenticatedPagePropsUniqueHrefs,
  authenticatedOrderSlugAliases: normalizedAuthenticated.orderSlugAliases ?? {},
  samplePromotionLedgerOrderUrlProblems: ledgerOrderUrlProblems,
  samplePromotionLedgerSnapshotProblems: ledgerSnapshotProblems,
  formalBlockerLedgerProblems,
  authenticatedDetailArtifacts: authenticatedDetailArtifacts.length,
  authenticatedDetailArtifactRule:
    "Mapped detail artifacts must resolve to the exact report detail URL and must not be redirected marketplace index captures.",
  invalidAuthenticatedDetailArtifacts: detailArtifactProblems,
  namedReportsMissingArtifacts: missingArtifacts,
  unexpectedArtifacts: extraArtifacts,
  placeholderArtifacts,
  placeholderSlugs,
  nextEvidenceRequired:
    "Add a seeded named report only after authenticated page props, network JSON, screenshot, or detail-page evidence identifies a non-duplicate report name and metadata.",
  rawGenomeBoundary: "This audit reads marketplace metadata and local synthetic artifacts only; it does not read raw genome files.",
  errors,
};

console.log(JSON.stringify(summary, null, 2));

if (errors.length > 0) {
  process.exit(1);
}
