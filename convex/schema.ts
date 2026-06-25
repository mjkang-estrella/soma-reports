import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const curationStatus = v.union(
  v.literal("direct"),
  v.literal("inferred"),
  v.literal("curated"),
  v.literal("blocked"),
);

const outputFormatEvidenceKind = v.union(
  v.literal("official_sample_rows"),
  v.literal("official_completed_output"),
  v.literal("official_boundary_only"),
  v.literal("official_metadata_only"),
  v.literal("sibling_sample"),
  v.literal("local_scaffold"),
);

const outputAvailability = v.union(
  v.literal("captured"),
  v.literal("not_captured"),
  v.literal("unavailable"),
  v.literal("not_applicable"),
);

const formalOutputBlueprint = v.object({
  sectionKey: v.string(),
  sectionRole: v.string(),
  evidenceKind: outputFormatEvidenceKind,
  availability: outputAvailability,
  sourceArtifact: v.optional(v.string()),
  nonPromotionBoundary: v.string(),
  promotesFormalReadiness: v.literal(false),
});

const outputField = v.object({
  key: v.string(),
  label: v.string(),
  description: v.string(),
  type: v.string(),
  required: v.boolean(),
  fieldPath: v.optional(v.string()),
  citationRequired: v.optional(v.boolean()),
  sourceBinding: v.optional(v.string()),
  formalSourceField: v.optional(v.string()),
  allowsUnavailable: v.optional(v.boolean()),
  formalOutputBlueprint: v.optional(formalOutputBlueprint),
  officialFieldPath: v.optional(v.string()),
  formalDisplayRole: v.optional(v.string()),
  availability: v.optional(outputAvailability),
  unavailableReason: v.optional(v.string()),
});

const genomeEvidence = v.object({
  inputId: v.string(),
  rsid: v.optional(v.string()),
  starAllele: v.optional(v.string()),
  haplotype: v.optional(v.string()),
  gene: v.string(),
  observedValue: v.string(),
  assembly: v.string(),
  matchStatus: v.string(),
  sourceFile: v.optional(v.string()),
  sourceArtifact: v.optional(v.string()),
});

const reportRunStatus = v.union(
  v.literal("draft"),
  v.literal("input_prepared"),
  v.literal("result_saved"),
  v.literal("validated"),
);

const reportRunValidationStatus = v.union(
  v.literal("not_run"),
  v.literal("pending"),
  v.literal("passed"),
  v.literal("failed"),
);

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
    priceLabel: v.optional(v.string()),
    catalogCategories: v.optional(v.array(v.string())),
    catalogSource: v.optional(v.string()),
    curationStatus,
    sampleReportStatus: v.string(),
    sourceArtifacts: v.array(v.string()),
    curationCompleteness: v.object({
      catalog: v.boolean(),
      detail: v.boolean(),
      sampleReport: v.boolean(),
      references: v.boolean(),
      localFixture: v.boolean(),
      prompt: v.optional(v.boolean()),
      outputFormat: v.optional(v.boolean()),
      formalFields: v.optional(v.boolean()),
      citationBindings: v.optional(v.boolean()),
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
    resourceId: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    title: v.string(),
    url: v.string(),
    sourceType: v.string(),
    theme: v.string(),
    note: v.string(),
    evidenceLevel: v.string(),
    extractionStatus: curationStatus,
    scope: v.optional(v.union(v.literal("report_specific"), v.literal("background"))),
    accessedAt: v.optional(v.string()),
    contentHash: v.optional(v.string()),
    sourceArtifact: v.optional(v.string()),
    usedFor: v.optional(v.array(v.string())),
  }).index("by_reportSlug", ["reportSlug"]),

  reportPrompts: defineTable({
    reportSlug: v.string(),
    title: v.string(),
    promptVersion: v.optional(v.string()),
    promptHash: v.optional(v.string()),
    outputFormatHash: v.optional(v.string()),
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
    formalOutputBlueprint: v.optional(formalOutputBlueprint),
    expectedFields: v.array(outputField),
  }).index("by_reportSlug_and_sortOrder", ["reportSlug", "sortOrder"]),

  reportFormalFields: defineTable({
    reportSlug: v.string(),
    sortOrder: v.number(),
    sourceLabel: v.string(),
    observedField: v.string(),
    outputPath: v.string(),
    status: v.union(v.literal("covered"), v.literal("pending"), v.literal("not_applicable")),
    notes: v.string(),
  }).index("by_reportSlug_and_sortOrder", ["reportSlug", "sortOrder"]),

  reportSampleRows: defineTable({
    reportSlug: v.string(),
    sortOrder: v.number(),
    groupTitle: v.string(),
    item: v.string(),
    brandName: v.string(),
    geneticAnalysis: v.string(),
    description: v.optional(v.string()),
    genes: v.array(v.string()),
    sourceLabel: v.string(),
    sourceResourceIds: v.optional(v.array(v.string())),
    sourceBindingStatus: v.optional(
      v.union(
        v.literal("exact"),
        v.literal("curated"),
        v.literal("sample_label_only"),
        v.literal("unavailable"),
      ),
    ),
    sourceBindingNote: v.optional(v.string()),
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
    packageSlug: v.optional(v.string()),
    datasetId: v.string(),
    packageVersion: v.string(),
    reportPurpose: v.optional(v.string()),
    missingInputPolicy: v.optional(v.string()),
    consumerTone: v.optional(v.string()),
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

  reportRuns: defineTable({
    runId: v.string(),
    reportSlug: v.string(),
    reportTitle: v.string(),
    status: reportRunStatus,
    packageVersion: v.optional(v.string()),
    promptHash: v.optional(v.string()),
    outputFormatHash: v.optional(v.string()),
    inputManifestHash: v.optional(v.string()),
    genomeBuild: v.optional(v.string()),
    derivedEvidenceCount: v.optional(v.number()),
    sampleBackedFormalReady: v.boolean(),
    localScaffoldOnly: v.boolean(),
    rawGenomeIncluded: v.boolean(),
    storageBoundary: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_runId", ["runId"])
    .index("by_reportSlug_and_createdAt", ["reportSlug", "createdAt"]),

  reportRunInputs: defineTable({
    runId: v.string(),
    reportSlug: v.string(),
    inputManifestHash: v.optional(v.string()),
    genomeBuild: v.optional(v.string()),
    derivedEvidenceCount: v.optional(v.number()),
    missingInputCount: v.optional(v.number()),
    preparedInputPath: v.optional(v.string()),
    derivedEvidencePath: v.optional(v.string()),
    privacyBoundary: v.string(),
    createdAt: v.number(),
  }).index("by_runId", ["runId"]),

  reportRunResults: defineTable({
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
    rawGenomeIncluded: v.boolean(),
    savedAt: v.number(),
  }).index("by_runId", ["runId"]),
});
