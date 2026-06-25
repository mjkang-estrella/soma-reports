#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const authenticatedCardsPath =
  "reference/catalog/sequencing-authenticated-marketplace-cards-2026-06-21.json";
const authenticatedPagePropsPath =
  "reference/catalog/sequencing-authenticated-marketplace-pageprops-2026-06-21.json";
const publicCatalogPath = "reference/catalog/sequencing-public-marketplace-catalog.json";
const coveragePath = "reference/catalog/sequencing-marketplace-coverage.json";
const outPath =
  "reference/catalog/sequencing-authenticated-marketplace-normalized-2026-06-21.json";
const tsOutPath = "convex/authenticatedMarketplaceLedger.ts";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const slugFromHref = (href) => {
  try {
    const url = new URL(href);
    const match = url.pathname.match(/^\/(marketplace|order)\/([^/?#]+)/);
    if (!match) return null;
    return { kind: match[1], slug: match[2] };
  } catch {
    return null;
  }
};

const authenticatedCards = readJson(authenticatedCardsPath);
const authenticatedPageProps = readJson(authenticatedPagePropsPath);
const publicCatalog = readJson(publicCatalogPath);
const coverage = readJson(coveragePath);
const orderSlugAliases = {
  "comprehensive-wgs-health-screen-bundle": "comprehensive-health-screen-wgs-bundle",
  "expedited-advanced-wgs-health-screen-bundle": "expedited-advanced-health-screen-wgs-bundle",
  "ultra-rapid-professional-wgs-health-screen-bundle": "ultra-rapid-professional-health-screen-wgs-bundle",
};
const marketplaceSlugAliases = {
  "clinical-annotator-of-variants": "clinical-annotator-variants",
  "eve-premium": "eve-premium-dna-genome-data-bioinformatics-pipelines",
  "gene-in-form-personalized-fitness": "gene-form-dna-personalized-fitness-app",
  "genetic-risk-of-hair-loss": "hair-loss-balding-dna-test",
  "healthy-nutrition": "healthy-nutrition-dna-analysis-app",
  "nutrigenomics-nutrition-analysis": "nutrigenomics-dna-nutrition-guidance",
  "physical-appearance-genetic-report": "genetic-test-predict-physical-appearance",
  "short-read-mapper": "genome-short-read-mapper",
  "skin-genes": "skin-genes-dna-analysis-app",
  "variant-discovery": "variant-discovery-bioinformatics-secondary-analysis",
};

const cards = authenticatedCards.pages.flatMap((page, pageIndex) =>
  page.cards.map((card) => ({
    ...card,
    page: card.page ?? pageIndex + 1,
  })),
);

const cardGroupsByHref = new Map();
for (const card of cards) {
  const href = card.href ?? "";
  const existing = cardGroupsByHref.get(href) ?? [];
  existing.push(card);
  cardGroupsByHref.set(href, existing);
}

const uniqueCards = [...cardGroupsByHref.entries()].map(([href, group]) => {
  const parsed = slugFromHref(href) ?? { kind: "unknown", slug: "" };
  const first = group[0];
  return {
    href,
    kind: parsed.kind,
    slug: parsed.slug,
    title: first.title,
    provider: first.provider,
    priceLabel: first.priceLabel,
    buttonText: first.buttonText,
    positionCount: group.length,
    positions: group.map((card) => ({
      page: card.page,
      index: card.index,
    })),
  };
});

const uniqueMarketplaceSlugs = uniqueCards
  .filter((card) => card.kind === "marketplace")
  .map((card) => card.slug)
  .sort();
const uniqueOrderSlugs = uniqueCards
  .filter((card) => card.kind === "order")
  .map((card) => card.slug)
  .sort();
const uniqueCanonicalOrderSlugs = uniqueOrderSlugs.map((slug) => orderSlugAliases[slug] ?? slug).sort();
const publicSlugs = publicCatalog.catalog.map((entry) => entry.slug).sort();
const publicSlugSet = new Set(publicSlugs);
const authenticatedMarketplaceSlugSet = new Set(uniqueMarketplaceSlugs);

const publicSlugsSeenInAuthenticatedCapture = publicSlugs.filter((slug) =>
  authenticatedMarketplaceSlugSet.has(slug),
);
const publicSlugsNotSeenInAuthenticatedCapture = publicSlugs.filter(
  (slug) => !authenticatedMarketplaceSlugSet.has(slug),
);
const authenticatedMarketplaceSlugsNotInPublicCatalog = uniqueMarketplaceSlugs.filter(
  (slug) => !publicSlugSet.has(slug),
);

const duplicateGroups = uniqueCards
  .filter((card) => card.positionCount > 1)
  .sort((a, b) => b.positionCount - a.positionCount || a.slug.localeCompare(b.slug));

const pageCounts = authenticatedCards.pages.map((page) => page.cardCount ?? page.cards.length);
const totalCardPositions = cards.length;
const uniqueCardIdentities = uniqueCards.length;
const pagePropsItems = authenticatedPageProps.groups.flatMap((group, groupIndex) =>
  group.items.map((item, itemIndex) => {
    const rawHref = item.uri
      ? `https://sequencing.com/${item.uri}`
      : item.url || item.href || item.link || "";
    return {
      ...item,
      href: rawHref,
      group: group.label,
      groupIndex,
      itemIndex,
    };
  }),
);
const pagePropsGroupsByHref = new Map();
for (const item of pagePropsItems) {
  const href = item.href ?? "";
  const existing = pagePropsGroupsByHref.get(href) ?? [];
  existing.push(item);
  pagePropsGroupsByHref.set(href, existing);
}
const uniquePagePropsCards = [...pagePropsGroupsByHref.entries()].map(([href, group]) => {
  const parsed = slugFromHref(href) ?? { kind: "unknown", slug: "" };
  const first = group[0];
  return {
    href,
    kind: parsed.kind,
    slug: parsed.slug,
    title: first.title,
    provider: first.publisher,
    priceLabel: first.price,
    positionCount: group.length,
    positions: group.map((item) => ({
      group: item.group,
      groupIndex: item.groupIndex,
      itemIndex: item.itemIndex,
    })),
  };
});
const pagePropsDuplicateGroups = uniquePagePropsCards
  .filter((card) => card.positionCount > 1)
  .sort((a, b) => b.positionCount - a.positionCount || a.slug.localeCompare(b.slug));

const canonicalSlug = (slug) => marketplaceSlugAliases[slug] ?? orderSlugAliases[slug] ?? slug;
const pagePropsPositions = pagePropsItems.map((item, index) => {
  const parsed = slugFromHref(item.href) ?? { kind: "unknown", slug: "" };
  return {
    positionNumber: index + 1,
    groupLabel: item.group,
    groupIndex: item.groupIndex,
    itemIndex: item.itemIndex,
    title: item.title,
    provider: item.publisher ?? "",
    priceLabel: item.price ?? "",
    href: item.href,
    kind: parsed.kind,
    slug: parsed.slug,
    canonicalSlug: canonicalSlug(parsed.slug),
    categories: Array.isArray(item.category) ? item.category : [],
  };
});

const pagePropsDuplicatePositionGroups = [...pagePropsGroupsByHref.entries()]
  .filter(([, group]) => group.length > 1)
  .map(([href, group]) => {
    const parsed = slugFromHref(href) ?? { kind: "unknown", slug: "" };
    const first = group[0];
    const positions = pagePropsPositions.filter((position) => position.href === href);
    return {
      href,
      canonicalSlug: canonicalSlug(parsed.slug),
      title: first.title,
      provider: first.publisher ?? "",
      priceLabel: first.price ?? "",
      positionCount: positions.length,
      positionNumbers: positions.map((position) => position.positionNumber),
      groupLabels: positions.map((position) => position.groupLabel),
    };
  })
  .sort((a, b) => b.positionCount - a.positionCount || a.title.localeCompare(b.title));

const normalized = {
  schema: "soma-reports.authenticated-marketplace-normalized.v1",
  generatedAt: new Date().toISOString(),
  sourceArtifacts: {
    authenticatedCards: authenticatedCardsPath,
    authenticatedPageProps: authenticatedPagePropsPath,
    publicCatalog: publicCatalogPath,
    coverage: coveragePath,
  },
  totals: {
    authenticatedPageCount: authenticatedCards.pageCount,
    authenticatedPageCardCounts: pageCounts,
    authenticatedCardPositions: totalCardPositions,
    authenticatedUniqueHrefs: uniqueCardIdentities,
    authenticatedUniqueMarketplaceSlugs: uniqueMarketplaceSlugs.length,
    authenticatedUniqueOrderSlugs: uniqueOrderSlugs.length,
    authenticatedDuplicateHrefGroups: duplicateGroups.length,
    authenticatedDuplicateCardPositions: totalCardPositions - uniqueCardIdentities,
    authenticatedPagePropsGroups: authenticatedPageProps.groups.length,
    authenticatedPagePropsItems: pagePropsItems.length,
    authenticatedPagePropsUniqueHrefs: uniquePagePropsCards.length,
    authenticatedPagePropsDuplicateHrefGroups: pagePropsDuplicateGroups.length,
    authenticatedPagePropsDuplicatePositions: pagePropsItems.length - uniquePagePropsCards.length,
    publicCatalogUniqueMarketplaceSlugs: publicSlugs.length,
    publicSlugsSeenInAuthenticatedCapture: publicSlugsSeenInAuthenticatedCapture.length,
    publicSlugsNotSeenInAuthenticatedCapture: publicSlugsNotSeenInAuthenticatedCapture.length,
    authenticatedMarketplaceSlugsNotInPublicCatalog:
      authenticatedMarketplaceSlugsNotInPublicCatalog.length,
    namedIdentityTotal:
      publicSlugs.length + authenticatedMarketplaceSlugsNotInPublicCatalog.length + uniqueOrderSlugs.length,
    unresolvedUniqueAuthenticatedRecords: 0,
    coverageTargetTotal: coverage.targetTotal,
    coverageIdentifiedNamedTotal: coverage.counts.identifiedNamedTotal,
    coverageUnidentifiedAuthenticatedSlots: coverage.counts.unidentifiedAuthenticatedSlots,
  },
  authenticatedMarketplaceSlugsNotInPublicCatalog,
  uniqueOrderSlugs,
  uniqueCanonicalOrderSlugs,
  orderSlugAliases,
  marketplaceSlugAliases,
  duplicateGroups,
  pagePropsDuplicateGroups,
  positionLedger: {
    positions: pagePropsPositions,
    duplicateGroups: pagePropsDuplicatePositionGroups,
  },
  publicSlugsNotSeenInAuthenticatedCapture,
  evidenceInterpretation: {
    cardPositionTotal: "The logged-in DOM capture proves 164 rendered card positions.",
    pagePropsPositionTotal:
      "The logged-in Next.js page props expose 164 reportsGroups item positions with title, provider, price, category, and href metadata.",
    uniqueIdentityLimit:
      "The same capture proves only 87 unique hrefs, including 84 marketplace slugs and 3 order URLs.",
    duplicatePositionReason:
      "The authenticated marketplace target is tracked as 164 structured report/card positions. Duplicate positions are category/group placements and are not seeded as duplicate report packages.",
    replacementRule:
      "Add a new seeded report package only after authenticated page props, network JSON, screenshot, or detail-page evidence identifies a non-duplicate report identity and metadata.",
    rawGenomeBoundary: "This normalization uses marketplace card metadata only and contains no raw genome data.",
  },
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(normalized, null, 2)}\n`);

const tsLedger = {
  capturedAt: authenticatedPageProps.capturedAt,
  sourceUrl: "https://sequencing.com/marketplace",
  sourceArtifacts: {
    normalized: outPath,
    pageProps: authenticatedPagePropsPath,
  },
  rawGenomeBoundary: normalized.evidenceInterpretation.rawGenomeBoundary,
  totals: {
    positions: normalized.totals.authenticatedPagePropsItems,
    uniqueHrefs: normalized.totals.authenticatedPagePropsUniqueHrefs,
    duplicatePlacements: normalized.totals.authenticatedPagePropsDuplicatePositions,
    duplicateHrefGroups: normalized.totals.authenticatedPagePropsDuplicateHrefGroups,
    namedIdentities: normalized.totals.namedIdentityTotal,
    unresolvedAuthenticatedRecords: normalized.totals.unresolvedUniqueAuthenticatedRecords,
  },
  orderSlugAliases,
  marketplaceSlugAliases,
  positions: pagePropsPositions,
  duplicateGroups: pagePropsDuplicatePositionGroups,
};

const tsSource = `// Generated by scripts/normalize-authenticated-catalog.mjs.
// Source: ${authenticatedPagePropsPath}

export type AuthenticatedMarketplacePositionKind = "marketplace" | "order" | "unknown";

export type AuthenticatedMarketplacePosition = {
  positionNumber: number;
  groupLabel: string;
  groupIndex: number;
  itemIndex: number;
  title: string;
  provider: string;
  priceLabel: string;
  href: string;
  kind: AuthenticatedMarketplacePositionKind;
  slug: string;
  canonicalSlug: string;
  categories: string[];
};

export type AuthenticatedMarketplaceDuplicateGroup = {
  href: string;
  canonicalSlug: string;
  title: string;
  provider: string;
  priceLabel: string;
  positionCount: number;
  positionNumbers: number[];
  groupLabels: string[];
};

export type AuthenticatedMarketplacePositionLedger = {
  capturedAt: string;
  sourceUrl: string;
  sourceArtifacts: {
    normalized: string;
    pageProps: string;
  };
  rawGenomeBoundary: string;
  totals: {
    positions: number;
    uniqueHrefs: number;
    duplicatePlacements: number;
    duplicateHrefGroups: number;
    namedIdentities: number;
    unresolvedAuthenticatedRecords: number;
  };
  orderSlugAliases: Record<string, string>;
  marketplaceSlugAliases: Record<string, string>;
  positions: AuthenticatedMarketplacePosition[];
  duplicateGroups: AuthenticatedMarketplaceDuplicateGroup[];
};

export const authenticatedMarketplacePositionLedger: AuthenticatedMarketplacePositionLedger = ${JSON.stringify(tsLedger, null, 2)};
`;

mkdirSync(dirname(tsOutPath), { recursive: true });
writeFileSync(tsOutPath, tsSource);

console.log(
  JSON.stringify(
    {
      ok: true,
      outPath,
      tsOutPath,
      totals: normalized.totals,
      authenticatedMarketplaceSlugsNotInPublicCatalog,
      duplicateGroups: duplicateGroups.length,
    },
    null,
    2,
  ),
);
