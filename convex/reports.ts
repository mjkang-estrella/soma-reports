import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { type Doc } from "./_generated/dataModel";
import { seedReportPackages, type ReportPackageSeed } from "./reportPackages";

const defaultCompleteness = {
  catalog: false,
  detail: false,
  sampleReport: false,
  references: false,
  localFixture: false,
  prompt: false,
  outputFormat: false,
  formalFields: false,
  citationBindings: false,
  notes: ["This report has not been backfilled with extraction completeness metadata yet."],
};

const toSummary = (report: ReportPackageSeed | Doc<"reports">) => ({
  slug: report.slug,
  title: report.title,
  subtitle: report.subtitle,
  category: report.category,
  provider: report.provider,
  version: report.version,
  status: report.status,
  summary: report.summary,
  sourceUrl: report.sourceUrl,
  marketplaceUrl: report.marketplaceUrl,
  priceLabel: report.priceLabel,
  catalogCategories: report.catalogCategories,
  catalogSource: report.catalogSource,
  curationStatus: report.curationStatus,
  sampleReportStatus: report.sampleReportStatus,
  curationCompleteness: report.curationCompleteness ?? defaultCompleteness,
  tags: report.tags,
});

const sortReports = <T extends { title: string }>(reports: T[]) =>
  [...reports].sort((a, b) => a.title.localeCompare(b.title));

const reportsOrSeeds = (dbReports: Doc<"reports">[]) =>
  dbReports.length === 0 ? seedReportPackages.map(toSummary) : dbReports.map(toSummary);

const seedPackageBySlug = (slug: string) =>
  seedReportPackages.find((report) => report.slug === slug) ?? null;

const completenessKeys = [
  "catalog",
  "detail",
  "sampleReport",
  "references",
  "localFixture",
  "prompt",
  "outputFormat",
  "formalFields",
  "citationBindings",
] as const;

const declaredReadinessGaps = (report: Pick<ReportPackageSeed, "curationCompleteness">) =>
  completenessKeys.filter((key) => !report.curationCompleteness[key]);

const validLocalFixture = (report: ReportPackageSeed) => {
  const fixture = report.localTestFixture;
  if (!fixture) {
    return false;
  }

  return (
    fixture.packageSlug === report.slug &&
    fixture.packageVersion === report.version &&
    fixture.inputManifest.rawGenomeReturned === false &&
    fixture.genomeEvidence.length > 0 &&
    fixture.referenceResources.length > 0 &&
    Object.values(fixture.expectedAssertions).every(Boolean)
  );
};

const exactCitationRowCount = (report: ReportPackageSeed) => {
  const referenceIds = new Set(report.references.map((reference) => reference.resourceId).filter(Boolean));

  return report.sampleRows.filter(
    (row) =>
      row.sourceBindingStatus === "exact" &&
      row.sourceResourceIds !== undefined &&
      row.sourceResourceIds.length > 0 &&
      row.sourceResourceIds.every((resourceId) => referenceIds.has(resourceId)),
  ).length;
};

const derivedReadinessGaps = (report: ReportPackageSeed) => {
  const gaps: string[] = [];
  const promptText = report.prompt?.deterministicPrompt.toLowerCase() ?? "";
  const exactCitationRows = exactCitationRowCount(report);
  const pendingFormalFields = report.formalFields.filter((field) => field.status === "pending").length;
  const requiredOutputFields = report.outputSections.flatMap((section) =>
    section.expectedFields.filter((field) => field.required),
  );

  if (!report.curationCompleteness.catalog || report.status === "authenticated-gap") {
    gaps.push("catalog_identity_missing_or_placeholder");
  }
  if (report.references.length === 0) {
    gaps.push("reference_pack_missing");
  }
  if (report.references.some((reference) => !reference.resourceId)) {
    gaps.push("reference_ids_missing");
  }
  if (!report.prompt) {
    gaps.push("prompt_missing");
  } else {
    for (const term of ["deterministic", "appendix", "probability", "plain english", "raw genome"]) {
      if (!promptText.includes(term)) {
        gaps.push(`prompt_missing_${term.replace(" ", "_")}`);
      }
    }
  }
  if (report.outputSections.length === 0) {
    gaps.push("output_format_missing");
  }
  if (requiredOutputFields.length === 0) {
    gaps.push("required_output_fields_missing");
  }
  if (report.formalFields.length === 0) {
    gaps.push("formal_fields_missing");
  }
  if (pendingFormalFields > 0) {
    gaps.push("formal_fields_pending");
  }
  if (report.curationCompleteness.sampleReport && report.sampleRows.length === 0) {
    gaps.push("sample_rows_missing");
  }
  if (report.sampleRows.length > 0 && exactCitationRows !== report.sampleRows.length) {
    gaps.push("exact_row_citation_bindings_missing");
  }
  if (report.curationCompleteness.localFixture && !validLocalFixture(report)) {
    gaps.push("local_fixture_invalid");
  }
  if (report.curationCompleteness.sampleReport && report.genotypeSummary.length === 0) {
    gaps.push("genotype_summary_missing");
  }

  return [...new Set(gaps)];
};

