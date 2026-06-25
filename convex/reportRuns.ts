import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const reportRunValidationStatus = v.union(
  v.literal("not_run"),
  v.literal("pending"),
  v.literal("passed"),
  v.literal("failed"),
);

const optionalString = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);
const optionalNumber = (value: number | undefined) => (Number.isFinite(value) ? value : undefined);

const compactRunId = (reportSlug: string, timestamp: number) => `${reportSlug}-${timestamp}`;

export const listForReport = query({
  args: {
    reportSlug: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { reportSlug, limit }) => {
    const pageSize = Math.min(Math.max(Math.floor(limit ?? 5), 1), 20);
    const runs = await ctx.db
      .query("reportRuns")
      .withIndex("by_reportSlug_and_createdAt", (q) => q.eq("reportSlug", reportSlug))
      .order("desc")
      .take(pageSize);

    return await Promise.all(
      runs.map(async (run) => {
        const inputSummary = await ctx.db
          .query("reportRunInputs")
          .withIndex("by_runId", (q) => q.eq("runId", run.runId))
          .unique();
        const resultSummaries = await ctx.db
          .query("reportRunResults")
          .withIndex("by_runId", (q) => q.eq("runId", run.runId))
          .take(1);

        return {
          ...run,
          inputSummary,
          resultSummary: resultSummaries[0] ?? null,
        };
      }),
    );
  },
});

export const createDraft = mutation({
  args: {
    reportSlug: v.string(),
    reportTitle: v.string(),
    packageVersion: v.optional(v.string()),
    promptHash: v.optional(v.string()),
    outputFormatHash: v.optional(v.string()),
    inputManifestHash: v.optional(v.string()),
    genomeBuild: v.optional(v.string()),
    derivedEvidenceCount: v.optional(v.number()),
    missingInputCount: v.optional(v.number()),
    preparedInputPath: v.optional(v.string()),
    derivedEvidencePath: v.optional(v.string()),
    sampleBackedFormalReady: v.boolean(),
    localScaffoldOnly: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = compactRunId(args.reportSlug, now);
    const inputManifestHash = optionalString(args.inputManifestHash);
    const genomeBuild = optionalString(args.genomeBuild);
    const derivedEvidenceCount = optionalNumber(args.derivedEvidenceCount);

    await ctx.db.insert("reportRuns", {
      runId,
      reportSlug: args.reportSlug,
      reportTitle: args.reportTitle,
      status: "draft",
      ...(optionalString(args.packageVersion) ? { packageVersion: optionalString(args.packageVersion) } : {}),
      ...(optionalString(args.promptHash) ? { promptHash: optionalString(args.promptHash) } : {}),
      ...(optionalString(args.outputFormatHash) ? { outputFormatHash: optionalString(args.outputFormatHash) } : {}),
      ...(inputManifestHash ? { inputManifestHash } : {}),
      ...(genomeBuild ? { genomeBuild } : {}),
      ...(derivedEvidenceCount !== undefined ? { derivedEvidenceCount } : {}),
      sampleBackedFormalReady: args.sampleBackedFormalReady,
      localScaffoldOnly: args.localScaffoldOnly,
      rawGenomeIncluded: false,
      storageBoundary:
        "Convex stores only local-run metadata, derived-evidence counts, hashes, artifact paths, and result summaries; raw genome records stay local.",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("reportRunInputs", {
      runId,
      reportSlug: args.reportSlug,
      ...(inputManifestHash ? { inputManifestHash } : {}),
      ...(genomeBuild ? { genomeBuild } : {}),
      ...(derivedEvidenceCount !== undefined ? { derivedEvidenceCount } : {}),
      ...(optionalNumber(args.missingInputCount) !== undefined ? { missingInputCount: optionalNumber(args.missingInputCount) } : {}),
      ...(optionalString(args.preparedInputPath) ? { preparedInputPath: optionalString(args.preparedInputPath) } : {}),
      ...(optionalString(args.derivedEvidencePath) ? { derivedEvidencePath: optionalString(args.derivedEvidencePath) } : {}),
      privacyBoundary:
        "Prepared local-agent input may contain sensitive derived observations; keep raw genome files and full private payloads outside Convex.",
      createdAt: now,
    });

    return { runId, createdAt: now };
  },
});

export const saveResultSummary = mutation({
  args: {
    runId: v.string(),
    reportSlug: v.string(),
    resultArtifactPath: v.optional(v.string()),
    schemaVersion: v.optional(v.string()),
    resultRows: v.number(),
    referenceCount: v.number(),
    appendixProbabilityCount: v.number(),
    appendixUncertaintyCount: v.number(),
    appendixMissingInputCount: v.number(),
    appendixLimitationCount: v.number(),
    validationStatus: reportRunValidationStatus,
    validationProblemCount: v.number(),
    validationWarningCount: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query("reportRuns")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (!run) {
      throw new Error(`Unknown report run ${args.runId}`);
    }
    if (run.reportSlug !== args.reportSlug) {
      throw new Error(`Run ${args.runId} belongs to ${run.reportSlug}, not ${args.reportSlug}`);
    }

    const now = Date.now();
    const existingSummaries = await ctx.db
      .query("reportRunResults")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .take(1);
    const resultSummary = {
      runId: args.runId,
      reportSlug: args.reportSlug,
      ...(optionalString(args.resultArtifactPath) ? { resultArtifactPath: optionalString(args.resultArtifactPath) } : {}),
      ...(optionalString(args.schemaVersion) ? { schemaVersion: optionalString(args.schemaVersion) } : {}),
      resultRows: args.resultRows,
      referenceCount: args.referenceCount,
      appendixProbabilityCount: args.appendixProbabilityCount,
      appendixUncertaintyCount: args.appendixUncertaintyCount,
      appendixMissingInputCount: args.appendixMissingInputCount,
      appendixLimitationCount: args.appendixLimitationCount,
      validationStatus: args.validationStatus,
      validationProblemCount: args.validationProblemCount,
      validationWarningCount: args.validationWarningCount,
      rawGenomeIncluded: false,
      savedAt: now,
    };

    if (existingSummaries[0]) {
      await ctx.db.replace(existingSummaries[0]._id, resultSummary);
    } else {
      await ctx.db.insert("reportRunResults", resultSummary);
    }
    await ctx.db.patch(run._id, {
      status: args.validationStatus === "passed" ? "validated" : "result_saved",
      updatedAt: now,
    });

    return { runId: args.runId, savedAt: now };
  },
});
