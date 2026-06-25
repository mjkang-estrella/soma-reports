import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { type Doc } from "./_generated/dataModel";
import { authenticatedMarketplacePositionLedger } from "./authenticatedMarketplaceLedger";
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

const maxSummarySearchTextLength = 8000;

type OutputSectionSeed = ReportPackageSeed["outputSections"][number];
type OutputFieldSeed = OutputSectionSeed["expectedFields"][number];

const requiredAppendixOutputFields: OutputFieldSeed[] = [
  {
    key: "probabilities",
    label: "Probabilities",
    description:
      "Probability or confidence disclosures kept out of deterministic findings; use an empty array when no calibrated model is supplied.",
    type: "object[]",
    required: true,
    fieldPath: "appendix.probabilities",
    citationRequired: false,
    allowsUnavailable: true,
  },
  {
    key: "uncertainty",
    label: "Uncertainty",
    description:
      "Plain-English notes that explain missing evidence, calibration limits, and why probabilities or confidence are not emitted in the deterministic body.",
    type: "string[]",
    required: true,
    fieldPath: "appendix.uncertainty",
    citationRequired: false,
    allowsUnavailable: true,
  },
  {
    key: "missingInputs",
    label: "Missing inputs",
    description:
      "Required or useful genome inputs that were absent, unavailable, or intentionally not inferred from local evidence.",
    type: "string[]",
    required: true,
    fieldPath: "appendix.missingInputs",
    citationRequired: false,
    allowsUnavailable: true,
  },
  {
    key: "limitations",
    label: "Limitations",
    description:
      "Scope, source, calibration, and professional-review limits that keep the report educational and deterministic.",
    type: "string[]",
    required: true,
    fieldPath: "appendix.limitations",
    citationRequired: false,
    allowsUnavailable: true,
  },
];

const requiredAppendixFieldPaths = requiredAppendixOutputFields.map((field) => field.fieldPath!);

const withRequiredAppendixOutputFields = <T extends OutputSectionSeed>(sections: T[]) => {
  const existingFieldPaths = new Set(
    sections.flatMap((section) => section.expectedFields.map((field) => field.fieldPath).filter(Boolean)),
  );
  const missingFields = requiredAppendixOutputFields.filter((field) => !existingFieldPaths.has(field.fieldPath));

  if (missingFields.length === 0) {
    return sections;
  }

  const appendixIndex = sections.findIndex(
    (section) =>
      section.title.toLowerCase().includes("appendix") ||
      section.expectedFields.some((field) => field.fieldPath?.startsWith("appendix.")),
  );

  if (appendixIndex >= 0) {
    return sections.map((section, index) =>
      {
        if (index !== appendixIndex) {
          return section;
        }

        const existingKeys = new Set(section.expectedFields.map((field) => field.key));
        const expectedFields = section.expectedFields.map((field) => {
          const requiredField = missingFields.find((candidate) => candidate.key === field.key && !field.fieldPath);
          if (!requiredField) {
            return field;
          }

          return {
            ...field,
            required: true,
            fieldPath: requiredField.fieldPath,
            citationRequired: field.citationRequired ?? requiredField.citationRequired,
            allowsUnavailable: field.allowsUnavailable ?? requiredField.allowsUnavailable,
          };
        });

        return {
          ...section,
          expectedFields: [...expectedFields, ...missingFields.filter((field) => !existingKeys.has(field.key))],
        };
      }
    );
  }

  return [
    ...sections,
    {
      sortOrder: Math.max(0, ...sections.map((section) => section.sortOrder)) + 1,
      title: "Appendix",
      purpose: "Keep uncertainty, missing data, calibration limits, and probability disclosures outside deterministic findings.",
      expectedFields: missingFields,
    },
  ];
};

const buildSummarySearchText = (report: ReportPackageSeed | Doc<"reports">) => {
  const values: string[] = [];
  const seen = new Set<string>();
  let currentLength = 0;

  const add = (value: unknown) => {
    if (typeof value !== "string") {
      return;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      return;
    }

    const nextLength = currentLength + trimmed.length + 1;
    if (nextLength > maxSummarySearchTextLength) {
      return;
    }

    seen.add(normalized);
    values.push(trimmed);
    currentLength = nextLength;
  };

  const addMany = (items: readonly unknown[] | undefined) => {
    for (const item of items ?? []) {
      add(item);
    }
  };

  add(report.slug);
  add(report.title);
  add(report.subtitle);
  add(report.category);
  add(report.provider);
  addMany(report.catalogCategories);
  addMany(report.tags);

  if ("genomeInputs" in report) {
    for (const input of report.genomeInputs) {
      add(input.id);
      add(input.kind);
      add(input.label);
    }
  }
  if ("references" in report) {
    for (const reference of report.references) {
      add(reference.resourceId);
      add(reference.title);
      add(reference.sourceType);
      addMany(reference.usedFor);
    }
  }
  if ("sampleRows" in report) {
    for (const row of report.sampleRows) {
      addMany(row.genes);
      addMany(row.sourceResourceIds);
      add(row.groupTitle);
      add(row.item);
      add(row.brandName);
      add(row.sourceLabel);
    }
  }
  if ("genotypeSummary" in report) {
    for (const row of report.genotypeSummary) {
      add(row.gene);
      add(row.variantId);
      add(row.tier);
    }
  }
  if ("outputSections" in report) {
    for (const section of report.outputSections) {
      add(section.title);
      for (const field of section.expectedFields) {
        add(field.key);
        add(field.label);
        add(field.fieldPath);
        add(field.formalSourceField);
      }
    }
  }
  if ("prompt" in report && report.prompt) {
    add(report.prompt.title);
    addMany(report.prompt.inputContract);
    addMany(report.prompt.outputContract);
  }
  if ("formalFields" in report) {
    for (const field of report.formalFields) {
      add(field.outputPath);
      add(field.sourceLabel);
    }
  }
  if ("visibleFields" in report) {
    addMany(report.visibleFields);
  }

  add(report.summary);
  add(report.sampleReportStatus);

  if ("genomeInputs" in report) {
    for (const input of report.genomeInputs) {
      add(input.missingDataBehavior);
    }
  }
  if ("references" in report) {
    for (const reference of report.references) {
      add(reference.theme);
    }
  }
  if ("sampleRows" in report) {
    for (const row of report.sampleRows) {
      add(row.geneticAnalysis);
      add(row.description);
    }
  }
  if ("genotypeSummary" in report) {
    for (const row of report.genotypeSummary) {
      add(row.effect);
      add(row.phenotype);
    }
  }
  if ("outputSections" in report) {
    for (const section of report.outputSections) {
      add(section.purpose);
      for (const field of section.expectedFields) {
        add(field.description);
      }
    }
  }
  if ("prompt" in report && report.prompt) {
    addMany(report.prompt.safetyNotes);
  }
  if ("formalFields" in report) {
    for (const field of report.formalFields) {
      add(field.observedField);
      add(field.notes);
    }
  }

  return values.join(" ");
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
  searchText: buildSummarySearchText(report),
});

