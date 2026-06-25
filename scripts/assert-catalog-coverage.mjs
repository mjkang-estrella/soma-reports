#!/usr/bin/env node

import { readFileSync } from "node:fs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readText = (path) => readFileSync(path, "utf8");

const parseAuthenticatedMarketplaceLedger = (source) => {
  const marker = "export const authenticatedMarketplacePositionLedger: AuthenticatedMarketplacePositionLedger = ";
  const start = source.indexOf(marker);
  if (start < 0) {
    return { ledger: null, error: "authenticatedMarketplacePositionLedger export not found" };
  }

  const jsonStart = start + marker.length;
  const jsonEnd = source.indexOf("\n};", jsonStart);
  if (jsonEnd < 0) {
    return { ledger: null, error: "authenticatedMarketplacePositionLedger initializer terminator not found" };
  }

  try {
    return { ledger: JSON.parse(source.slice(jsonStart, jsonEnd + 2)), error: null };
  } catch (error) {
    return {
      ledger: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const coveragePath = "reference/catalog/sequencing-marketplace-coverage.json";
const publicCatalogPath = "reference/catalog/sequencing-public-marketplace-catalog.json";
const normalizedAuthenticatedCatalogPath =
  "reference/catalog/sequencing-authenticated-marketplace-normalized-2026-06-21.json";
const authenticatedPagePropsPath =
  "reference/catalog/sequencing-authenticated-marketplace-pageprops-2026-06-21.json";
const authenticatedMarketplaceLedgerPath = "convex/authenticatedMarketplaceLedger.ts";
const marketplacePositionLedgerPath = "convex/marketplacePositionLedger.ts";
const generatedApiPath = "convex/_generated/api.d.ts";
const reportPackagesPath = "convex/reportPackages.ts";
const reportsPath = "convex/reports.ts";
const appPath = "src/App.tsx";
const typesPath = "src/lib/types.ts";
const stylesPath = "src/styles/index.css";

const coverage = readJson(coveragePath);
const publicCatalog = readJson(publicCatalogPath);
const normalizedAuthenticatedCatalog = readJson(normalizedAuthenticatedCatalogPath);
const authenticatedPageProps = readJson(authenticatedPagePropsPath);
const authenticatedMarketplaceLedgerSource = readText(authenticatedMarketplaceLedgerPath);
const marketplacePositionLedgerSource = readText(marketplacePositionLedgerPath);
const generatedApiSource = readText(generatedApiPath);
const reportPackages = readText(reportPackagesPath);
const reportsSource = readText(reportsPath);
const appSource = readText(appPath);
const typesSource = readText(typesPath);
const stylesSource = readText(stylesPath);

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const counts = coverage.counts;
const authenticatedMarketplaceLedgerParse = parseAuthenticatedMarketplaceLedger(authenticatedMarketplaceLedgerSource);
const authenticatedMarketplaceLedger = authenticatedMarketplaceLedgerParse.ledger;
const inferredNamedTotal = counts.publicUrlDistinct + counts.authenticatedOnlyNamed;
const pagePropsItems = authenticatedPageProps.groups.flatMap((group) => group.items);
const authenticatedUiEvidence = coverage.evidence.find((entry) => entry.kind === "authenticated_marketplace_ui");
const authenticatedPagePropsEvidence = coverage.evidence.find(
  (entry) => entry.kind === "authenticated_marketplace_pageprops",
);
const marketplaceAliasCount = Object.keys(normalizedAuthenticatedCatalog.marketplaceSlugAliases ?? {}).length;

assert(coverage.authenticatedBrowserCapture.visibleCardTotal === 164, "authenticated card-position evidence must remain 164");
assert(
  coverage.targetTotal === counts.authenticatedStructuredCardPositions,
  "coverage targetTotal must equal authenticated structured card positions",
);
assert(
  coverage.targetTotal === coverage.authenticatedBrowserCapture.visibleCardTotal,
  "coverage targetTotal must match authenticated visible card/report positions",
);
assert(
  coverage.targetTotal === pagePropsItems.length,
  "coverage targetTotal must match authenticated page-props item positions",
);
assert(publicCatalog.count === counts.publicUrlDistinct, "public catalog count must match coverage publicUrlDistinct");
assert(inferredNamedTotal === counts.identifiedNamedTotal, "identifiedNamedTotal must equal public + authenticated-only named");
assert(
  counts.identifiedNamedTotal !== coverage.targetTotal,
  "identified named packages must remain distinct from authenticated card positions",
);
assert(
  counts.seededRecordsExpected === counts.identifiedNamedTotal,
  "seededRecordsExpected must equal identified named records; duplicate card positions are not duplicate packages",
);
assert(coverage.unidentifiedSlots.length === counts.unidentifiedAuthenticatedSlots, "unidentified slot list length must match count");
assert(new Set(coverage.unidentifiedSlots).size === coverage.unidentifiedSlots.length, "unidentified slot slugs must be unique");
assert(counts.unidentifiedAuthenticatedSlots === 0, "authenticated page props must leave no unidentified authenticated slots");
assert(
  normalizedAuthenticatedCatalog.schema === "soma-reports.authenticated-marketplace-normalized.v1",
  "normalized authenticated catalog schema must match",
);
assert(
  normalizedAuthenticatedCatalog.sourceArtifacts.authenticatedCards ===
    coverage.authenticatedBrowserCapture.sourceArtifact,
  "normalized authenticated catalog must use the coverage authenticated card capture",
);
assert(
  normalizedAuthenticatedCatalog.sourceArtifacts.authenticatedPageProps ===
    coverage.authenticatedPagePropsCapture.sourceArtifact,
  "normalized authenticated catalog must use the coverage authenticated page-props capture",
);
assert(
  authenticatedUiEvidence?.normalizedArtifact === normalizedAuthenticatedCatalogPath,
  "coverage authenticated UI evidence must cite the normalized artifact",
);
assert(
  authenticatedPagePropsEvidence?.artifact === authenticatedPagePropsPath,
  "coverage authenticated page-props evidence must cite the page-props artifact",
);
assert(
  authenticatedPageProps.schema === "soma-reports.authenticated-marketplace-pageprops.v1",
  "authenticated page-props artifact schema must match",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedCardPositions ===
    coverage.authenticatedBrowserCapture.visibleCardTotal,
  "normalized card positions must match coverage visible card total",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedUniqueHrefs ===
    coverage.authenticatedBrowserCapture.uniqueCardIdentities,
  "normalized unique href count must match coverage unique card identities",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedUniqueMarketplaceSlugs ===
    coverage.authenticatedBrowserCapture.uniqueMarketplaceSlugs,
  "normalized unique marketplace slug count must match coverage",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedUniqueOrderSlugs ===
    coverage.authenticatedBrowserCapture.uniqueOrderSlugs,
  "normalized unique order slug count must match coverage",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedCardPositions >
    normalizedAuthenticatedCatalog.totals.authenticatedUniqueHrefs,
  "authenticated card positions must remain distinct from unique card identities",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedPagePropsItems === coverage.targetTotal,
  "normalized page-props positions must match coverage target total",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedPagePropsItems ===
    coverage.authenticatedPagePropsCapture.structuredItemTotal,
  "normalized page-props positions must match coverage page-props capture",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedPagePropsUniqueHrefs ===
    coverage.authenticatedPagePropsCapture.uniqueCardIdentities,
  "normalized page-props unique href count must match coverage page-props capture",
);
assert(
  normalizedAuthenticatedCatalog.totals.authenticatedPagePropsDuplicatePositions ===
    coverage.authenticatedPagePropsCapture.duplicateStructuredPositions,
  "normalized page-props duplicate positions must match coverage page-props capture",
);
assert(
  normalizedAuthenticatedCatalog.positionLedger?.positions?.length === coverage.targetTotal,
  "normalized authenticated catalog must retain every captured marketplace position row",
);
assert(
  normalizedAuthenticatedCatalog.positionLedger?.duplicateGroups?.length ===
    normalizedAuthenticatedCatalog.totals.authenticatedDuplicateHrefGroups,
  "normalized authenticated duplicate groups must match duplicate group total",
);
assert(
  normalizedAuthenticatedCatalog.totals.coverageUnidentifiedAuthenticatedSlots ===
    counts.unidentifiedAuthenticatedSlots,
  "normalized unidentified slot count must match coverage",
);
assert(
  normalizedAuthenticatedCatalog.totals.coverageTargetTotal === coverage.targetTotal,
  "normalized coverage target total must match coverage",
);
assert(
  !reportPackages.includes("authenticated-marketplace-slot-") &&
    !reportPackages.includes("authenticated-marketplace-unresolved-slot-") &&
    !reportPackages.includes("makeUnidentifiedAuthenticatedReport"),
  "reportPackages must not seed anonymous authenticated placeholder reports",
);

const backendTotal = reportsSource.match(/knownMarketplaceTotal = (\d+)/)?.[1];
assert(
  Number(backendTotal) === coverage.targetTotal ||
    reportsSource.includes("authenticatedMarketplacePositionLedger.totals.positions"),
  "reports.catalogStats total must match coverage target",
);
assert(!authenticatedMarketplaceLedgerParse.error, `generated authenticated marketplace ledger must parse: ${authenticatedMarketplaceLedgerParse.error}`);
assert(
  authenticatedMarketplaceLedger?.totals?.positions === coverage.targetTotal,
  "generated authenticated marketplace ledger total positions must match coverage target",
);
assert(
  authenticatedMarketplaceLedger?.positions?.length === coverage.targetTotal,
  "generated authenticated marketplace ledger positions[] must retain every captured position row",
);
assert(
  authenticatedMarketplaceLedger?.totals?.uniqueHrefs ===
    normalizedAuthenticatedCatalog.totals.authenticatedPagePropsUniqueHrefs,
  "generated authenticated marketplace ledger unique href total must match normalized page-props total",
);
assert(
  authenticatedMarketplaceLedger?.totals?.duplicatePlacements ===
    normalizedAuthenticatedCatalog.totals.authenticatedPagePropsDuplicatePositions,
  "generated authenticated marketplace ledger duplicate placements must match normalized page-props total",
);
assert(
  authenticatedMarketplaceLedger?.totals?.namedIdentities === counts.identifiedNamedTotal,
  "generated authenticated marketplace ledger named identities must match identified named records",
);
assert(
  authenticatedMarketplaceLedger?.totals?.unresolvedAuthenticatedRecords === counts.unidentifiedAuthenticatedSlots,
  "generated authenticated marketplace ledger unresolved records must match unidentified authenticated slots",
);
assert(
  marketplaceAliasCount === 10,
  "normalized authenticated catalog must expose the 10 current marketplace route aliases",
);
assert(
  JSON.stringify(authenticatedMarketplaceLedger?.marketplaceSlugAliases ?? {}) ===
    JSON.stringify(normalizedAuthenticatedCatalog.marketplaceSlugAliases ?? {}),
  "generated authenticated marketplace ledger route aliases must match normalized artifact",
);
assert(
  authenticatedMarketplaceLedger?.duplicateGroups?.length ===
    normalizedAuthenticatedCatalog.totals.authenticatedPagePropsDuplicateHrefGroups,
  "generated authenticated marketplace ledger duplicate group rows must match normalized page-props total",
);
assert(
  marketplacePositionLedgerSource.includes("export const get = query") &&
    marketplacePositionLedgerSource.includes("authenticatedMarketplacePositionLedger.positions.filter") &&
    marketplacePositionLedgerSource.includes("duplicateGroups"),
  "Convex marketplacePositionLedger query must expose filtered positions and duplicate groups",
);
assert(
  generatedApiSource.includes('import type * as marketplacePositionLedger from "../marketplacePositionLedger.js"') &&
    generatedApiSource.includes("marketplacePositionLedger: typeof marketplacePositionLedger"),
  "generated Convex API must include marketplacePositionLedger",
);
assert(
  typesSource.includes("export type MarketplacePosition =") &&
    typesSource.includes("export type MarketplaceDuplicateGroup =") &&
    typesSource.includes("export type MarketplacePositionLedger =") &&
    typesSource.includes("marketplaceSlugAliases: Record<string, string>"),
  "frontend types must model marketplace position ledger rows and duplicate groups",
);

const frontendIdentityTotal = appSource.match(/SEQUENCING_NAMED_IDENTITY_TOTAL = (\d+)/)?.[1];
assert(
  Number(frontendIdentityTotal) === counts.identifiedNamedTotal,
  "frontend named identity total must match identified named records",
);

const frontendCardPositionTotal = appSource.match(/SEQUENCING_CARD_POSITION_TOTAL = (\d+)/)?.[1];
assert(
  Number(frontendCardPositionTotal) === coverage.authenticatedBrowserCapture.visibleCardTotal,
  "frontend card-position total must match authenticated evidence",
);
assert(
    appSource.includes("api.marketplacePositionLedger.get") &&
    appSource.includes("Authenticated marketplace coverage proof") &&
    appSource.includes("Sequencing.com positions verified") &&
    appSource.includes("DEFAULT_MARKETPLACE_ROUTE_ALIASES") &&
    appSource.includes("route-alias-list") &&
    appSource.includes("Inspect all captured positions") &&
    appSource.includes('id="position-ledger"') &&
    appSource.includes("ledger.open = true") &&
    appSource.includes("All captured positions"),
  "frontend must expose authenticated marketplace coverage proof and an openable all-positions ledger",
);
assert(
  stylesSource.includes(".marketplace-proof-strip") &&
    stylesSource.includes(".marketplace-proof-metrics") &&
    stylesSource.includes(".marketplace-proof-sources") &&
    stylesSource.includes(".route-alias-list"),
  "frontend styles must include the authenticated coverage proof strip",
);

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      targetTotal: coverage.targetTotal,
      publicUrlDistinct: counts.publicUrlDistinct,
      authenticatedOnlyNamed: counts.authenticatedOnlyNamed,
      identifiedNamedTotal: counts.identifiedNamedTotal,
      unidentifiedAuthenticatedSlots: counts.unidentifiedAuthenticatedSlots,
      seededRecordsExpected: counts.seededRecordsExpected,
      authenticatedCardPositions: normalizedAuthenticatedCatalog.totals.authenticatedCardPositions,
      authenticatedUniqueHrefs: normalizedAuthenticatedCatalog.totals.authenticatedUniqueHrefs,
      authenticatedDuplicateCardPositions:
        normalizedAuthenticatedCatalog.totals.authenticatedDuplicateCardPositions,
      authenticatedPagePropsItems: normalizedAuthenticatedCatalog.totals.authenticatedPagePropsItems,
      authenticatedPagePropsUniqueHrefs: normalizedAuthenticatedCatalog.totals.authenticatedPagePropsUniqueHrefs,
      authenticatedLedgerPositions: authenticatedMarketplaceLedger?.positions?.length ?? 0,
      authenticatedLedgerDuplicateGroups: authenticatedMarketplaceLedger?.duplicateGroups?.length ?? 0,
      marketplaceRouteAliases: marketplaceAliasCount,
      positionLedgerSurface: true,
    },
    null,
    2,
  ),
);