const seedReadinessAuditRows = () =>
  sortReports(seedReportPackages).map((report) => {
    const declaredGaps = declaredReadinessGaps(report);
    const derivedGaps = derivedReadinessGaps(report);
    const formalReportDeclaredGaps = declaredGaps.filter((gap) => gap !== "detail");
    const sampleBackedFormalReady = formalReportDeclaredGaps.length === 0 && derivedGaps.length === 0;

    return {
      slug: report.slug,
      title: report.title,
      category: report.category,
      status: report.status,
      declaredReady: declaredGaps.length === 0,
      formalEquivalentReady: declaredGaps.length === 0 && derivedGaps.length === 0,
      sampleBackedFormalReady,
      declaredGaps,
      formalReportDeclaredGaps,
      derivedGaps,
      evidence: {
        references: report.references.length,
        prompt: Boolean(report.prompt),
        outputSections: report.outputSections.length,
        formalFields: report.formalFields.length,
        sampleRows: report.sampleRows.length,
        genotypeSummaryRows: report.genotypeSummary.length,
        localFixture: Boolean(report.localTestFixture),
        exactCitationRows: exactCitationRowCount(report),
      },
    };
  });

const referenceIdFromTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const deleteExistingChildren = async (ctx: MutationCtx, reportSlug: string) => {
  for await (const row of ctx.db
    .query("reportReferences")
    .withIndex("by_reportSlug", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }

  for await (const row of ctx.db
    .query("reportPrompts")
    .withIndex("by_reportSlug", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }

  for await (const row of ctx.db
    .query("reportOutputSections")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }

  for await (const row of ctx.db
    .query("reportFormalFields")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }

  for await (const row of ctx.db
    .query("reportSampleRows")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }

  for await (const row of ctx.db
    .query("reportGenotypeSummaries")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }

  for await (const row of ctx.db
    .query("reportLocalFixtures")
    .withIndex("by_reportSlug", (q) => q.eq("reportSlug", reportSlug))) {
    await ctx.db.delete(row._id);
  }
};

const buildSeedDetail = (report: ReportPackageSeed) => ({
  ...report,
  references: report.references,
  prompt: report.prompt,
  outputSections: report.outputSections,
  formalFields: report.formalFields,
  sampleRows: report.sampleRows,
  genotypeSummary: report.genotypeSummary,
  localTestFixture: report.localTestFixture,
});

const buildDbDetail = async (ctx: QueryCtx, report: Doc<"reports">) => {
  const references = await ctx.db
    .query("reportReferences")
    .withIndex("by_reportSlug", (q) => q.eq("reportSlug", report.slug))
    .take(100);

  const prompt = await ctx.db
    .query("reportPrompts")
    .withIndex("by_reportSlug", (q) => q.eq("reportSlug", report.slug))
    .unique();

  const outputSections = await ctx.db
    .query("reportOutputSections")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", report.slug))
    .take(100);

  const formalFields = await ctx.db
    .query("reportFormalFields")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", report.slug))
    .take(200);

  const sampleRows = await ctx.db
    .query("reportSampleRows")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", report.slug))
    .take(200);

  const genotypeSummary = await ctx.db
    .query("reportGenotypeSummaries")
    .withIndex("by_reportSlug_and_sortOrder", (q) => q.eq("reportSlug", report.slug))
    .take(200);

  const localTestFixture = await ctx.db
    .query("reportLocalFixtures")
    .withIndex("by_reportSlug", (q) => q.eq("reportSlug", report.slug))
    .unique();

  return {
    ...report,
    sourceArtifacts: report.sourceArtifacts ?? [],
    curationCompleteness: report.curationCompleteness ?? defaultCompleteness,
    references,
    prompt,
    outputSections: outputSections.sort((a, b) => a.sortOrder - b.sortOrder),
    formalFields: formalFields.sort((a, b) => a.sortOrder - b.sortOrder),
    sampleRows: sampleRows.sort((a, b) => a.sortOrder - b.sortOrder),
    genotypeSummary: genotypeSummary.sort((a, b) => a.sortOrder - b.sortOrder),
    localTestFixture,
  };
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const dbReports = await ctx.db.query("reports").take(200);
    return sortReports(reportsOrSeeds(dbReports));
  },
});

