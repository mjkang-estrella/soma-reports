import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const curationStatus = v.union(
  v.literal("direct"),
  v.literal("inferred"),
  v.literal("curated"),
  v.literal("blocked"),
);

const outputField = v.object({
  key: v.string(),
  label: v.string(),
  description: v.string(),
  type: v.string(),
  required: v.boolean(),
});

const genomeEvidence = v.object({
  inputId: v.string(),
  rsid: v.string(),
  gene: v.string(),
  observedValue: v.string(),
  assembly: v.string(),
  matchStatus: v.string(),
});

export default defineSchema({
  reports: defineTable({
    slug: v.string(),
    title: v.string(),
    subtitle: v.string(),
    category: v.string(),
    provider: v.string(),
    version: v.string(),
    status: v.string(),
    summary: v.string(),
    detail: v.string(),
    audience: v.string(),
    claimScope: v.string(),
    sourceUrl: v.string(),
    marketplaceUrl: v.string(),
    curationStatus,
    sampleReportStatus: v.string(),
    sourceArtifacts: v.array(v.string()),
    curationCompleteness: v.object({
      catalog: v.boolean(),
      detail: v.boolean(),
      sampleReport: v.boolean(),
      references: v.boolean(),
      localFixture: v.boolean(),
      notes: v.array(v.string()),
    }),
    tags: v.array(v.string()),
    visibleFields: v.array(v.string()),
    genomeInputs: v.array(
      v.object({
        id: v.string(),
        kind: v.string(),
        label: v.string(),
        required: v.boolean(),
        assembly: v.string(),
        missingDataBehavior: v.string(),
      }),
    ),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .searchIndex("search_title_and_summary", {
      searchField: "title",
      filterFields: ["category", "status"],
    }),

  reportReferences: defineTable({
    reportSlug: v.string(),
    title: v.string(),
    url: v.string(),
    sourceType: v.string(),
    theme: v.string(),
    note: v.string(),
    evidenceLevel: v.string(),
    extractionStatus: curationStatus,
  }).index("by_reportSlug", ["reportSlug"]),

  reportPrompts: defineTable({
    reportSlug: v.string(),
    title: v.string(),
    deterministicPrompt: v.string(),
    inputContract: v.array(v.string()),
    outputContract: v.array(v.string()),
    appendixPolicy: v.string(),
    probabilityDisclosure: v.string(),
    safetyNotes: v.array(v.string()),
    extractionStatus: curationStatus,
  }).index("by_reportSlug", ["reportSlug"]),

  reportOutputSections: defineTable({
    reportSlug: v.string(),
    sortOrder: v.number(),
    title: v.string(),
    purpose: v.string(),
    expectedFields: v.array(outputField),
  }).index("by_reportSlug_and_sortOrder", ["reportSlug", "sortOrder"]),

  reportSampleRows: defineTable({
    reportSlug: v.string(),
    sortOrder: v.number(),
    groupTitle: v.string(),
    item: v.string(),
    brandName: v.string(),
    geneticAnalysis: v.string(),
    genes: v.array(v.string()),
    sourceLabel: v.string(),
    extractionStatus: curationStatus,
  }).index("by_reportSlug_and_sortOrder", ["reportSlug", "sortOrder"]),

  reportGenotypeSummaries: defineTable({
    reportSlug: v.string(),
    sortOrder: v.number(),
    tier: v.string(),
    gene: v.string(),
    variantId: v.string(),
    genotype: v.string(),
    effect: v.string(),
    phenotype: v.string(),
    extractionStatus: curationStatus,
  }).index("by_reportSlug_and_sortOrder", ["reportSlug", "sortOrder"]),

  reportLocalFixtures: defineTable({
    reportSlug: v.string(),
    datasetId: v.string(),
    packageVersion: v.string(),
    inputManifest: v.object({
      hash: v.string(),
      genomeBuild: v.string(),
      rawGenomeReturned: v.boolean(),
      source: v.string(),
    }),
    genomeEvidence: v.array(genomeEvidence),
    referenceResources: v.array(
      v.object({
        id: v.string(),
        title: v.string(),
        sourceType: v.string(),
        evidenceLevel: v.string(),
        usedFor: v.array(v.string()),
      }),
    ),
    expectedAssertions: v.object({
      noRawGenomeInOutput: v.boolean(),
      everyFindingHasReference: v.boolean(),
      missingInputsAreExplicit: v.boolean(),
      probabilitiesOnlyInAppendix: v.boolean(),
      consumerLanguage: v.boolean(),
    }),
  }).index("by_reportSlug", ["reportSlug"]),
});
