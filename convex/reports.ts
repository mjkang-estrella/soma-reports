import { v } from "convex/values";

import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { type Doc } from "./_generated/dataModel";
import { seedReportPackages, type ReportPackageSeed } from "./reportPackages";

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
  curationStatus: report.curationStatus,
  sampleReportStatus: report.sampleReportStatus,
  tags: report.tags,
});

const sortReports = <T extends { title: string }>(reports: T[]) =>
  [...reports].sort((a, b) => a.title.localeCompare(b.title));

const seedPackageBySlug = (slug: string) =>
  seedReportPackages.find((report) => report.slug === slug) ?? null;

const defaultCompleteness = {
  catalog: false,
  detail: false,
  sampleReport: false,
  references: false,
  localFixture: false,
  notes: ["This report has not been backfilled with extraction completeness metadata yet."],
};

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
    sampleRows: sampleRows.sort((a, b) => a.sortOrder - b.sortOrder),
    genotypeSummary: genotypeSummary.sort((a, b) => a.sortOrder - b.sortOrder),
    localTestFixture,
  };
};

export const list = query({
  args: {},
  handler: async (ctx) => {
    const dbReports = await ctx.db.query("reports").take(200);

    if (dbReports.length === 0) {
      return sortReports(seedReportPackages.map(toSummary));
    }

    return sortReports(dbReports.map(toSummary));
  },
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
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    for (const report of seedReportPackages) {
      const existing = await ctx.db
        .query("reports")
        .withIndex("by_slug", (q) => q.eq("slug", report.slug))
        .unique();

      const { references, prompt, outputSections, sampleRows, genotypeSummary, localTestFixture, ...reportDoc } = report;
      const dbReport = { ...reportDoc, updatedAt: now };

      if (existing) {
        await ctx.db.patch(existing._id, dbReport);
      } else {
        await ctx.db.insert("reports", dbReport);
      }

      await deleteExistingChildren(ctx, report.slug);

      for (const reference of references) {
        await ctx.db.insert("reportReferences", {
          reportSlug: report.slug,
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

    return { seeded: seedReportPackages.length, updatedAt: now };
  },
});