export const catalogStats = query({
  args: {},
  handler: async (ctx) => {
    const dbReports = await ctx.db.query("reports").take(200);
    const reports = reportsOrSeeds(dbReports);
    const seedAuditRows = seedReadinessAuditRows();
    const knownMarketplaceTotal = 164;
    const seeded = reports.length;
    const directCatalog = reports.filter((report) => report.curationCompleteness?.catalog).length;
    const unidentifiedMarketplaceItems = reports.filter((report) => report.status === "authenticated-gap").length;
    const identifiedMarketplaceItems = Math.max(seeded - unidentifiedMarketplaceItems, 0);
    const namedAuthenticatedOnly = Math.max(identifiedMarketplaceItems - 150, 0);
    const sampleExtracted = reports.filter((report) => report.curationCompleteness?.sampleReport).length;
    const outputFormatReady = reports.filter((report) => report.curationCompleteness?.outputFormat).length;
    const promptReady = reports.filter((report) => report.curationCompleteness?.prompt).length;
    const referencesReady = reports.filter((report) => report.curationCompleteness?.references).length;
    const localFixtureReady = reports.filter((report) => report.curationCompleteness?.localFixture).length;
    const formalFieldsReady = reports.filter((report) => report.curationCompleteness?.formalFields).length;
    const citationBindingsReady = reports.filter((report) => report.curationCompleteness?.citationBindings).length;
    const sampleBackedFormalReady = seedAuditRows.filter((row) => row.sampleBackedFormalReady).length;
    const formalEquivalentReady = seedAuditRows.filter((row) => row.formalEquivalentReady).length;
    const detailPageReady = reports.filter((report) => report.curationCompleteness?.detail).length;
    const fullyReady = reports.filter((report) => {
      const completeness = report.curationCompleteness ?? defaultCompleteness;
      return [
        completeness.catalog,
        completeness.detail,
        completeness.sampleReport,
        completeness.references,
        completeness.localFixture,
        completeness.prompt,
        completeness.outputFormat,
        completeness.formalFields,
        completeness.citationBindings,
      ].every(Boolean);
    }).length;

    return {
      knownMarketplaceTotal,
      seeded,
      identifiedMarketplaceItems,
      namedAuthenticatedOnly,
      unknownMarketplaceItems: Math.max(knownMarketplaceTotal - identifiedMarketplaceItems, unidentifiedMarketplaceItems),
      seededCoverageComplete: seeded >= knownMarketplaceTotal,
      directCatalog,
      sampleExtracted,
      outputFormatReady,
      promptReady,
      referencesReady,
      localFixtureReady,
      formalFieldsReady,
      citationBindingsReady,
      sampleBackedFormalReady,
      formalEquivalentReady,
      detailPageReady,
      fullyReady,
    };
  },
});

export const auditReadiness = query({
  args: {},
  handler: async () => {
    return seedReadinessAuditRows().map((row) => ({
      ...row,
      ready: row.formalEquivalentReady,
      gaps: [...row.declaredGaps, ...row.derivedGaps],
    }));
  },
});

