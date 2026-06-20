import { useQuery } from "convex/react";
import { useMemo, useState } from "react";

import { api } from "../convex/_generated/api";
import { Filters } from "./components/Filters";
import { ReportCard } from "./components/ReportCard";
import { ReportDetail } from "./components/ReportDetail";
import type { ReportPackage, ReportSummary } from "./lib/types";

const DEFAULT_SLUG = "wellness-genetic-guide";
const SEQUENCING_MARKETPLACE_TOTAL = 164;
const AUTHENTICATED_PAGE_SIZE = 75;
const AUTHENTICATED_PAGE_COUNT = 3;

export default function App() {
  const reports = useQuery(api.reports.list, {}) as ReportSummary[] | undefined;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_SLUG);
  const [sortBy, setSortBy] = useState<"title" | "category">("title");
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
      if (sortBy === "category") {
        return `${a.category} ${a.title}`.localeCompare(`${b.category} ${b.title}`);
      }
      return a.title.localeCompare(b.title);
    });
  }, [category, reports, search, sortBy]);

  const seededCount = reports?.length ?? 0;
  const backlogCount = Math.max(SEQUENCING_MARKETPLACE_TOTAL - seededCount, 0);

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
              browsing showed 164 total marketplace items across 3 pages of 75 items. This app stores
              the observed subset, public sample structure, curated references, and explicit
              extraction status so the remaining backlog can be completed from authenticated
              mock-report evidence.
            </p>
          </div>
          <div className="catalog-stats" aria-label="Catalog coverage">
            <div>
              <strong>{SEQUENCING_MARKETPLACE_TOTAL}</strong>
              <span>Sequencing.com total</span>
            </div>
            <div>
              <strong>{reports ? seededCount : "..."}</strong>
              <span>Seeded subset</span>
            </div>
            <div>
              <strong>{reports ? backlogCount : "..."}</strong>
              <span>Remaining backlog</span>
            </div>
            <div>
              <strong>{AUTHENTICATED_PAGE_SIZE}</strong>
              <span>Items per page</span>
            </div>
            <div>
              <strong>{AUTHENTICATED_PAGE_COUNT}</strong>
              <span>Pages observed</span>
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
                  onChange={(event) => setSortBy(event.target.value as "title" | "category")}
                >
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