const sortReports = <T extends { title: string }>(reports: T[]) =>
  [...reports].sort((a, b) => a.title.localeCompare(b.title));

const reportsOrSeeds = (dbReports: Doc<"reports">[]) => {
  const reportsBySlug = new Map(seedReportPackages.map((report) => [report.slug, toSummary(report)]));

  for (const report of dbReports) {
    const seedSummary = reportsBySlug.get(report.slug);
    const dbSummary = toSummary(report);
    reportsBySlug.set(report.slug, {
      ...seedSummary,
      ...dbSummary,
      searchText: (seedSummary?.searchText ?? dbSummary.searchText).slice(0, maxSummarySearchTextLength),
    });
  }

  return [...reportsBySlug.values()];
};

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
  const normalizedOutputSections = withRequiredAppendixOutputFields(report.outputSections);
  const requiredOutputFields = normalizedOutputSections.flatMap((section) =>
    section.expectedFields.filter((field) => field.required),
  );
  const requiredOutputFieldPaths = new Set(
    requiredOutputFields.map((field) => field.fieldPath).filter((fieldPath): fieldPath is string => Boolean(fieldPath)),
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
  for (const fieldPath of requiredAppendixFieldPaths) {
    if (!requiredOutputFieldPaths.has(fieldPath)) {
      gaps.push(`required_output_field_${fieldPath.replaceAll(".", "_")}_missing`);
    }
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
  outputSections: withRequiredAppendixOutputFields(report.outputSections),
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
    outputSections: withRequiredAppendixOutputFields(outputSections.sort((a, b) => a.sortOrder - b.sortOrder)),
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
    const knownMarketplaceTotal = authenticatedMarketplacePositionLedger.totals.positions;
    const authenticatedDuplicateStructuredPositions =
      authenticatedMarketplacePositionLedger.totals.duplicatePlacements;
    const seeded = reports.length;
    const directCatalog = reports.filter((report) => report.curationCompleteness?.catalog).length;
    const authenticatedGapRows = reports.filter((report) => report.status === "authenticated-gap").length;
    const identifiedMarketplaceItems = Math.max(seeded - authenticatedGapRows, 0);
    const positionIdentityDelta = Math.max(knownMarketplaceTotal - identifiedMarketplaceItems, 0);
    const unidentifiedMarketplaceItems = authenticatedGapRows;
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
      unknownMarketplaceItems: unidentifiedMarketplaceItems,
      authenticatedDuplicateStructuredPositions,
      positionIdentityDelta,
      seededCoverageComplete: unidentifiedMarketplaceItems === 0,
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
        outputSections: withRequiredAppendixOutputFields(report.outputSections),
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
    const seedReport = seedPackageBySlug(slug);
    const report = await ctx.db
      .query("reports")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (report) {
      const dbDetail = await buildDbDetail(ctx, report);
      if (!seedReport) {
        return dbDetail;
      }

      const seedDetail = buildSeedDetail(seedReport);
      return {
        ...seedDetail,
        ...dbDetail,
        sourceArtifacts: dbDetail.sourceArtifacts.length > 0 ? dbDetail.sourceArtifacts : seedDetail.sourceArtifacts,
        references: dbDetail.references.length > 0 ? dbDetail.references : seedDetail.references,
        prompt: dbDetail.prompt ?? seedDetail.prompt,
        outputSections: dbDetail.outputSections.length > 0 ? dbDetail.outputSections : seedDetail.outputSections,
        formalFields: dbDetail.formalFields.length > 0 ? dbDetail.formalFields : seedDetail.formalFields,
        sampleRows: dbDetail.sampleRows.length > 0 ? dbDetail.sampleRows : seedDetail.sampleRows,
        genotypeSummary:
          dbDetail.genotypeSummary.length > 0 ? dbDetail.genotypeSummary : seedDetail.genotypeSummary,
        localTestFixture: dbDetail.localTestFixture ?? seedDetail.localTestFixture,
      };
    }

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
      const normalizedOutputSections = withRequiredAppendixOutputFields(outputSections);
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

      for (const section of normalizedOutputSections) {
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
