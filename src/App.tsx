import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import { api } from "../convex/_generated/api";
import { Filters } from "./components/Filters";
import { ReportCard } from "./components/ReportCard";
import { ReportDetail } from "./components/ReportDetail";
import { readinessScore } from "./lib/readiness";
import type { CatalogStats, ReportPackage, ReportSummary } from "./lib/types";

const DEFAULT_SLUG = "wellness-genetic-guide";
const SEQUENCING_MARKETPLACE_TOTAL = 164;
const AUTHENTICATED_PAGE_COUNT = 3;
type SortMode = "readiness" | "title" | "category";

const formatReadinessStat = (value: number | undefined, total: number) => {
  if (value === undefined) {
    return "...";
  }
  return `${value}/${total}`;
};

export default function App() {
  const reports = useQuery(api.reports.list, {}) as ReportSummary[] | undefined;
  const catalogStats = useQuery(api.reports.catalogStats, {}) as CatalogStats | undefined;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_SLUG);
  const [sortBy, setSortBy] = useState<SortMode>("readiness");
  const selectedReport = useQuery(api.reports.get, { slug: selectedSlug }) as
    | ReportPackage
    | null
    | undefined;

  const categories = useMemo(() => {
    const categorySet = new Set((reports ?? []).map((report) => report.category));
    return ["All", ...Array.from(categorySet).sort()];
  }, [reports]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const matches = (reports ?? []).filter((report) => {
      const matchesCategory = category === "All" || report.category === category;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [report.title, report.summary, report.category, report.provider, ...report.tags]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });

    return matches.sort((a, b) => {
      if (sortBy === "readiness") {
        return readinessScore(b) - readinessScore(a) || a.title.localeCompare(b.title);
      }
      if (sortBy === "category") {
        return `${a.category} ${a.title}`.localeCompare(`${b.category} ${b.title}`);
      }
      return a.title.localeCompare(b.title);
    });
  }, [category, reports, search, sortBy]);

  const seededCount = catalogStats?.seeded ?? reports?.length ?? 0;
  const targetTotal = catalogStats?.knownMarketplaceTotal ?? SEQUENCING_MARKETPLACE_TOTAL;
  const statsLoaded = Boolean(catalogStats || reports);
  const identifiedCount = catalogStats?.identifiedMarketplaceItems ?? Math.max(seededCount - 10, 0);
  const backlogCount =
    catalogStats?.unknownMarketplaceItems ??
    (reports ? Math.max(SEQUENCING_MARKETPLACE_TOTAL - seededCount, 0) : 10);

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
            Browse report packages, inspect their research resources, copy the local-agent prompt,
            and keep deterministic output schemas next to every genome report.
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
              browsing showed 164 visible marketplace card positions across {AUTHENTICATED_PAGE_COUNT} pages of 75, 75,
              and 14 cards. A public
              aggregate marketplace page currently grounds 150 URLs, plus {catalogStats?.namedAuthenticatedOnly ?? 4} named
              authenticated-only cards. The remaining {backlogCount || 10} authenticated slots are
              shown as placeholders until their names and mock reports can be extracted.
            </p>
          </div>
          <div className="catalog-stats" aria-label="Catalog coverage">
            <div>
              <strong>{formatReadinessStat(statsLoaded ? identifiedCount : undefined, targetTotal)}</strong>
              <span>Catalog identity</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.referencesReady, targetTotal)}</strong>
              <span>Background refs</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.sampleExtracted, targetTotal)}</strong>
              <span>Sample report</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.promptReady, targetTotal)}</strong>
              <span>Agent prompt</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.outputFormatReady, targetTotal)}</strong>
              <span>Output schema</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.formalFieldsReady, targetTotal)}</strong>
              <span>Formal map</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.localFixtureReady, targetTotal)}</strong>
              <span>Local fixture</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.citationBindingsReady, targetTotal)}</strong>
              <span>Row citations</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.sampleBackedFormalReady, targetTotal)}</strong>
              <span>Formal report</span>
            </div>
            <div>
              <strong>{formatReadinessStat(catalogStats?.formalEquivalentReady, targetTotal)}</strong>
              <span>Full parity</span>
            </div>
          </div>
        </div>

        <div className="marketplace-grid">
          <Filters categories={categories} selectedCategory={category} onSelectCategory={setCategory} />

          <div className="results-col">
            <div className="results-header">
              <div>
                <div className="eyebrow">Showing {filteredReports.length} reports</div>
                <p className="meta-note">{reports ? `${reports.length} packages available` : "Loading from Convex..."}</p>
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
                  isSelected={selectedSlug === report.slug}
                  onSelect={() => setSelectedSlug(report.slug)}
                />
              ))}
            </div>

            {filteredReports.length === 0 && reports ? (
              <div className="empty-state">No report packages match the current filters.</div>
            ) : null}
          </div>
        </div>
      </main>

      <ReportDetail report={selectedReport} />
    </>
  );
}