export const seedReadinessAudit = query({
  args: {},
  handler: async () => {
    const rows = seedReadinessAuditRows();
    const derivedGapCounts: Record<string, number> = {};
    const declaredGapCounts: Record<string, number> = {};

    for (const row of rows) {
      for (const gap of row.declaredGaps) {
        declaredGapCounts[gap] = (declaredGapCounts[gap] ?? 0) + 1;
      }
      for (const gap of row.derivedGaps) {
        derivedGapCounts[gap] = (derivedGapCounts[gap] ?? 0) + 1;
      }
    }

    return {
      total: rows.length,
      declaredReady: rows.filter((row) => row.declaredReady).length,
      formalEquivalentReady: rows.filter((row) => row.formalEquivalentReady).length,
      sampleBackedFormalReady: rows.filter((row) => row.sampleBackedFormalReady).length,
      gapCounts: derivedGapCounts,
      derivedGapCounts,
      declaredGapCounts,
      rows,
    };
  },
});

export const localArtifactSeeds = query({
  args: {},
  handler: async () =>
    sortReports(seedReportPackages)
      .filter((report) => report.prompt && report.localTestFixture)
      .map((report) => ({
        slug: report.slug,
        prompt: report.prompt,
        references: report.references,
        outputSections: report.outputSections,
        formalFields: report.formalFields,
        sampleRows: report.sampleRows,
        genotypeSummary: report.genotypeSummary,
        sourceArtifacts: report.sourceArtifacts,
        localTestFixture: report.localTestFixture,
      })),
});

export const get = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const report = await ctx.db
      .query("reports")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (report) {
      return await buildDbDetail(ctx, report);
    }

    const seedReport = seedPackageBySlug(slug);
    return seedReport ? buildSeedDetail(seedReport) : null;
  },
});

export const seedDefaults = mutation({
  args: { start: v.optional(v.number()), limit: v.optional(v.number()), pruneStale: v.optional(v.boolean()) },
  handler: async (ctx, { start, limit, pruneStale }) => {
    const now = Date.now();
    const seedSlugs = new Set(seedReportPackages.map((report) => report.slug));
    const startIndex = Math.max(0, Math.floor(start ?? 0));
    const limitCount = limit === undefined ? seedReportPackages.length : Math.max(0, Math.floor(limit));
    const reportsToSeed = seedReportPackages.slice(startIndex, startIndex + limitCount);

    for (const report of reportsToSeed) {
      const existing = await ctx.db
        .query("reports")
        .withIndex("by_slug", (q) => q.eq("slug", report.slug))
        .unique();

      const { references, prompt, outputSections, formalFields, sampleRows, genotypeSummary, localTestFixture, ...reportDoc } = report;
      const dbReport = { ...reportDoc, updatedAt: now };

      if (existing) {
        await ctx.db.patch(existing._id, dbReport);
      } else {
        await ctx.db.insert("reports", dbReport);
      }

      await deleteExistingChildren(ctx, report.slug);

      for (const [index, reference] of references.entries()) {
        await ctx.db.insert("reportReferences", {
          reportSlug: report.slug,
          resourceId: reference.resourceId ?? referenceIdFromTitle(reference.title),
          sortOrder: reference.sortOrder ?? index + 1,
          scope: reference.scope ?? "background",
          ...reference,
        });
      }

      if (prompt) {
        await ctx.db.insert("reportPrompts", {
          reportSlug: report.slug,
          ...prompt,
        });
      }

      for (const section of outputSections) {
        await ctx.db.insert("reportOutputSections", {
          reportSlug: report.slug,
          ...section,
        });
      }

      for (const field of formalFields) {
        await ctx.db.insert("reportFormalFields", {
          reportSlug: report.slug,
          ...field,
        });
      }

      for (const row of sampleRows) {
        await ctx.db.insert("reportSampleRows", {
          reportSlug: report.slug,
          ...row,
        });
      }

      for (const row of genotypeSummary) {
        await ctx.db.insert("reportGenotypeSummaries", {
          reportSlug: report.slug,
          ...row,
        });
      }

      if (localTestFixture) {
        await ctx.db.insert("reportLocalFixtures", {
          reportSlug: report.slug,
          ...localTestFixture,
        });
      }
    }

    let pruned = 0;
    if (pruneStale) {
      for await (const report of ctx.db.query("reports")) {
        if (seedSlugs.has(report.slug)) {
          continue;
        }
        await deleteExistingChildren(ctx, report.slug);
        await ctx.db.delete(report._id);
        pruned += 1;
      }
    }

    return { seeded: reportsToSeed.length, total: seedReportPackages.length, pruned, updatedAt: now };
  },
});
