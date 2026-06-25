import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../convex/_generated/api";
import { Filters } from "./components/Filters";
import { ReportCard } from "./components/ReportCard";
import { ReportDetail } from "./components/ReportDetail";
import {
  type FormalEvidenceTarget,
  formalEvidenceBacklogSummary,
  officialEvidencePacketFor,
  officialEvidenceTierFor,
  officialEvidenceTierLabelFor,
  officialOutputActionBoundaryFor,
  officialOutputCaptureCaveats,
  officialOutputNextEvidenceFor,
} from "./lib/formalEvidenceBacklog";
import { ALL_PACKAGE_STATES, deriveAgentReadinessState, readinessScore } from "./lib/readiness";
import type {
  CatalogStats,
  MarketplacePositionLedger,
  ReadinessAuditRow,
  ReportPackage,
  ReportSummary,
} from "./lib/types";

const DEFAULT_SLUG = "wellness-genetic-guide";
const REPORT_QUERY_PARAM = "report";
const SEQUENCING_CARD_POSITION_TOTAL = 164;
const SEQUENCING_NAMED_IDENTITY_TOTAL = 154;
const AUTHENTICATED_DUPLICATE_POSITION_TOTAL = 77;
const AUTHENTICATED_PAGE_COUNT = 3;
const OFFICIAL_OUTPUT_BLOCKERS_STATE = "Official output blockers";
const OFFICIAL_BOUNDARY_MODELED_STATE = "Official boundary modeled";
const DEFAULT_MARKETPLACE_ROUTE_ALIASES: Record<string, string> = {
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
type SortMode = "readiness" | "title" | "category";
type CategoryFacet = { label: string; count: number };
type PackageStateFacet = { label: string; count: number };

const DETAIL_TARGET_LIMIT = 5;
const UNRESOLVED_SLOT_TARGET_LIMIT = 10;
const formatGapCount = (value: number | undefined) => (value === undefined ? "..." : value.toString());

const formatGapLabel = (gap: string) => gap.replace(/[-_]/g, " ");
const formatBoundaryReason = (boundary: Record<string, unknown> | null | undefined) => {
  const reason = boundary?.reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
};
const captureStageClass = (stage: string | null | undefined) =>
  stage ? `evidence-status evidence-status-${stage}` : "evidence-status evidence-status-loading";
const formatOutputSignals = (signals: Record<string, boolean | number> | undefined) => {
  const entries = Object.entries(signals ?? {}).filter(([, value]) =>
    typeof value === "number" ? value > 0 : value,
  );
  return entries.length > 0
    ? entries.map(([key, value]) => `${formatGapLabel(key)} ${typeof value === "boolean" ? "yes" : value}`).join(", ")
    : "no output signals";
};

const formatReadinessStat = (value: number | undefined, total: number) => {
  if (value === undefined) {
    return "...";
  }
  return `${value}/${total}`;
};

const reportCategoryFacets = (report: ReportSummary) => {
  const categories = report.catalogCategories?.filter(Boolean);
  return categories?.length ? categories : [report.category];
};

const canonicalReportSlug = (slug: string) => DEFAULT_MARKETPLACE_ROUTE_ALIASES[slug] ?? slug;

const getSelectedSlugFromLocation = () => {
  if (typeof window === "undefined") {
    return DEFAULT_SLUG;
  }

  const slug = new URLSearchParams(window.location.search).get(REPORT_QUERY_PARAM)?.trim();
  return slug ? canonicalReportSlug(slug) : DEFAULT_SLUG;
};

const writeSelectedSlugToLocation = (slug: string, mode: "push" | "replace" = "push") => {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set(REPORT_QUERY_PARAM, slug);
  url.hash = "";

  if (mode === "replace") {
    window.history.replaceState(null, "", url);
    return;
  }

  window.history.pushState(null, "", url);
};

const compactCommandChain = (commands: Array<string | null | undefined>) =>
  Array.from(new Set(commands.filter((command): command is string => Boolean(command))));

export default function App() {
  const reports = useQuery(api.reports.list, {}) as ReportSummary[] | undefined;
  const catalogStats = useQuery(api.reports.catalogStats, {}) as CatalogStats | undefined;
  const readinessAudit = useQuery(api.reports.auditReadiness, {}) as ReadinessAuditRow[] | undefined;
  const marketplacePositionLedger = useQuery(api.marketplacePositionLedger.get, {}) as
    | MarketplacePositionLedger
    | undefined;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [packageState, setPackageState] = useState(ALL_PACKAGE_STATES);
  const [selectedSlug, setSelectedSlug] = useState(getSelectedSlugFromLocation);
  const [sortBy, setSortBy] = useState<SortMode>("readiness");
  const selectedReport = useQuery(api.reports.get, { slug: selectedSlug }) as
    | ReportPackage
    | null
    | undefined;
  const officialOutputCaptureTargets = formalEvidenceBacklogSummary.officialOutputCaptureTargets;
  const officialOutputCaptureTargetBySlug = useMemo(
    () => new Map(officialOutputCaptureTargets.map((target) => [target.slug, target] as const)),
    [officialOutputCaptureTargets],
  );

  const categories = useMemo<CategoryFacet[]>(() => {
    const counts = new Map<string, number>();
    for (const report of reports ?? []) {
      for (const category of new Set(reportCategoryFacets(report))) {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }

    return [
      { label: "All", count: reports?.length ?? 0 },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, count]) => ({ label, count })),
    ];
  }, [reports]);

  const readinessBySlug = useMemo(() => {
    return new Map((readinessAudit ?? []).map((row) => [row.slug, row]));
  }, [readinessAudit]);
  const selectedReadiness = selectedReport
    ? readinessAudit
      ? readinessBySlug.get(selectedReport.slug) ?? null
      : undefined
    : null;

  const packageStates = useMemo<PackageStateFacet[]>(() => {
    const counts = new Map<string, number>();

    for (const report of reports ?? []) {
      const readiness = readinessAudit ? readinessBySlug.get(report.slug) ?? null : undefined;
      for (const state of deriveAgentReadinessState(report, readiness).packageStateLabels) {
        counts.set(state, (counts.get(state) ?? 0) + 1);
      }
      const officialOutputTarget = officialOutputCaptureTargetBySlug.get(report.slug);
      if (officialOutputTarget) {
        counts.set(OFFICIAL_OUTPUT_BLOCKERS_STATE, (counts.get(OFFICIAL_OUTPUT_BLOCKERS_STATE) ?? 0) + 1);
        if (officialEvidenceTierFor(officialOutputTarget.captureStatus) === "official-boundary-modeled") {
          counts.set(OFFICIAL_BOUNDARY_MODELED_STATE, (counts.get(OFFICIAL_BOUNDARY_MODELED_STATE) ?? 0) + 1);
        }
      }
    }

    const orderedStates = [
      ALL_PACKAGE_STATES,
      OFFICIAL_OUTPUT_BLOCKERS_STATE,
      OFFICIAL_BOUNDARY_MODELED_STATE,
      "Full parity",
      "Sample-backed formal",
      "Detail gap",
      "Sample-row backlog",
      "Local scaffold",
      "Needs formal evidence",
      "Needs identity evidence",
    ];

    return orderedStates
      .filter((label) => label === ALL_PACKAGE_STATES || counts.has(label))
      .map((label) => ({ label, count: counts.get(label) ?? 0 }));
  }, [officialOutputCaptureTargetBySlug, readinessAudit, readinessBySlug, reports]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const matches = (reports ?? []).filter((report) => {
      const catalogCategories = reportCategoryFacets(report);
      const readiness = readinessAudit ? readinessBySlug.get(report.slug) ?? null : undefined;
      const officialOutputTarget = officialOutputCaptureTargetBySlug.get(report.slug);
      const isOfficialOutputBlocker = Boolean(officialOutputTarget);
      const isOfficialBoundaryModeled =
        officialEvidenceTierFor(officialOutputTarget?.captureStatus) === "official-boundary-modeled";
      const matchesCategory = category === "All" || catalogCategories.includes(category);
      const matchesPackageState =
        packageState === ALL_PACKAGE_STATES ||
        (packageState === OFFICIAL_OUTPUT_BLOCKERS_STATE && isOfficialOutputBlocker) ||
        (packageState === OFFICIAL_BOUNDARY_MODELED_STATE && isOfficialBoundaryModeled) ||
        deriveAgentReadinessState(report, readiness).packageStateLabels.includes(packageState);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [report.title, report.summary, report.category, report.provider, report.searchText, ...catalogCategories, ...report.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesPackageState && matchesSearch;
    });

    return matches.sort((a, b) => {
      if (packageState === OFFICIAL_OUTPUT_BLOCKERS_STATE || packageState === OFFICIAL_BOUNDARY_MODELED_STATE) {
        return (
          (officialOutputCaptureTargetBySlug.get(a.slug)?.priority ?? 999) -
            (officialOutputCaptureTargetBySlug.get(b.slug)?.priority ?? 999) ||
          a.title.localeCompare(b.title)
        );
      }
      if (sortBy === "readiness") {
        const ar = readinessBySlug.get(a.slug);
        const br = readinessBySlug.get(b.slug);
        return (
          Number(Boolean(br?.formalEquivalentReady)) - Number(Boolean(ar?.formalEquivalentReady)) ||
          Number(Boolean(br?.sampleBackedFormalReady)) - Number(Boolean(ar?.sampleBackedFormalReady)) ||
          (br?.evidence.exactCitationRows ?? 0) - (ar?.evidence.exactCitationRows ?? 0) ||
          readinessScore(b) - readinessScore(a) ||
          a.title.localeCompare(b.title)
        );
      }
      if (sortBy === "category") {
        return `${a.category} ${a.title}`.localeCompare(`${b.category} ${b.title}`);
      }
      return a.title.localeCompare(b.title);
    });
  }, [category, officialOutputCaptureTargetBySlug, packageState, readinessAudit, readinessBySlug, reports, search, sortBy]);

  const reportSlugSet = useMemo(() => new Set((reports ?? []).map((report) => report.slug)), [reports]);
  const reportBySlug = useMemo(() => new Map((reports ?? []).map((report) => [report.slug, report])), [reports]);

  useEffect(() => {
    if (packageState === ALL_PACKAGE_STATES || packageStates.some((state) => state.label === packageState)) {
      return;
    }

    setPackageState(ALL_PACKAGE_STATES);
  }, [packageState, packageStates]);

  const evidenceQueue = useMemo(() => {
    const rows = readinessAudit ?? [];
    const identityBacklog = rows.filter((row) => row.status === "authenticated-gap");
    const namedRows = rows.filter((row) => row.status !== "authenticated-gap");
    const sampleRowBacklog = namedRows.filter((row) => row.evidence.sampleRows === 0);
    const localScaffoldBacklog = namedRows.filter(
      (row) =>
        row.evidence.prompt &&
        row.evidence.localFixture &&
        row.evidence.outputSections > 0 &&
        !row.sampleBackedFormalReady,
    );
    const detailParityTargets = rows.filter((row) => row.sampleBackedFormalReady && !row.formalEquivalentReady);
    const formalParityBacklog = rows.filter((row) => !row.formalEquivalentReady);

    return {
      identityBacklog,
      sampleRowBacklog,
      localScaffoldBacklog,
      detailParityTargets,
      formalParityBacklog,
    };
  }, [readinessAudit]);

  useEffect(() => {
    const syncSelectedReportFromLocation = () => {
      setSelectedSlug(getSelectedSlugFromLocation());
    };

    syncSelectedReportFromLocation();
    window.addEventListener("popstate", syncSelectedReportFromLocation);
    return () => window.removeEventListener("popstate", syncSelectedReportFromLocation);
  }, []);

  useEffect(() => {
    if (!reports || reports.length === 0 || reports.some((report) => report.slug === selectedSlug)) {
      return;
    }

    setSelectedSlug(DEFAULT_SLUG);
    writeSelectedSlugToLocation(DEFAULT_SLUG, "replace");
  }, [reports, selectedSlug]);

  const handleSelectReport = (slug: string) => {
    setSelectedSlug(slug);
    writeSelectedSlugToLocation(slug);
    window.requestAnimationFrame(() => {
      document.getElementById("report-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const copyOfficialCaptureCommands = async (target: (typeof officialOutputCaptureTargets)[number]) => {
    const captureStatus = target.captureStatus;
    const publicCaptureOpportunity = captureStatus?.publicCapturePriorityOpportunitySummary ?? null;
    const committedPath = captureStatus?.committedCapturePath ?? target.expectedSanitizedArtifactPath;
    const publicCaptureSessionCommand =
      publicCaptureOpportunity?.publicNextCommand ??
      captureStatus?.publicCaptureSessionCommand ??
      `npm run scaffold:capture-session -- --source public --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}.md`;
    const commands = [
      "# Official-output capture workflow",
      "# Public/non-private official sample, reportFile, or export path",
      publicCaptureOpportunity
        ? `# Public capture opportunity: ${publicCaptureOpportunity.opportunityClass} - ${publicCaptureOpportunity.summary}`
        : null,
      publicCaptureOpportunity?.publicNextStep ? `# ${publicCaptureOpportunity.publicNextStep}` : null,
      publicCaptureSessionCommand,
      captureStatus?.publicCaptureTemplateCommand ?? target.templateCommand,
      `npm run scaffold:template-audit -- --report ${target.slug}`,
      "# Private completed-output path; keep the filled input ignored under .soma/private",
      `npm run scaffold:capture-session -- --source private --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}-private.md`,
      target.redactionTemplateCommand,
      captureStatus?.dryRunSanitizeCommand ?? target.dryRunSanitizeCommand,
      captureStatus?.sanitizeDraftCommand ?? target.sanitizeRedactionCommand,
      captureStatus?.validateDraftCaptureCommand,
      captureStatus?.commitSanitizedCaptureCommand ?? target.commitSanitizedCaptureCommand,
      captureStatus?.validateCommittedCaptureCommand ??
        `npm run scaffold:validate-captures -- --path ${committedPath}`,
      "npm run scaffold:capture-status:snapshot",
      (captureStatus?.rowEvidencePromotionReadyCaptures ?? captureStatus?.promotionCandidates ?? 0) > 0 &&
      !captureStatus?.officialOutputPromotionReview
        ? captureStatus?.promotionPreviewCommittedCommand ??
          `npm run scaffold:promotion-preview -- --path ${committedPath}`
        : "# Promotion preview stays hidden until validate-captures reports rowEvidencePromotionReady: true and no manual review block is present.",
    ].filter((command): command is string => Boolean(command));

    await navigator.clipboard.writeText(commands.join("\n"));
  };

  const copyOfficialEvidencePacket = async (target: FormalEvidenceTarget) => {
    const packet = officialEvidencePacketFor(target);
    if (!packet) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(packet, null, 2));
  };

  const copyOfficialCaptureBoardCommands = async () => {
    const commands = [
      "# Official-output capture board refresh",
      "npm run scaffold:capture-status:snapshot",
      "npm run scaffold:capture-plan -- --format compact",
      "npm run scaffold:next-actions -- --format compact",
      "npm run scaffold:next-actions -- --format md --out tmp/official-output-next-actions.md",
      "npm run scaffold:capture-session -- --source public --format md --out tmp/official-output-capture-session-public.md",
      "npm run scaffold:capture-session -- --source private --format md --out tmp/official-output-capture-session-private.md",
      "npm run scaffold:capture-session -- --source both --format md --out tmp/official-output-capture-session.md",
      "npm run scaffold:validate-captures",
      "npm run scaffold:evidence-audit",
      "npm run completion:audit -- --format compact",
    ];

    await navigator.clipboard.writeText(commands.join("\n"));
  };

  const officialCaptureStatus = formalEvidenceBacklogSummary.officialOutputCaptureStatus;
  const officialCaptureCatalogSnapshot =
    officialCaptureStatus.catalogSnapshot ?? formalEvidenceBacklogSummary.catalogSnapshot;
  const auditedMarketplacePositionTotal =
    officialCaptureCatalogSnapshot.authenticatedMarketplacePositions || SEQUENCING_CARD_POSITION_TOTAL;
  const auditedNamedPackageTotal =
    officialCaptureCatalogSnapshot.identifiedNamedPackages || SEQUENCING_NAMED_IDENTITY_TOTAL;
  const auditedDuplicatePlacementTotal =
    officialCaptureCatalogSnapshot.authenticatedDuplicateCardPositions || AUTHENTICATED_DUPLICATE_POSITION_TOTAL;
  const seededCount = catalogStats?.seeded ?? reports?.length ?? 0;
  const targetTotal = catalogStats?.knownMarketplaceTotal ?? auditedMarketplacePositionTotal;
  const statsLoaded = Boolean(catalogStats || reports);
  const identifiedCount =
    catalogStats?.identifiedMarketplaceItems ??
    (reports ? Math.min(seededCount, auditedNamedPackageTotal) : auditedNamedPackageTotal);
  const namedPackageTotal = identifiedCount || seededCount || auditedNamedPackageTotal;
  const displayedIdentifiedCount = statsLoaded ? identifiedCount : auditedNamedPackageTotal;
  const identityEvidenceGap =
    catalogStats?.unknownMarketplaceItems ?? (readinessAudit ? evidenceQueue.identityBacklog.length : undefined);
  const duplicateStructuredPositions =
    catalogStats?.authenticatedDuplicateStructuredPositions ?? auditedDuplicatePlacementTotal;
  const positionIdentityDelta =
    catalogStats?.positionIdentityDelta ??
    (reports ? Math.max(targetTotal - identifiedCount, 0) : undefined);
  const namedSampleBacklog =
    catalogStats && readinessAudit
      ? evidenceQueue.sampleRowBacklog.length
      : catalogStats
        ? Math.max((catalogStats.identifiedMarketplaceItems ?? 0) - (catalogStats.sampleExtracted ?? 0), 0)
        : undefined;
  const localScaffoldBacklog = readinessAudit ? evidenceQueue.localScaffoldBacklog.length : undefined;
  const detailParityGap =
    catalogStats && readinessAudit
      ? evidenceQueue.detailParityTargets.length
      : catalogStats
        ? Math.max(catalogStats.sampleBackedFormalReady - catalogStats.formalEquivalentReady, 0)
        : undefined;
  const formalParityGap =
    catalogStats && readinessAudit
      ? evidenceQueue.formalParityBacklog.length
      : catalogStats
        ? Math.max(namedPackageTotal - catalogStats.formalEquivalentReady, 0)
        : undefined;
  const nextDetailTargets = evidenceQueue.detailParityTargets.slice(0, DETAIL_TARGET_LIMIT);
  const nextSampleRowTargets = evidenceQueue.sampleRowBacklog.slice(0, DETAIL_TARGET_LIMIT);
  const nextLocalScaffoldTargets = evidenceQueue.localScaffoldBacklog.slice(0, DETAIL_TARGET_LIMIT);
  const nextMissingExactDetailTargets = formalEvidenceBacklogSummary.missingExactDetailDecisions.slice(
    0,
    DETAIL_TARGET_LIMIT,
  );
  const officialCaptureTotals = officialCaptureStatus.totals;
  const committedOfficialCaptureCount =
    officialCaptureTotals.committedOfficialOutputCaptureArtifacts ??
    officialCaptureTotals.officialOutputCaptureArtifacts;
  const committedRowEvidenceReadyCaptureCount =
    officialCaptureTotals.committedRowEvidenceReadyCaptures ?? officialCaptureTotals.rowEvidenceReadyTargets;
  const rowEvidencePromotionReadyTargetCount =
    officialCaptureTotals.rowEvidencePromotionReadyTargets ?? officialCaptureTotals.promotionCandidateTargets;
  const committedRowEvidencePromotionReadyCaptureCount =
    officialCaptureTotals.committedRowEvidencePromotionReadyCaptures ??
    officialCaptureTotals.committedPromotionCandidates ??
    rowEvidencePromotionReadyTargetCount;
  const committedUnblockedPromotionCandidateCount = officialCaptureTotals.committedPromotionCandidates ?? 0;
  const gitTrackedOfficialCaptureCount = officialCaptureTotals.gitTrackedOfficialOutputCaptureArtifacts ?? 0;
  const gitUntrackedOfficialCaptureCount = officialCaptureTotals.gitUntrackedOfficialOutputCaptureArtifacts ?? 0;
  const gitTrackedRowEvidenceReadyCaptureCount = officialCaptureTotals.gitTrackedRowEvidenceReadyCaptures ?? 0;
  const outsideCurrentBlockerLedgerCaptureCount = officialCaptureTotals.outsideCurrentBlockerLedgerCaptures ?? 0;
  const officialBoundaryModeledTargetCount =
    officialCaptureTotals.officialBoundaryModeledTargets ??
    officialOutputCaptureTargets.filter(
      (target) => officialEvidenceTierFor(target.captureStatus) === "official-boundary-modeled",
    ).length;
  const officialBoundaryModeledFormalFieldCount =
    officialCaptureTotals.officialBoundaryModeledFormalFields ??
    officialOutputCaptureTargets.reduce(
      (total, target) => total + (target.captureStatus?.officialBoundaryModeledFields ?? 0),
      0,
    );
  const officialMetadataOnlyTargetCount =
    officialCaptureTotals.reviewedMetadataOnlyTargets ??
    officialOutputCaptureTargets.filter(
      (target) => officialEvidenceTierFor(target.captureStatus) === "official-metadata-only",
    ).length;
  const nonTargetOfficialOutputCaptures = officialCaptureStatus.nonTargetOfficialOutputCaptures;
  const officialCaptureStageCounts = Object.entries(officialCaptureStatus.statusCounts);
  const officialOutputActionCounts = formalEvidenceBacklogSummary.officialOutputActionCounts;
  const completedOutputRequiredCount =
    formalEvidenceBacklogSummary.officialOutputCompletedOutputRequiredTargets;
  const missingExactDetailCaptureTargets = formalEvidenceBacklogSummary.missingExactDetailTargets;
  const metadataOnlyCaptureTargets = formalEvidenceBacklogSummary.exactDetailMetadataOnlyTargets;
  const officialOutputCaptureStageBySlug = new Map(
    officialOutputCaptureTargets.map((target) => [target.slug, target.captureStatus?.stage ?? null] as const),
  );
  const localScaffoldDetailOnlyCount = readinessAudit
    ? evidenceQueue.localScaffoldBacklog.filter((row) => !row.declaredGaps.includes("detail")).length
    : undefined;
  const localScaffoldNoExactDetailCount = readinessAudit
    ? evidenceQueue.localScaffoldBacklog.filter((row) => row.declaredGaps.includes("detail")).length
    : undefined;
  const unresolvedSlotTargets =
    identityEvidenceGap !== undefined && identityEvidenceGap > 0
      ? Array.from({ length: Math.min(identityEvidenceGap, UNRESOLVED_SLOT_TARGET_LIMIT) }, (_, index) => {
          const slotNumber = identifiedCount + index + 1;
          return {
            id: `authenticated-marketplace-unresolved-slot-${slotNumber}`,
            label: `Unresolved authenticated identity target ${index + 1} of ${identityEvidenceGap}`,
          };
        })
      : [];
  const marketplacePositions = marketplacePositionLedger?.positions ?? [];
  const marketplaceDuplicateGroups = marketplacePositionLedger?.duplicateGroups ?? [];
  const marketplaceOrderAliases = Object.entries(marketplacePositionLedger?.orderSlugAliases ?? {});
  const marketplaceRouteAliases = Object.entries(
    marketplacePositionLedger?.marketplaceSlugAliases ?? DEFAULT_MARKETPLACE_ROUTE_ALIASES,
  );
  const marketplacePositionCount = marketplacePositionLedger ? marketplacePositions.length : targetTotal;
  const marketplaceUniqueHrefCount = marketplacePositionLedger?.totals.uniqueHrefs;
  const marketplaceDuplicatePlacementCount =
    marketplacePositionLedger?.totals.duplicatePlacements ?? duplicateStructuredPositions;
  const marketplaceCapturedAt = marketplacePositionLedger?.capturedAt ?? "...";

  return (
    <>
      <div className="theme-dark">
        <header>
          <div className="container nav-inner">
            <div className="logo" aria-label="SomaReports">
              <div className="logo-mark" />
              soma_reports
            </div>
            <nav className="nav-links" aria-label="Primary">
              <a href="#marketplace" className="active">
                Marketplace
              </a>
              <a href="#local-run">Local Run</a>
              <a href="#prompt">Agent Prompt</a>
              <a href="#schema">Output Schema</a>
              <a href="#references">References</a>
            </nav>
          </div>
        </header>

        <section className="search-hero container">
          <h1 className="text-hero">
            Genome Report
            <br />
            Marketplace
          </h1>
          <p className="body-text hero-copy">
            Browse report packages, derive local evidence, prepare agent input, and validate returned JSON
            without uploading raw genome data.
          </p>

          <div className="search-container">
            <div className="eyebrow search-label">Find a report</div>
            <div className="search-input-wrapper">
              <svg
                className="search-icon"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                placeholder="e.g. Wellness, APOE, PGx, Fitness..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </section>
      </div>

      <main id="marketplace" className="theme-light marketplace-wrapper container">
        <div className="notice-strip">
          <div>
            <span className="eyebrow">Curation status</span>
            <p>
              Sequencing.com marketplace pages are account-gated in public browsing. Authenticated
              browsing and page props showed {targetTotal} structured marketplace report/card
              positions across {AUTHENTICATED_PAGE_COUNT} pages of 75, 75, and 14 cards. The current local seed tracks{" "}
              {displayedIdentifiedCount} unique named packages behind those positions: 150 public URLs plus{" "}
              {catalogStats?.namedAuthenticatedOnly ?? 4} named authenticated-only cards. Page props collapse to 87 unique current hrefs with{" "}
              {duplicateStructuredPositions} duplicate category placements; true unidentified authenticated identities:{" "}
              {formatGapCount(statsLoaded ? identityEvidenceGap : undefined)}. The {formatGapCount(positionIdentityDelta)} more
              marketplace positions than seeded named identities are bookkeeping, not a coverage or evidence gap. Local
              runs stay separate from that evidence ledger: derived evidence can be prepared without raw genome upload,
              but the {formalEvidenceBacklogSummary.scaffoldPackages} scaffold-only blockers remain non-promotional
              until source-backed sample rows, formal fields, and citation bindings are captured.
            </p>
          </div>
          <div className="catalog-stats" aria-label="Catalog coverage">
            <div>
              <strong>{statsLoaded ? `${identifiedCount} unique` : "..."}</strong>
              <span>{targetTotal} positions tracked</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.referencesReady, namedPackageTotal)}</strong>
              <span>Background refs</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.sampleExtracted, namedPackageTotal)}</strong>
              <span>Sample extracted</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.promptReady, namedPackageTotal)}</strong>
              <span>Agent prompt</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.outputFormatReady, namedPackageTotal)}</strong>
              <span>Output schema</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.formalFieldsReady, namedPackageTotal)}</strong>
              <span>Formal map</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.localFixtureReady, namedPackageTotal)}</strong>
              <span>Local fixture</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.citationBindingsReady, namedPackageTotal)}</strong>
              <span>Row citations</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.sampleBackedFormalReady, namedPackageTotal)}</strong>
              <span>Sample-backed formal</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.formalEquivalentReady, namedPackageTotal)}</strong>
              <span>Full parity</span>
            </div>
            <div>
              <strong>
                {officialOutputCaptureTargets.length}/{officialCaptureCatalogSnapshot.formalPendingPackages}
              </strong>
              <span>Official blockers</span>
            </div>
          </div>
        </div>

        <section className="marketplace-proof-strip" aria-label="Authenticated marketplace coverage proof">
          <div>
            <span className="eyebrow">Authenticated coverage proof</span>
            <strong>{marketplacePositionCount} Sequencing.com positions verified</strong>
            <p>
              The local app models {auditedNamedPackageTotal} named report identities and keeps{" "}
              {marketplaceDuplicatePlacementCount} duplicate category placements in the position ledger instead of
              seeding duplicate packages.
            </p>
          </div>
          <div className="marketplace-proof-metrics">
            <span>
              <strong>{marketplaceUniqueHrefCount ?? "..."}</strong>
              unique hrefs
            </span>
            <span>
              <strong>{marketplaceDuplicateGroups.length}</strong>
              duplicate groups
            </span>
            <span>
              <strong>{marketplaceOrderAliases.length}</strong>
              order aliases
            </span>
            <span>
              <strong>{marketplaceRouteAliases.length}</strong>
              route aliases
            </span>
            <span>
              <strong>{marketplacePositionLedger?.totals.unresolvedAuthenticatedRecords ?? 0}</strong>
              unresolved identities
            </span>
          </div>
          <div className="marketplace-proof-sources">
            <span>{marketplacePositionLedger?.sourceArtifacts.pageProps ?? "authenticated page props pending"}</span>
            <span>{marketplacePositionLedger?.sourceArtifacts.normalized ?? "normalized ledger pending"}</span>
            <a
              href="#position-ledger"
              onClick={() => {
                const ledger = document.getElementById("position-ledger") as HTMLDetailsElement | null;
                if (ledger) {
                  ledger.open = true;
                }
              }}
            >
              Inspect all captured positions
            </a>
          </div>
        </section>

        <details id="position-ledger" className="position-ledger">
          <summary>
            <div>
              <span className="eyebrow">Marketplace evidence</span>
              <h2>Position ledger</h2>
            </div>
            <span className="meta-text">
              {marketplacePositionCount} positions / {marketplaceDuplicatePlacementCount} duplicate placements
            </span>
          </summary>

          <div className="position-ledger-panel" aria-label="Authenticated marketplace position ledger">
            <div className="detail-section-header">
              <div>
                <span className="eyebrow">Authenticated page-props ledger</span>
                <h3>
                  {marketplacePositionCount} captured positions, {marketplaceUniqueHrefCount ?? "..."} current hrefs
                </h3>
              </div>
              <span className="meta-text">captured {marketplaceCapturedAt}</span>
            </div>
            <p>
              This ledger comes from authenticated Next.js page props. It lists every Sequencing.com marketplace group
              placement, so duplicate category placements stay visible without being seeded as duplicate report packages.
            </p>
            <div className="position-ledger-stats">
              <div>
                <strong>{marketplacePositionCount}</strong>
                <span>Group positions</span>
              </div>
              <div>
                <strong>{marketplaceUniqueHrefCount ?? "..."}</strong>
                <span>Unique hrefs</span>
              </div>
              <div>
                <strong>{marketplaceDuplicatePlacementCount}</strong>
                <span>Duplicate placements</span>
              </div>
              <div>
                <strong>{marketplaceDuplicateGroups.length}</strong>
                <span>Duplicate href groups</span>
              </div>
              <div>
                <strong>{marketplaceOrderAliases.length}</strong>
                <span>Order aliases</span>
              </div>
            </div>

            <div className="position-ledger-columns">
              <div>
                <div className="detail-section-header">
                  <span className="eyebrow">Duplicate placement groups</span>
                  <span className="meta-text">{marketplaceDuplicateGroups.length} groups</span>
                </div>
                <ol className="position-duplicate-list">
                  {marketplaceDuplicateGroups.map((group) => (
                    <li key={group.href}>
                      <strong>{group.title}</strong>
                      <span>
                        {group.positionCount} placements: {group.groupLabels.join(", ")}
                      </span>
                      <small>{group.canonicalSlug}</small>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="detail-section-header">
                  <span className="eyebrow">Order aliases</span>
                  <span className="meta-text">{marketplaceOrderAliases.length} canonicalized</span>
                </div>
                <div className="alias-list">
                  {marketplaceOrderAliases.map(([orderSlug, canonicalSlug]) => (
                    <div key={orderSlug}>
                      <strong>{orderSlug}</strong>
                      <span>{canonicalSlug}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="detail-section-header">
                  <span className="eyebrow">Route aliases</span>
                  <span className="meta-text">{marketplaceRouteAliases.length} current hrefs canonicalized</span>
                </div>
                <div className="route-alias-list">
                  {marketplaceRouteAliases.map(([routeSlug, canonicalSlug]) => (
                    <div key={routeSlug}>
                      <strong>{routeSlug}</strong>
                      <span>{canonicalSlug}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="position-table-wrap">
              <div className="detail-section-header">
                <span className="eyebrow">All captured positions</span>
                <span className="meta-text">{marketplacePositionCount} rows</span>
              </div>
              <div className="position-table">
                <div className="position-row header">
                  <span>#</span>
                  <span>Group</span>
                  <span>Report</span>
                  <span>Provider</span>
                  <span>Package evidence</span>
                  <span>Action</span>
                </div>
                {marketplacePositionLedger ? (
                  marketplacePositions.map((position) => {
                    const packageSlug = position.canonicalSlug || position.slug;
                    const hasSeededPackage = reportSlugSet.has(packageSlug);
                    const positionReport = reportBySlug.get(packageSlug);
                    const positionReadiness = readinessAudit ? readinessBySlug.get(packageSlug) ?? null : undefined;
                    const positionReadinessState = positionReport
                      ? deriveAgentReadinessState(positionReport, positionReadiness)
                      : null;
                    const evidenceItems = positionReadiness
                      ? [
                          `Refs ${positionReadiness.evidence.references}`,
                          positionReadiness.evidence.prompt ? "Prompt" : "Prompt pending",
                          `Schema ${positionReadiness.evidence.outputSections}`,
                          positionReadiness.sampleBackedFormalReady ? "Sample rows" : "Sample rows pending",
                        ]
                      : positionReport
                        ? [
                            positionReport.curationCompleteness.references ? "Refs" : "Refs pending",
                            positionReport.curationCompleteness.prompt ? "Prompt" : "Prompt pending",
                            positionReport.curationCompleteness.outputFormat ? "Schema" : "Schema pending",
                            positionReport.curationCompleteness.sampleReport ? "Sample rows" : "Sample rows pending",
                          ]
                        : [];

                    return (
                      <div key={`${position.positionNumber}-${packageSlug}`} className="position-row">
                        <span>{position.positionNumber}</span>
                        <span>{position.groupLabel}</span>
                        <span>
                          <strong>{position.title}</strong>
                          <small>{position.priceLabel}</small>
                        </span>
                        <span>{position.provider}</span>
                        <span className="position-evidence">
                          <strong>{packageSlug}</strong>
                          {positionReadinessState ? (
                            <span className={`evidence-status evidence-status-${positionReadinessState.kind}`}>
                              {positionReadinessState.label}
                            </span>
                          ) : (
                            <em>Package identity pending</em>
                          )}
                          {evidenceItems.length > 0 ? (
                            <span className="position-evidence-strip">
                              {evidenceItems.map((item) => (
                                <span key={`${packageSlug}-${item}`}>{item}</span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        <span className="position-action">
                          {hasSeededPackage ? (
                            <button
                              type="button"
                              aria-label={`Inspect ${position.title}`}
                              onClick={() => handleSelectReport(packageSlug)}
                            >
                              Inspect
                            </button>
                          ) : (
                            <em>Evidence needed</em>
                          )}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="position-row">
                    <span>...</span>
                    <span>Loading</span>
                    <span>
                      <strong>Loading authenticated position ledger</strong>
                      <small>Convex query pending</small>
                    </span>
                    <span>...</span>
                    <span>...</span>
                    <span>...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </details>

        <section className="gap-ledger" aria-label="Evidence gap queue">
          <div className="gap-ledger-header">
            <div>
              <span className="eyebrow">Evidence queue</span>
              <h2>What is still missing</h2>
            </div>
            <p>
              This queue is derived from Convex readiness rows. It separates true unidentified identities,
              missing sample-backed row extraction, and detail-page parity so incomplete reports stay visible
              while the catalog tracks {targetTotal} authenticated positions and {displayedIdentifiedCount} named identities.
            </p>
          </div>

          <div className="gap-ledger-grid">
            <div>
              <span className="meta-text">Unidentified identities</span>
              <strong>{formatGapCount(identityEvidenceGap)}</strong>
              <p>New reports need non-duplicate page, JSON, screenshot, or detail evidence before they are seeded.</p>
            </div>
            <div>
              <span className="meta-text">Sample-backed rows</span>
              <strong>{formatGapCount(namedSampleBacklog)}</strong>
              <p>Named reports need official or package-specific sample/completed output, formal rows, and row-level source bindings.</p>
            </div>
            <div>
              <span className="meta-text">Local scaffold only</span>
              <strong>{formatGapCount(localScaffoldBacklog)}</strong>
              <p>
                Prompt, fixture, and schema exist, but source-backed sample rows are not available.{" "}
                {formatGapCount(localScaffoldDetailOnlyCount)} have detail metadata only;{" "}
                {formatGapCount(localScaffoldNoExactDetailCount)} still need exact detail-route evidence.
              </p>
            </div>
            <div>
              <span className="meta-text">Detail parity</span>
              <strong>{formatGapCount(detailParityGap)}</strong>
              <p>Sample-backed formal packages need authenticated detail-page parity before they count as full matches.</p>
            </div>
            <div>
              <span className="meta-text">Formal parity</span>
              <strong>{formatGapCount(formalParityGap)}</strong>
              <p>Reports not yet proven equivalent to Sequencing.com-style formal output.</p>
            </div>
          </div>

          <div className="formal-backlog-panel" aria-label="Formal evidence blocker ledger">
            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Formal blocker ledger</span>
                <span className="meta-text">captured {formalEvidenceBacklogSummary.capturedAt}</span>
              </div>
              <p>
                The blocker ledger covers {formalEvidenceBacklogSummary.scaffoldPackages} scaffold-only reports. It
                separates route/order evidence from exact detail metadata and keeps every report blocked until a capture
                exposes a non-empty report file, sample rows, formal fields, or row-level citations.
              </p>
              <div className="formal-status-list">
                {formalEvidenceBacklogSummary.evidenceStatusCounts.map((row) => (
                  <span key={row.evidenceStatus}>
                    <strong>{row.count}</strong>
                    {formatGapLabel(row.evidenceStatus)}
                  </span>
                ))}
              </div>
              <div className="formal-status-list official-capture-status-list">
                <span>
                  <strong>
                    {officialCaptureTotals.captureTemplatesPresent}/{officialCaptureTotals.targets}
                  </strong>
                  capture templates
                </span>
                <span>
                  <strong>{officialCaptureTotals.officialOutputCaptureArtifacts}</strong>
                  blocker captures
                </span>
                <span>
                  <strong>{committedOfficialCaptureCount}</strong>
                  repo-path captures
                </span>
                <span>
                  <strong>{gitTrackedOfficialCaptureCount}</strong>
                  git-tracked captures
                </span>
                <span>
                  <strong>{gitUntrackedOfficialCaptureCount}</strong>
                  untracked captures
                </span>
                <span>
                  <strong>{outsideCurrentBlockerLedgerCaptureCount}</strong>
                  outside blocker ledger
                </span>
                <span>
                  <strong>{officialCaptureTotals.rowEvidenceReadyTargets}</strong>
                  blocker row-ready
                </span>
                <span>
                  <strong>{rowEvidencePromotionReadyTargetCount}</strong>
                  blocker row-evidence promotable
                </span>
                <span>
                  <strong>{committedRowEvidenceReadyCaptureCount}</strong>
                  repo-path row-ready
                </span>
                <span>
                  <strong>{committedRowEvidencePromotionReadyCaptureCount}</strong>
                  repo-path row-evidence promotable
                </span>
                <span>
                  <strong>{committedUnblockedPromotionCandidateCount}</strong>
                  unblocked blocker candidates
                </span>
                <span>
                  <strong>{officialCaptureTotals.manualPromotionBlockedCaptures ?? 0}</strong>
                  review-blocked captures
                </span>
                <span>
                  <strong>{gitTrackedRowEvidenceReadyCaptureCount}</strong>
                  git-tracked row-ready
                </span>
                <span>
                  <strong>
                    {officialCaptureTotals.unreviewedOutputSignalReviewTargets ??
                      officialCaptureTotals.unreviewedPromotionCandidateTargets ??
                      officialCaptureTotals.outputSignalReviewTargets ??
                      officialCaptureTotals.promotionCandidateTargets}
                  </strong>
                  unreviewed output signals
                </span>
                <span>
                  <strong>{officialCaptureTotals.reviewedNoPromoteTargets ?? 0}</strong>
                  reviewed no-promote
                </span>
                <span>
                  <strong>{officialCaptureTotals.reviewedBoundaryOnlyTargets ?? 0}</strong>
                  reviewed boundary-only
                </span>
                <span>
                  <strong>{officialCaptureTotals.reviewedMetadataOnlyTargets ?? 0}</strong>
                  reviewed metadata-only
                </span>
                <span>
                  <strong>{officialBoundaryModeledTargetCount}</strong>
                  official-boundary modeled
                </span>
                <span>
                  <strong>{officialBoundaryModeledFormalFieldCount}</strong>
                  boundary-modeled fields
                </span>
                <span>
                  <strong>{officialMetadataOnlyTargetCount}</strong>
                  metadata-only
                </span>
                <span>
                  <strong>{completedOutputRequiredCount}</strong>
                  completed-output required
                </span>
                <span>
                  <strong>{officialOutputActionCounts["completed-output-required-boundary-capture"] ?? 0}</strong>
                  boundary captures waiting
                </span>
                <span>
                  <strong>{officialOutputActionCounts["completed-output-required-metadata-only"] ?? 0}</strong>
                  metadata-only waiting
                </span>
                {officialCaptureStageCounts.map(([stage, count]) => (
                  <span key={stage}>
                    <strong>{count}</strong>
                    {formatGapLabel(stage)}
                  </span>
                ))}
              </div>
              {nonTargetOfficialOutputCaptures.length > 0 ? (
                <div className="official-capture-non-target-list">
                  <strong>Committed captures outside this blocker ledger</strong>
                  {nonTargetOfficialOutputCaptures.map((capture) => (
                    <span key={capture.path}>
                      {capture.title ?? capture.slug}: {capture.ok ? "valid" : "invalid"},{" "}
                      {capture.rowEvidenceReady ? "row-ready" : "not row-ready"};{" "}
                      {formatOutputSignals(capture.outputSignals)}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="official-capture-non-target-list">
                <strong>Non-promotion caveats</strong>
                {officialOutputCaptureCaveats.map((caveat) => (
                  <span key={caveat}>{caveat}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Promotion standard</span>
                <span className="meta-text">
                  {formalEvidenceBacklogSummary.missingExactDetailDecisions.length} need exact route evidence
                </span>
              </div>
              <ul className="formal-standard-list">
                {formalEvidenceBacklogSummary.promotionStandard.slice(0, 3).map((standard) => (
                  <li key={standard}>{standard}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="official-capture-board" aria-label="Official output capture board">
            <div className="detail-section-header">
              <div>
                <span className="eyebrow">Official output capture board</span>
                <h3>
                  {officialCaptureTotals.captureTemplatesPresent} placeholder templates present,{" "}
                  {officialCaptureTotals.officialOutputCaptureArtifacts} blocker captures /{" "}
                  {committedOfficialCaptureCount} repo-path captures / {gitTrackedOfficialCaptureCount} git-tracked
                </h3>
                <p className="official-capture-context">
                  Current ledger: {officialCaptureCatalogSnapshot.formalPendingPackages} formal blockers across{" "}
                  {officialCaptureCatalogSnapshot.identifiedNamedPackages} named packages /{" "}
                  {officialCaptureCatalogSnapshot.authenticatedMarketplacePositions} authenticated marketplace positions.
                  Evidence tiers: {officialBoundaryModeledTargetCount} official-boundary modeled,{" "}
                  {officialMetadataOnlyTargetCount} metadata-only, {officialCaptureTotals.rowEvidenceReadyTargets} row-ready.
                  Export source-specific packets with `npm run scaffold:capture-session -- --source public --format md --out tmp/official-output-capture-session-public.md`,
                  `npm run scaffold:capture-session -- --source private --format md --out tmp/official-output-capture-session-private.md`,
                  or `npm run scaffold:capture-session -- --source both --format md --out tmp/official-output-capture-session.md`.
                </p>
              </div>
              <span className="meta-text">snapshot {officialCaptureStatus.generatedAt}</span>
            </div>
            <div className="completion-workbench" aria-label="Completion gap workbench">
              <div className="detail-section-header">
                <div>
                  <span className="eyebrow">Completion gap workbench</span>
                  <h3>{officialOutputCaptureTargets.length} scaffold-only reports need official output rows</h3>
                  <p className="official-capture-context">
                    Next-actions coverage should stay {officialOutputCaptureTargets.length}/
                    {officialCaptureCatalogSnapshot.formalPendingPackages} blocker rows before any capture session.
                  </p>
                </div>
                <div className="detail-actions">
                  <span className="meta-text">
                    {officialCaptureTotals.rowEvidenceReadyTargets} blocker row-ready /{" "}
                    {committedRowEvidenceReadyCaptureCount} repo-path row-ready / {gitTrackedRowEvidenceReadyCaptureCount} git-tracked
                  </span>
                  <button className="btn btn-outline" type="button" onClick={() => void copyOfficialCaptureBoardCommands()}>
                    Copy queue commands
                  </button>
                </div>
              </div>
              <div className="completion-workbench-table">
                <div className="completion-workbench-row header">
                  <span>Priority</span>
                  <span>Report</span>
                  <span>Class / stage</span>
                  <span>Route / app</span>
                  <span>Captures</span>
                  <span>First evidence needed</span>
                  <span>Action</span>
                  <span>Next command</span>
                </div>
                {officialOutputCaptureTargets.map((target) => {
	                  const captureStatus = target.captureStatus;
	                  const liveDetailInspection = target.liveDetailInspection ?? captureStatus?.liveDetailInspection ?? null;
	                  const latestRouteProbe = captureStatus?.latestRouteProbe ?? null;
	                  const publicBundleEvidence = captureStatus?.publicBundleEvidence ?? null;
	                  const publicCaptureOpportunity = captureStatus?.publicCapturePriorityOpportunitySummary ?? null;
	                  const publicCaptureSessionCommand =
	                    publicCaptureOpportunity?.publicNextCommand ??
	                    captureStatus?.publicCaptureSessionCommand ??
	                    `npm run scaffold:capture-session -- --source public --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}.md`;
	                  const actionClass = target.actionClass;
                  const officialEvidenceTier = officialEvidenceTierFor(captureStatus);
                  const officialEvidenceTierLabel = officialEvidenceTierLabelFor(captureStatus);
                  const actionBoundary = officialOutputActionBoundaryFor(captureStatus);
                  const nextEvidence = officialOutputNextEvidenceFor(captureStatus);
                  const reviewMissing = captureStatus?.officialOutputReviewEvidenceMissing ?? [];
                  const gateMissing = captureStatus?.formalReadinessGate?.missing ?? [];
                  const missingEvidence = reviewMissing.length > 0 ? reviewMissing : gateMissing;
                  const outputSignalSummary = formatOutputSignals(captureStatus?.formalReadinessGate?.currentOutputSignals);
                  const nextCommand =
                    captureStatus?.nextCommand ??
                    target.templateCommand ??
                    target.redactionTemplateCommand ??
                    captureStatus?.dryRunSanitizeCommand ??
                    target.dryRunSanitizeCommand ??
                    captureStatus?.sanitizeDraftCommand ??
                    target.sanitizeRedactionCommand ??
                    captureStatus?.commitSanitizedCaptureCommand ??
                    target.commitSanitizedCaptureCommand;
                  const commandChain = compactCommandChain([
                    captureStatus?.publicCaptureTemplateCommand ?? target.templateCommand,
                    `npm run scaffold:template-audit -- --report ${target.slug}`,
                    publicCaptureSessionCommand,
                    `npm run scaffold:capture-session -- --source private --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}-private.md`,
                    nextCommand,
                    target.redactionTemplateCommand,
                    captureStatus?.dryRunSanitizeCommand,
                    target.dryRunSanitizeCommand,
                    captureStatus?.sanitizeDraftCommand,
                    target.sanitizeRedactionCommand,
                    captureStatus?.validateDraftCaptureCommand,
                    captureStatus?.commitSanitizedCaptureCommand,
                    target.commitSanitizedCaptureCommand,
                    captureStatus?.validateCommittedCaptureCommand,
                    ...(target.validationCommands ?? []),
                    "npm run scaffold:capture-status:snapshot",
                  ]);

                  return (
                    <div className="completion-workbench-row" key={target.slug}>
                      <span>{target.priority}</span>
                      <span>
                        <strong>{target.title}</strong>
                        <small>{target.slug}</small>
                      </span>
                      <span>
                        <span>{formatGapLabel(target.evidenceClass)}</span>
                        <span className={`evidence-status evidence-status-${actionClass}`}>
                          {formatGapLabel(actionClass)}
                        </span>
                        <span className={captureStageClass(captureStatus?.stage)}>
                          {captureStatus ? formatGapLabel(captureStatus.stage) : "status missing"}
                        </span>
                        <span className={`evidence-status evidence-status-${officialEvidenceTier}`}>
                          {officialEvidenceTierLabel}
                        </span>
                        {publicCaptureOpportunity ? (
                          <small>
                            Public opportunity {publicCaptureOpportunity.priorityLabel}:{" "}
                            {formatGapLabel(publicCaptureOpportunity.opportunityClass)}
                          </small>
                        ) : null}
                        <small>{actionBoundary}</small>
                      </span>
                      <span>
                        <strong>
                          {liveDetailInspection
                            ? liveDetailInspection.exactRoute
                              ? "exact route"
                              : "fallback route"
                            : "not inspected"}
                        </strong>
	                        <small>
	                          {liveDetailInspection?.apiAppId ?? "no app ID"} /{" "}
	                          {liveDetailInspection?.startButtonText || "no action"}
	                        </small>
	                        {latestRouteProbe ? (
	                          <small>
	                            latest probe: {formatGapLabel(latestRouteProbe.finalUrlKind ?? "unknown")} /{" "}
	                            reportData {latestRouteProbe.pagePropsReportData ? "yes" : "no"}
	                          </small>
	                        ) : null}
	                        {latestRouteProbe?.finalUrl ? <small>probe URL: {latestRouteProbe.finalUrl}</small> : null}
	                      </span>
                      <span>
                        {(captureStatus?.officialCaptures ?? 0).toString()} captured
                        <small>
                          {captureStatus?.rowEvidenceReadyCaptures ?? 0} row-ready /{" "}
                          {captureStatus?.rowEvidencePromotionReadyCaptures ?? captureStatus?.promotionCandidates ?? 0}{" "}
                          row-evidence promotable; {outputSignalSummary}
                        </small>
                      </span>
	                      <span>
	                        {nextEvidence[0] ?? target.firstRequiredEvidence}
	                        {(missingEvidence.length > 0 ? missingEvidence : [actionBoundary]).map((evidence) => (
	                          <small key={evidence}>{evidence}</small>
	                        ))}
	                        {publicBundleEvidence ? (
	                          <small>public evidence: {publicBundleEvidence.evidencePresent.length} boundary facts</small>
	                        ) : null}
	                        {publicCaptureOpportunity ? (
	                          <small>public capture: {publicCaptureOpportunity.summary}</small>
	                        ) : null}
	                        {publicCaptureOpportunity ? <small>{publicCaptureOpportunity.publicNextStep}</small> : null}
	                        {publicBundleEvidence ? (
	                          <small>
	                            still missing: {publicBundleEvidence.evidenceMissingForPromotion.slice(0, 2).join("; ")}
	                          </small>
	                        ) : null}
	                      </span>
                      <span className="completion-workbench-actions">
                        <button
                          className="btn btn-outline"
                          type="button"
                          onClick={() => handleSelectReport(target.slug)}
                        >
                          Inspect
                        </button>
                        <button
                          className="btn btn-outline"
                          type="button"
                          onClick={() => void copyOfficialCaptureCommands(target)}
                        >
                          Copy
                        </button>
                        <button
                          className="btn btn-outline"
                          type="button"
                          onClick={() => void copyOfficialEvidencePacket(target)}
                        >
                          Copy packet
                        </button>
                        {target.captureUrl ? (
                          <a href={target.captureUrl} target="_blank" rel="noreferrer">
                            Source
                          </a>
                        ) : null}
                      </span>
                      <span className="capture-command">
                        {commandChain.map((command) => (
                          <small key={command}>{command}</small>
                        ))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="official-capture-grid">
              {officialOutputCaptureTargets.map((target) => {
                const captureStatus = target.captureStatus;
                const artifactSummaries = captureStatus?.officialCaptureArtifactSummaries ?? [];
                const outputSignalReviewCapturePath =
                  captureStatus?.outputSignalReviewCapturePaths?.[0] ??
                  captureStatus?.promotionCandidateCapturePaths?.[0] ??
                  null;
                const promotionReview = captureStatus?.officialOutputPromotionReview ?? null;
                const actionClass = target.actionClass;
                const officialEvidenceTier = officialEvidenceTierFor(captureStatus);
                const officialEvidenceTierLabel = officialEvidenceTierLabelFor(captureStatus);
                const actionBoundary = officialOutputActionBoundaryFor(captureStatus);
                const nextEvidence = officialOutputNextEvidenceFor(captureStatus);
                const visibleFields = target.describedOutputFields.slice(0, 6);
                const hiddenFieldCount = Math.max(target.describedOutputFields.length - visibleFields.length, 0);
                const fieldSummary =
                  visibleFields.length > 0
                    ? `${visibleFields.join(", ")}${hiddenFieldCount > 0 ? `, +${hiddenFieldCount} more` : ""}`
                    : "Needs direct official output rows";
                const publicCaptureOpportunity = captureStatus?.publicCapturePriorityOpportunitySummary ?? null;
                const publicCaptureSessionCommand =
                  publicCaptureOpportunity?.publicNextCommand ??
                  captureStatus?.publicCaptureSessionCommand ??
                  `npm run scaffold:capture-session -- --source public --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}.md`;
                const nextCommand =
                  captureStatus?.nextCommand ??
                  target.templateCommand ??
                  target.redactionTemplateCommand ??
                  captureStatus?.dryRunSanitizeCommand ??
                  target.dryRunSanitizeCommand;
                const commandChain = compactCommandChain([
                  captureStatus?.publicCaptureTemplateCommand ?? target.templateCommand,
                  `npm run scaffold:template-audit -- --report ${target.slug}`,
                  publicCaptureSessionCommand,
                  `npm run scaffold:capture-session -- --source private --report ${target.slug} --format md --out tmp/official-output-capture-session-${target.slug}-private.md`,
                  nextCommand,
                  target.redactionTemplateCommand,
                  captureStatus?.dryRunSanitizeCommand,
                  target.dryRunSanitizeCommand,
                  captureStatus?.sanitizeDraftCommand,
                  target.sanitizeRedactionCommand,
                  captureStatus?.validateDraftCaptureCommand,
                  captureStatus?.commitSanitizedCaptureCommand,
                  target.commitSanitizedCaptureCommand,
                  captureStatus?.validateCommittedCaptureCommand,
                  ...(target.validationCommands ?? []),
                  "npm run scaffold:capture-status:snapshot",
                ]);
	                const liveDetailInspection = target.liveDetailInspection ?? captureStatus?.liveDetailInspection ?? null;
	                const latestRouteProbe = captureStatus?.latestRouteProbe ?? null;
	                const publicBundleEvidence = captureStatus?.publicBundleEvidence ?? null;
	                const formalGate = captureStatus?.formalReadinessGate ?? null;

                return (
                  <article key={target.slug} className="official-capture-card">
                    <div className="official-capture-card-header">
                      <div>
                        <strong>{target.title}</strong>
                        <span>{target.slug}</span>
                      </div>
                      {target.captureUrl ? (
                        <a href={target.captureUrl} target="_blank" rel="noreferrer">
                          Open detail
                        </a>
                      ) : (
                        <em>No source URL</em>
                      )}
                    </div>
                    <p>{captureStatus?.nextAction ?? target.firstRequiredEvidence}</p>
                    <dl className="official-capture-facts">
                      <div>
                        <dt>Stage</dt>
                        <dd>
                          <span className={captureStageClass(captureStatus?.stage)}>
                            {captureStatus ? formatGapLabel(captureStatus.stage) : "status missing"}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Action class</dt>
                        <dd>
                          <span className={`evidence-status evidence-status-${actionClass}`}>
                            {formatGapLabel(actionClass)}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Boundary tier</dt>
                        <dd>
                          <span className={`evidence-status evidence-status-${officialEvidenceTier}`}>
                            {officialEvidenceTierLabel}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt>Official captures</dt>
                        <dd>
                          {captureStatus?.officialCaptures ?? 0} captured /{" "}
                          {captureStatus?.rowEvidenceReadyCaptures ?? 0} row-ready /{" "}
                          {captureStatus?.rowEvidencePromotionReadyCaptures ?? captureStatus?.promotionCandidates ?? 0}{" "}
                          row-evidence promotable /{" "}
                          {captureStatus?.gitTrackedOfficialCapturePaths?.length ?? 0} git-tracked
                        </dd>
                      </div>
                      <div>
                        <dt>Template</dt>
                        <dd>
                          {captureStatus?.templateExists ? "placeholder present" : "missing"} /{" "}
                          {officialCaptureTotals.placeholderTemplates} placeholders
                        </dd>
                      </div>
	                      <div>
	                        <dt>Sequencing app</dt>
	                        <dd>
	                          {liveDetailInspection?.apiAppId ?? "none"} /{" "}
	                          {liveDetailInspection?.startButtonText || "no start action"}
	                        </dd>
	                      </div>
	                      <div>
	                        <dt>Latest route probe</dt>
	                        <dd>
	                          {latestRouteProbe
	                            ? `${formatGapLabel(latestRouteProbe.finalUrlKind ?? "unknown")} / reportData ${
	                                latestRouteProbe.pagePropsReportData ? "yes" : "no"
	                              }`
	                            : "not probed"}
	                        </dd>
	                      </div>
	                      <div>
	                        <dt>Route probe artifact</dt>
	                        <dd>{latestRouteProbe?.artifactPath ?? "none"}</dd>
	                      </div>
	                      <div>
	                        <dt>Route probe URL</dt>
	                        <dd>{latestRouteProbe?.finalUrl ?? latestRouteProbe?.requestedUrl ?? "none"}</dd>
	                      </div>
	                      <div>
	                        <dt>Public bundle evidence</dt>
	                        <dd>
	                          {publicBundleEvidence
	                            ? `${publicBundleEvidence.evidencePresent.length} boundary facts / ${publicBundleEvidence.evidenceMissingForPromotion.length} promotion gaps`
	                            : "none"}
	                        </dd>
	                      </div>
                      <div>
                        <dt>Public opportunity</dt>
                        <dd>
                          {publicCaptureOpportunity
                            ? `${publicCaptureOpportunity.priorityLabel} / ${formatGapLabel(
                                publicCaptureOpportunity.opportunityClass,
                              )}`
                            : "none"}
                        </dd>
                      </div>
	                      <div>
	                        <dt>Public evidence artifact</dt>
	                        <dd>{publicBundleEvidence?.artifactPath ?? "none"}</dd>
	                      </div>
                      <div>
                        <dt>Artifact</dt>
                        <dd>{outputSignalReviewCapturePath ?? target.expectedSanitizedArtifactPath}</dd>
                      </div>
                      <div>
                        <dt>Fields</dt>
                        <dd>{fieldSummary}</dd>
                      </div>
                    </dl>
                    {target.describedOutputFieldBoundary ? (
                      <p className="official-capture-boundary">{target.describedOutputFieldBoundary}</p>
                    ) : null}
                    <p className="official-capture-boundary">{actionBoundary}</p>
	                    {nextEvidence.length > 0 ? (
	                      <div className="official-capture-review">
                        <strong>Next official evidence</strong>
                        <ul>
                          {nextEvidence.map((evidence) => (
                            <li key={evidence}>{evidence}</li>
                          ))}
                        </ul>
	                      </div>
	                    ) : null}
	                    {publicBundleEvidence ? (
	                      <div className="official-capture-review">
	                        <strong>Public bundle boundary evidence</strong>
	                        <p>{publicBundleEvidence.evidenceUse}</p>
	                        {publicBundleEvidence.artifactPath ? (
	                          <p className="official-capture-boundary">Artifact: {publicBundleEvidence.artifactPath}</p>
	                        ) : null}
	                        <ul>
	                          {publicBundleEvidence.evidencePresent.slice(0, 4).map((evidence) => (
	                            <li key={evidence}>{evidence}</li>
	                          ))}
	                        </ul>
	                        <p className="official-capture-boundary">
	                          Missing for promotion: {publicBundleEvidence.evidenceMissingForPromotion.join("; ")}
	                        </p>
	                        <p className="official-capture-boundary">
	                          {formatBoundaryReason(publicBundleEvidence.promotionBoundary) ??
	                            "This is public bundle/scope evidence only; it does not satisfy sampleRows, resultRows, or citationBindings."}
	                        </p>
	                      </div>
	                    ) : null}
                    {publicCaptureOpportunity ? (
                      <div className="official-capture-review">
                        <strong>Public capture opportunity</strong>
                        <p>
                          {publicCaptureOpportunity.summary} {publicCaptureOpportunity.publicNextStep}
                        </p>
                        <ul>
                          {publicCaptureOpportunity.blockers.slice(0, 4).map((blocker) => (
                            <li key={blocker}>{blocker}</li>
                          ))}
                        </ul>
                        <p className="official-capture-boundary">{publicCaptureOpportunity.readinessBoundary}</p>
                        <p className="official-capture-boundary">{publicCaptureOpportunity.publicNextCommand}</p>
                      </div>
                    ) : null}
	                    {latestRouteProbe ? (
	                      <div className="official-capture-review">
	                        <strong>Latest authenticated route probe</strong>
	                        <p>
	                          {latestRouteProbe.finalUrlKind
	                            ? formatGapLabel(latestRouteProbe.finalUrlKind)
	                            : "route kind unknown"}
	                          ; reportData {latestRouteProbe.pagePropsReportData ? "present" : "absent"}; not-found{" "}
	                          {latestRouteProbe.notFound ? "yes" : "no"}
	                        </p>
	                        <p className="official-capture-boundary">
	                          Artifact: {latestRouteProbe.artifactPath ?? "none"}
	                        </p>
	                        <p className="official-capture-boundary">
	                          URL: {latestRouteProbe.finalUrl ?? latestRouteProbe.requestedUrl ?? "none"}
	                        </p>
	                        <p className="official-capture-boundary">
	                          {formatBoundaryReason(latestRouteProbe.promotionBoundary) ?? latestRouteProbe.privacyBoundary}
	                        </p>
	                      </div>
	                    ) : null}
                    {liveDetailInspection ? (
                      <p className="official-capture-boundary">
                        Live detail inspection: {liveDetailInspection.exactRoute ? "exact route" : "route fallback"};
                        {" "}
                        {liveDetailInspection.finalUrl ?? liveDetailInspection.requestedUrl}
                      </p>
                    ) : null}
                    {promotionReview ? (
                      <div className="official-capture-review">
                        <strong>{formatGapLabel(promotionReview.decision)}</strong>
                        <p>
                          {promotionReview.boundaryUse ??
                            "Reviewed capture remains boundary-only until official row evidence is captured."}
                        </p>
                        {promotionReview.nextEvidenceNeeded.length > 0 ? (
                          <ul>
                            {promotionReview.nextEvidenceNeeded.map((evidence) => (
                              <li key={evidence}>{evidence}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                    {formalGate ? (
                      <div className="official-capture-gate">
                        <strong>{formalGate.readyForPromotion ? "Formal gate ready" : "Formal gate missing"}</strong>
                        <ul>
                          {(formalGate.missing.length > 0 ? formalGate.missing : ["no missing gate requirements"]).map(
                            (requirement) => (
                              <li key={requirement}>{requirement}</li>
                            ),
                          )}
                        </ul>
                        <code>{formalGate.validatorCommand}</code>
                      </div>
                    ) : null}
                    {artifactSummaries.length > 0 ? (
                      <div className="official-capture-commands">
                        {artifactSummaries.map((artifact) => (
                          <code key={artifact.path}>
                            {artifact.path}: {artifact.ok ? "valid" : "invalid"};{" "}
                            {formatOutputSignals(artifact.outputSignals)}
                          </code>
                        ))}
                      </div>
                    ) : null}
                    <div className="official-capture-commands">
                      {commandChain.map((command) => (
                        <code key={command}>{command}</code>
                      ))}
                      <code>{officialCaptureStatus.commands.auditTemplates}</code>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="formal-evidence-queue" aria-label="Source evidence acquisition queue">
            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Exact-route recapture queue</span>
                <span className="meta-text">{missingExactDetailCaptureTargets.length} reports</span>
              </div>
              <ol>
                {missingExactDetailCaptureTargets.map((target) => (
                  <li key={target.slug}>
                    <div>
                      <strong>{target.title}</strong>
                      <span>{target.actionLabel}</span>
                      <small>{target.firstRequiredEvidence}</small>
                      <small>
                        <span className={captureStageClass(target.captureStatus?.stage)}>
                          {target.captureStatus ? formatGapLabel(target.captureStatus.stage) : "status missing"}
                        </span>
                      </small>
                      <small>{target.captureStatus?.nextCommand ?? target.redactionTemplateCommand}</small>
                    </div>
                    <button className="btn btn-outline" type="button" onClick={() => handleSelectReport(target.slug)}>
                      Inspect
                    </button>
                    {target.captureUrl ? (
                      <a href={target.captureUrl} target="_blank" rel="noreferrer">
                        Open source
                      </a>
                    ) : (
                      <em>No source URL</em>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Output artifact queue</span>
                <span className="meta-text">{metadataOnlyCaptureTargets.length} reports</span>
              </div>
              <ol>
                {metadataOnlyCaptureTargets.map((target) => (
                  <li key={target.slug}>
                    <div>
                      <strong>{target.title}</strong>
                      <span>
                        {formatGapLabel(target.reportFileStatus)} report file; {target.sampleRows} sample rows
                      </span>
                      <small>{target.firstRequiredEvidence}</small>
                      <small>
                        <span className={captureStageClass(target.captureStatus?.stage)}>
                          {target.captureStatus ? formatGapLabel(target.captureStatus.stage) : "status missing"}
                        </span>
                      </small>
                      <small>{target.captureStatus?.nextCommand ?? target.redactionTemplateCommand}</small>
                    </div>
                    <button className="btn btn-outline" type="button" onClick={() => handleSelectReport(target.slug)}>
                      Inspect
                    </button>
                    {target.captureUrl ? (
                      <a href={target.captureUrl} target="_blank" rel="noreferrer">
                        Open detail
                      </a>
                    ) : (
                      <em>No source URL</em>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="gap-targets">
            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Unidentified identities</span>
                <span className="meta-text">{formatGapCount(identityEvidenceGap)} open</span>
              </div>
              {unresolvedSlotTargets.length > 0 ? (
                <ol>
                  {unresolvedSlotTargets.map((target) => (
                    <li key={target.id}>
                      <strong>{target.label}</strong>
                      <span>{target.id}</span>
                    </li>
                  ))}
                </ol>
              ) : identityEvidenceGap === 0 ? (
                <p className="body-text">
                  No unidentified authenticated report identities remain in the current page-props evidence.
                </p>
              ) : (
                <p className="body-text">
                  Unidentified identity targets load after catalog stats or readiness rows are available.
                </p>
              )}
            </div>

            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Detail targets</span>
                <span className="meta-text">{formatGapCount(detailParityGap)} open</span>
              </div>
              {nextDetailTargets.length > 0 ? (
                <ol>
                  {nextDetailTargets.map((target) => (
                    <li key={target.slug}>
                      <strong>{target.title}</strong>
                      <span>{target.slug}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="body-text">Detail-parity targets load after Convex readiness rows are available.</p>
              )}
            </div>

            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Sample-row targets</span>
                <span className="meta-text">{formatGapCount(namedSampleBacklog)} open</span>
              </div>
              {nextSampleRowTargets.length > 0 ? (
                <ol>
                  {nextSampleRowTargets.map((target) => (
                    <li key={target.slug}>
                      <strong>{target.title}</strong>
                      <span>{target.gaps.slice(0, 2).map(formatGapLabel).join(", ") || target.slug}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="body-text">Sample-row targets load after Convex readiness rows are available.</p>
              )}
            </div>

            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Local scaffold targets</span>
                <span className="meta-text">{formatGapCount(localScaffoldBacklog)} open</span>
              </div>
              {nextLocalScaffoldTargets.length > 0 ? (
                <ol>
                  {nextLocalScaffoldTargets.map((target) => (
                    <li key={target.slug}>
                      <strong>{target.title}</strong>
                      <span>
                        {target.declaredGaps.includes("detail")
                          ? "No exact detail route; formal evidence pending"
                          : "Detail metadata only; sample rows pending"}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="body-text">Local-scaffold targets load after Convex readiness rows are available.</p>
              )}
            </div>

            <div>
              <div className="detail-section-header">
                <span className="eyebrow">Exact-route recapture</span>
                <span className="meta-text">
                  {formatGapCount(formalEvidenceBacklogSummary.missingExactDetailDecisions.length)} open
                </span>
              </div>
              {nextMissingExactDetailTargets.length > 0 ? (
                <ol>
                  {nextMissingExactDetailTargets.map((target) => (
                    <li key={target.slug}>
                      <strong>{target.title}</strong>
                      <span>{formatGapLabel(target.evidenceStatus)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="body-text">All scaffold-only reports have exact detail metadata.</p>
              )}
            </div>
          </div>
        </section>

        <div className="marketplace-grid">
          <Filters
            categories={categories}
            selectedCategory={category}
            packageStates={packageStates}
            selectedPackageState={packageState}
            onSelectCategory={setCategory}
            onSelectPackageState={setPackageState}
          />

          <div className="results-col">
            <div className="results-header">
              <div>
                <div className="eyebrow">Showing {filteredReports.length} packages</div>
                <p className="meta-note">
                  {reports ? `${reports.length} unique packages available; ${targetTotal} marketplace positions tracked` : "Loading from Convex..."}
                </p>
              </div>
              <div className="flex-between gap-2">
                <span className="meta-text">Sort By:</span>
                <select
                  aria-label="Sort reports"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortMode)}
                >
                  <option value="readiness">Readiness</option>
                  <option value="title">Title</option>
                  <option value="category">Category</option>
                </select>
              </div>
            </div>

            <div className="reports-grid" aria-live="polite">
              {filteredReports.map((report) => (
                <ReportCard
                  key={report.slug}
                  report={report}
                  readiness={readinessAudit ? readinessBySlug.get(report.slug) ?? null : undefined}
                  officialOutputCaptureStage={
                    officialOutputCaptureStageBySlug.has(report.slug)
                      ? (officialOutputCaptureStageBySlug.get(report.slug) ?? null)
                      : undefined
                  }
                  officialOutputCaptureTarget={officialOutputCaptureTargetBySlug.get(report.slug) ?? null}
                  isSelected={selectedSlug === report.slug}
                  onSelect={() => handleSelectReport(report.slug)}
                />
              ))}
            </div>

            {filteredReports.length === 0 && reports ? (
              <div className="empty-state">No report packages match the current filters.</div>
            ) : null}
          </div>
        </div>
      </main>

      <ReportDetail report={selectedReport} readiness={selectedReadiness} />
    </>
  );
}
