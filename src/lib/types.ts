export type CurationStatus = "direct" | "inferred" | "curated" | "blocked";

export type CurationCompleteness = {
  catalog: boolean;
  detail: boolean;
  sampleReport: boolean;
  references: boolean;
  localFixture: boolean;
  prompt?: boolean;
  outputFormat?: boolean;
  formalFields?: boolean;
  citationBindings?: boolean;
  notes: string[];
};

export type ReportSummary = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  provider: string;
  version: string;
  status: string;
  summary: string;
  sourceUrl: string;
  marketplaceUrl: string;
  priceLabel?: string;
  catalogCategories?: string[];
  catalogSource?: string;
  curationStatus: CurationStatus;
  sampleReportStatus: string;
  curationCompleteness: CurationCompleteness;
  tags: string[];
};

export type ReferenceResource = {
  resourceId?: string;
  sortOrder?: number;
  title: string;
  url: string;
  sourceType: string;
  theme: string;
  note: string;
  evidenceLevel: string;
  extractionStatus: CurationStatus;
  scope?: "report_specific" | "background";
  accessedAt?: string;
  contentHash?: string;
  sourceArtifact?: string;
  usedFor?: string[];
};

export type PromptSpec = {
  title: string;
  promptVersion?: string;
  promptHash?: string;
  outputFormatHash?: string;
  deterministicPrompt: string;
  inputContract: string[];
  outputContract: string[];
  appendixPolicy: string;
  probabilityDisclosure: string;
  safetyNotes: string[];
  extractionStatus: CurationStatus;
};

export type OutputField = {
  key: string;
  label: string;
  description: string;
  type: string;
  required: boolean;
  fieldPath?: string;
  citationRequired?: boolean;
  sourceBinding?: string;
  formalSourceField?: string;
  allowsUnavailable?: boolean;
};

export type OutputSection = {
  sortOrder: number;
  title: string;
  purpose: string;
  expectedFields: OutputField[];
};

export type GenomeInputSpec = {
  id: string;
  kind: string;
  label: string;
  required: boolean;
  assembly: string;
  missingDataBehavior: string;
};

export type SampleReportRow = {
  sortOrder: number;
  groupTitle: string;
  item: string;
  brandName: string;
  geneticAnalysis: string;
  description?: string;
  genes: string[];
  sourceLabel: string;
  sourceResourceIds?: string[];
  sourceBindingStatus?: "exact" | "curated" | "sample_label_only" | "unavailable";
  sourceBindingNote?: string;
  extractionStatus: CurationStatus;
};

export type GenotypeSummaryRow = {
  sortOrder: number;
  tier: string;
  gene: string;
  variantId: string;
  genotype: string;
  effect: string;
  phenotype: string;
  extractionStatus: CurationStatus;
};

export type LocalTestFixture = {
  packageSlug?: string;
  datasetId: string;
  packageVersion: string;
  reportPurpose?: string;
  missingInputPolicy?: string;
  consumerTone?: string;
  inputManifest: {
    hash: string;
    genomeBuild: string;
    rawGenomeReturned: boolean;
    source: string;
  };
  genomeEvidence: Array<{
    inputId: string;
    rsid?: string;
    starAllele?: string;
    haplotype?: string;
    gene: string;
    observedValue: string;
    assembly: string;
    matchStatus: string;
    sourceFile?: string;
    sourceArtifact?: string;
  }>;
  referenceResources: Array<{
    id: string;
    title: string;
    sourceType: string;
    evidenceLevel: string;
    usedFor: string[];
  }>;
  expectedAssertions: Record<string, boolean>;
};

export type FormalFieldCoverage = {
  sortOrder: number;
  sourceLabel: string;
  observedField: string;
  outputPath: string;
  status: "covered" | "pending" | "not_applicable";
  notes: string;
};

export type ReportPackage = ReportSummary & {
  detail: string;
  audience: string;
  claimScope: string;
  sourceArtifacts: string[];
  curationCompleteness: CurationCompleteness;
  visibleFields: string[];
  genomeInputs: GenomeInputSpec[];
  references: ReferenceResource[];
  prompt: PromptSpec | null;
  sampleRows: SampleReportRow[];
  genotypeSummary: GenotypeSummaryRow[];
  localTestFixture: LocalTestFixture | null;
  formalFields: FormalFieldCoverage[];
  outputSections: OutputSection[];
};

export type CatalogStats = {
  knownMarketplaceTotal: number;
  seeded: number;
  identifiedMarketplaceItems: number;
  namedAuthenticatedOnly: number;
  unknownMarketplaceItems: number;
  seededCoverageComplete: boolean;
  directCatalog: number;
  sampleExtracted: number;
  outputFormatReady: number;
  promptReady: number;
  referencesReady: number;
  localFixtureReady: number;
  formalFieldsReady: number;
  citationBindingsReady: number;
  sampleBackedFormalReady: number;
  formalEquivalentReady: number;
  detailPageReady: number;
  fullyReady: number;
};
