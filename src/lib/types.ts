export type CurationStatus = "direct" | "inferred" | "curated" | "blocked";

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
  curationStatus: CurationStatus;
  sampleReportStatus: string;
  tags: string[];
};

export type ReferenceResource = {
  title: string;
  url: string;
  sourceType: string;
  theme: string;
  note: string;
  evidenceLevel: string;
  extractionStatus: CurationStatus;
};

export type PromptSpec = {
  title: string;
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
  genes: string[];
  sourceLabel: string;
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
  datasetId: string;
  packageVersion: string;
  inputManifest: {
    hash: string;
    genomeBuild: string;
    rawGenomeReturned: boolean;
    source: string;
  };
  genomeEvidence: Array<{
    inputId: string;
    rsid: string;
    gene: string;
    observedValue: string;
    assembly: string;
    matchStatus: string;
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

export type ReportPackage = ReportSummary & {
  detail: string;
  audience: string;
  claimScope: string;
  sourceArtifacts: string[];
  curationCompleteness: {
    catalog: boolean;
    detail: boolean;
    sampleReport: boolean;
    references: boolean;
    localFixture: boolean;
    notes: string[];
  };
  visibleFields: string[];
  genomeInputs: GenomeInputSpec[];
  references: ReferenceResource[];
  prompt: PromptSpec | null;
  sampleRows: SampleReportRow[];
  genotypeSummary: GenotypeSummaryRow[];
  localTestFixture: LocalTestFixture | null;
  outputSections: OutputSection[];
};
