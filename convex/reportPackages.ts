export type CurationStatus = "direct" | "inferred" | "curated" | "blocked";

export type ReferenceResourceSeed = {
  title: string;
  url: string;
  sourceType: string;
  theme: string;
  note: string;
  evidenceLevel: string;
  extractionStatus: CurationStatus;
};

export type SampleReportRowSeed = {
  sortOrder: number;
  groupTitle: string;
  item: string;
  brandName: string;
  geneticAnalysis: string;
  genes: string[];
  sourceLabel: string;
  extractionStatus: CurationStatus;
};

export type GenotypeSummarySeed = {
  sortOrder: number;
  tier: string;
  gene: string;
  variantId: string;
  genotype: string;
  effect: string;
  phenotype: string;
  extractionStatus: CurationStatus;
};

export type LocalTestFixtureSeed = {
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
  expectedAssertions: {
    noRawGenomeInOutput: boolean;
    everyFindingHasReference: boolean;
    missingInputsAreExplicit: boolean;
    probabilitiesOnlyInAppendix: boolean;
    consumerLanguage: boolean;
  };
};

export type ReportPackageSeed = {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  provider: string;
  version: string;
  status: string;
  summary: string;
  detail: string;
  audience: string;
  claimScope: string;
  sourceUrl: string;
  marketplaceUrl: string;
  curationStatus: CurationStatus;
  sampleReportStatus: string;
  sourceArtifacts: string[];
  curationCompleteness: {
    catalog: boolean;
    detail: boolean;
    sampleReport: boolean;
    references: boolean;
    localFixture: boolean;
    notes: string[];
  };
  tags: string[];
  visibleFields: string[];
  genomeInputs: Array<{
    id: string;
    kind: string;
    label: string;
    required: boolean;
    assembly: string;
    missingDataBehavior: string;
  }>;
  references: ReferenceResourceSeed[];
  prompt: {
    title: string;
    deterministicPrompt: string;
    inputContract: string[];
    outputContract: string[];
    appendixPolicy: string;
    probabilityDisclosure: string;
    safetyNotes: string[];
    extractionStatus: CurationStatus;
  } | null;
  sampleRows: SampleReportRowSeed[];
  genotypeSummary: GenotypeSummarySeed[];
  localTestFixture: LocalTestFixtureSeed | null;
  outputSections: Array<{
    sortOrder: number;
    title: string;
    purpose: string;
    expectedFields: Array<{
      key: string;
      label: string;
      description: string;
      type: string;
      required: boolean;
    }>;
  }>;
};

const sourceUrls = {
  marketplace: "https://sequencing.com/marketplace",
  appAggregate: "https://sequencing.com/apps/app-market/page_view_event/aggregate",
  marketplaceDocs: "https://sequencing.com/knowledge-center/dna-reports-app-analysis/report-marketplace",
  wellnessSample: "https://sequencing.com/sites/default/files/wellness_sample_report.pdf",
  geneticDiseaseEducation: "https://sequencing.com/knowledge-center/genetic-testing-for-diseases",
  nhgriPrs: "https://www.genome.gov/Health/Genomics-and-Medicine/Polygenic-risk-scores",
  gwasCatalog: "https://www.ebi.ac.uk/gwas/",
  clingen: "https://www.clinicalgenome.org/",
  pharmgkb: "https://www.pharmgkb.org/",
  cpic: "https://cpicpgx.org/",
};

const sharedReferences: ReferenceResourceSeed[] = [
  {
    title: "Sequencing.com Report Marketplace documentation",
    url: sourceUrls.marketplaceDocs,
    sourceType: "sequencing_public_doc",
    theme: "Marketplace categories and report flow",
    note: "Public Sequencing.com documentation says marketplace reports analyze DNA data across health, wellness, ancestry, nutrition, and fitness.",
    evidenceLevel: "background",
    extractionStatus: "direct",
  },
  {
    title: "NHGRI overview of polygenic risk scores",
    url: sourceUrls.nhgriPrs,
    sourceType: "education_resource",
    theme: "Polygenic and probabilistic traits",
    note: "Useful background for explaining why complex trait outputs should separate deterministic findings from probability and uncertainty.",
    evidenceLevel: "background",
    extractionStatus: "curated",
  },
  {
    title: "GWAS Catalog",
    url: sourceUrls.gwasCatalog,
    sourceType: "database",
    theme: "Trait and variant association lookup",
    note: "Curated database for candidate trait associations when building report-specific evidence packs.",
    evidenceLevel: "background",
    extractionStatus: "curated",
  },
  {
    title: "ClinGen",
    url: sourceUrls.clingen,
    sourceType: "database",
    theme: "Gene and variant clinical validity",
    note: "Use for clinical validity context when a report crosses from wellness into medical-risk interpretation.",
    evidenceLevel: "background",
    extractionStatus: "curated",
  },
];

const wellnessReferences: ReferenceResourceSeed[] = [
  {
    title: "Wellness Genetic Guide sample report",
    url: sourceUrls.wellnessSample,
    sourceType: "mock_report",
    theme: "Observed output structure",
    note: "Public sample PDF directly shows cover, table of contents, disclaimer, result table, appendix glossary, and genotype summary.",
    evidenceLevel: "high",
    extractionStatus: "direct",
  },
  {
    title: "PharmGKB",
    url: sourceUrls.pharmgkb,
    sourceType: "database",
    theme: "Pharmacogenetics evidence",
    note: "Curated pharmacogenomics resource for gene-drug evidence related to observed Wellness sample themes.",
    evidenceLevel: "background",
    extractionStatus: "curated",
  },
  {
    title: "Clinical Pharmacogenetics Implementation Consortium",
    url: sourceUrls.cpic,
    sourceType: "guideline",
    theme: "Pharmacogenetics implementation guidance",
    note: "Guideline source for pharmacogenetic gene-drug interpretation where a report includes medication or supplement sensitivity.",
    evidenceLevel: "background",
    extractionStatus: "curated",
  },
  ...sharedReferences,
];

const wellnessSampleRows: SampleReportRowSeed[] = [
  {
    sortOrder: 1,
    groupTitle: "Histamine H1 receptor blockers",
    item: "Hydroxyzine",
    brandName: "Atarax",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["KCNH2"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 2,
    groupTitle: "Histamine H1 receptor blockers",
    item: "Promethazine",
    brandName: "Phenergan",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["CYP2D6"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 3,
    groupTitle: "Histamine H1 receptor blockers",
    item: "Fexofenadine",
    brandName: "Allegra",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["ABCB1"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 4,
    groupTitle: "Glucocorticosteroids (Steroids)",
    item: "Beclomethasone",
    brandName: "Qvar",
    geneticAnalysis: "Increased genetic risk of adverse reaction",
    genes: ["CYP3A5"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 5,
    groupTitle: "Glucocorticosteroids (Steroids)",
    item: "Methylprednisolone",
    brandName: "Medrol",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["ABCB1"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 6,
    groupTitle: "Glucocorticosteroids (Steroids)",
    item: "Prednisolone",
    brandName: "Prelone",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["ABCB1"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 7,
    groupTitle: "Glucocorticosteroids (Steroids)",
    item: "Triamcinolone",
    brandName: "Kenalog",
    geneticAnalysis: "HCG22: Increased ocular hypertension in people with retinal diseases",
    genes: ["HCG22"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 8,
    groupTitle: "Vitamins",
    item: "L-Methylfolate",
    brandName: "Deplin",
    geneticAnalysis: "Increased genetic risk of adverse reaction",
    genes: ["MTHFR"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 9,
    groupTitle: "Vitamins",
    item: "L-Phenylalanine",
    brandName: "Maxan",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["PAH"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 10,
    groupTitle: "Vitamins",
    item: "Vitamin E",
    brandName: "E-Gems",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["CYP4F2"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 11,
    groupTitle: "Vitamins",
    item: "Vitamin K1",
    brandName: "AquaMephyton",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["CYP4F2"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 12,
    groupTitle: "Vitamins",
    item: "Ascorbic acid (vitamin C), combinations",
    brandName: "C-1000",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["G6PD"],
    sourceLabel: "FDA",
    extractionStatus: "direct",
  },
  {
    sortOrder: 13,
    groupTitle: "Vitamins",
    item: "Ascorbic acid (vitamin C), plain",
    brandName: "C-1000",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["G6PD"],
    sourceLabel: "FDA",
    extractionStatus: "direct",
  },
  {
    sortOrder: 14,
    groupTitle: "Vitamins",
    item: "Sodium Ascorbate",
    brandName: "Sodium Ascorbate",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["G6PD"],
    sourceLabel: "FDA",
    extractionStatus: "direct",
  },
  {
    sortOrder: 15,
    groupTitle: "Vitamins",
    item: "Niacin",
    brandName: "Niaspan",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["NR1H3"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 16,
    groupTitle: "Vitamins",
    item: "Pyridoxal Phosphate",
    brandName: "P-5-P",
    geneticAnalysis: "No increased genetic risk detected",
    genes: ["NAT2"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 17,
    groupTitle: "Vitamins",
    item: "Folic Acid",
    brandName: "Folvite",
    geneticAnalysis: "Increased genetic risk of adverse reaction",
    genes: ["MTHFR"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 18,
    groupTitle: "Vitamins",
    item: "Cyanocobalamin",
    brandName: "B12-Max",
    geneticAnalysis: "Increased genetic risk of adverse reaction",
    genes: ["MTHFR"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
  {
    sortOrder: 19,
    groupTitle: "Histamine H1 receptor blockers",
    item: "Diphenhydramine",
    brandName: "Benadryl",
    geneticAnalysis: "Increased genetic risk of lack of efficacy",
    genes: ["CYP2C8"],
    sourceLabel: "Article",
    extractionStatus: "direct",
  },
];

const wellnessGenotypeSummary: GenotypeSummarySeed[] = [
  {
    sortOrder: 1,
    tier: "High-Impact Clinical Significance",
    gene: "CYP2D6",
    variantId: "",
    genotype: "*1/*41",
    effect: "One decreased function allele and one normal function allele",
    phenotype: "Normal Metabolizer",
    extractionStatus: "direct",
  },
  {
    sortOrder: 2,
    tier: "High-Impact Clinical Significance",
    gene: "CYP3A5",
    variantId: "",
    genotype: "*1/*3",
    effect: "One no function allele and one normal function allele",
    phenotype: "Intermediate Metabolizer",
    extractionStatus: "direct",
  },
  {
    sortOrder: 3,
    tier: "High-Impact Clinical Significance",
    gene: "CYP4F2",
    variantId: "",
    genotype: "*3/*3",
    effect: "N/A",
    phenotype: "N/A",
    extractionStatus: "direct",
  },
  {
    sortOrder: 4,
    tier: "High-Impact Clinical Significance",
    gene: "NAT2",
    variantId: "",
    genotype: "*5/*6",
    effect: "Two decreased function alleles",
    phenotype: "Poor Metabolizer",
    extractionStatus: "direct",
  },
  {
    sortOrder: 5,
    tier: "Exploratory Functional Assessment",
    gene: "ABCB1",
    variantId: "rs1045642",
    genotype: "G/G",
    effect: "Synonymous variant I1145=",
    phenotype: "Altered function",
    extractionStatus: "direct",
  },
  {
    sortOrder: 6,
    tier: "Exploratory Functional Assessment",
    gene: "ABCB1",
    variantId: "rs1128503",
    genotype: "G/G",
    effect: "Synonymous variant G412=",
    phenotype: "Altered function",
    extractionStatus: "direct",
  },
  {
    sortOrder: 7,
    tier: "Exploratory Functional Assessment",
    gene: "ABCB1",
    variantId: "rs2032582",
    genotype: "C/C",
    effect: "Missense benign S893A",
    phenotype: "",
    extractionStatus: "direct",
  },
  {
    sortOrder: 8,
    tier: "Exploratory Functional Assessment",
    gene: "CYP2C8",
    variantId: "",
    genotype: "*1/*4",
    effect: "Decreased / normal function allele",
    phenotype: "Altered/Poor function",
    extractionStatus: "direct",
  },
  {
    sortOrder: 9,
    tier: "Exploratory Functional Assessment",
    gene: "KCNH2",
    variantId: "rs1137617",
    genotype: "A/G",
    effect: "",
    phenotype: "Altered function",
    extractionStatus: "direct",
  },
  {
    sortOrder: 10,
    tier: "Exploratory Functional Assessment",
    gene: "MTHFR",
    variantId: "rs1801133",
    genotype: "G/A",
    effect: "Missense pathogenic A222V",
    phenotype: "Decreased function",
    extractionStatus: "direct",
  },
  {
    sortOrder: 11,
    tier: "Exploratory Functional Assessment",
    gene: "NR1H3",
    variantId: "",
    genotype: "No variants found that alter gene function",
    effect: "",
    phenotype: "Normal function",
    extractionStatus: "direct",
  },
  {
    sortOrder: 12,
    tier: "Exploratory Functional Assessment",
    gene: "PAH",
    variantId: "",
    genotype: "No variants found that alter gene function",
    effect: "",
    phenotype: "Normal function",
    extractionStatus: "direct",
  },
];

const wellnessLocalTestFixture: LocalTestFixtureSeed = {
  datasetId: "fixture.synthetic",
  packageVersion: "0.1.0",
  inputManifest: {
    hash: "sha256:synthetic-only",
    genomeBuild: "GRCh38",
    rawGenomeReturned: false,
    source: "synthetic_derived_evidence_json",
  },
  genomeEvidence: [
    {
      inputId: "MTHFR-rs1801133",
      rsid: "rs1801133",
      gene: "MTHFR",
      observedValue: "G/A",
      assembly: "GRCh38",
      matchStatus: "sample_pdf_match",
    },
    {
      inputId: "KCNH2-rs1137617",
      rsid: "rs1137617",
      gene: "KCNH2",
      observedValue: "A/G",
      assembly: "GRCh38",
      matchStatus: "sample_pdf_match",
    },
    {
      inputId: "ABCB1-rs1045642",
      rsid: "rs1045642",
      gene: "ABCB1",
      observedValue: "G/G",
      assembly: "GRCh38",
      matchStatus: "sample_pdf_match",
    },
  ],
  referenceResources: [
    {
      id: "wellness-sample-pdf",
      title: "Wellness Genetic Guide sample report",
      sourceType: "mock_report",
      evidenceLevel: "structure",
      usedFor: ["output_sections", "visible_fields", "result_table_shape", "genotype_summary_shape"],
    },
  ],
  expectedAssertions: {
    noRawGenomeInOutput: true,
    everyFindingHasReference: true,
    missingInputsAreExplicit: true,
    probabilitiesOnlyInAppendix: true,
    consumerLanguage: true,
  },
};

const wellnessGeneticGuide: ReportPackageSeed = {
  slug: "wellness-genetic-guide",
  title: "Wellness Genetic Guide",
  subtitle: "Consumer wellness and pharmacogenetic-style report package",
  category: "Wellness",
  provider: "Quantum Genomics | Golden Gate Gene",
  version: "0.1.0",
  status: "observed-sample",
  summary:
    "Recreates the public sample-report structure for a wellness guide that includes drug, vitamin, supplement, gene, and source-backed result rows.",
  detail:
    "The public sample PDF shows a report-style output with disclaimers, a result table, and an appendix. Exact papers are not named in the sample, so this package tracks the sample structure directly and treats report-specific literature as curated follow-up work.",
  audience: "general consumer",
  claimScope: "wellness-pharmacogenomics",
  sourceUrl: sourceUrls.wellnessSample,
  marketplaceUrl: "https://sequencing.com/marketplace/wellness-genetic-guide",
  curationStatus: "direct",
  sampleReportStatus: "Public sample PDF observed and authenticated marketplace card visible.",
  sourceArtifacts: [
    sourceUrls.wellnessSample,
    sourceUrls.marketplace,
    "output/browser/sequencing-marketplace-auth.png",
  ],
  curationCompleteness: {
    catalog: true,
    detail: true,
    sampleReport: true,
    references: false,
    localFixture: true,
    notes: [
      "Authenticated marketplace first fold showed the Wellness Genetic Guide card under Health with $79 price and Get Report CTA.",
      "Public sample PDF exposes result-table and genotype-summary structure.",
      "Exact article citations behind Article/FDA labels are not named in the sample PDF.",
    ],
  },
  tags: ["wellness", "pharmacogenetics", "supplements", "sample-pdf"],
  visibleFields: [
    "Cover",
    "Table of contents",
    "Disclaimer and limitations",
    "Result table",
    "Appendix glossary",
    "Genotype summary",
    "Columns: Drug, Result Of Genetic Analysis, Gene(s), Source",
    "Marketplace card: $79, Get Report, developed by Quantum Genomics | Golden Gate Gene",
  ],
  genomeInputs: [
    { id: "KCNH2", kind: "gene", label: "KCNH2", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "CYP2D6", kind: "haplotype", label: "CYP2D6 star allele", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "ABCB1", kind: "gene", label: "ABCB1", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "CYP3A5", kind: "haplotype", label: "CYP3A5 star allele", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "MTHFR-rs1801133", kind: "variant", label: "MTHFR rs1801133", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "PAH", kind: "gene", label: "PAH", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "CYP4F2", kind: "gene", label: "CYP4F2", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "G6PD", kind: "gene", label: "G6PD", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "NAT2", kind: "haplotype", label: "NAT2 star allele", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
    { id: "CYP2C8", kind: "gene", label: "CYP2C8", required: false, assembly: "either", missingDataBehavior: "state_unavailable" },
  ],
  references: wellnessReferences,
  prompt: {
    title: "Wellness Genetic Guide local-agent prompt",
    deterministicPrompt: [
      "You are generating a consumer Wellness Genetic Guide from local genome-derived evidence and supplied reference resources.",
      "Use only the provided genome evidence and reference resources. Do not invent variants, genes, studies, drug labels, scores, or medical conclusions.",
      "Write deterministic report sections first. Put probability, confidence, and uncertainty only in the appendix.",
      "Use plain English for general customers. Do not write for clinicians, pharma teams, or researchers.",
      "If a marker or allele is missing, mark that row or section as unavailable or limited instead of guessing.",
      "Every result row must cite one of the provided reference IDs or mark the source as unavailable.",
      "Do not diagnose disease and do not recommend starting, stopping, or changing medications or supplements.",
      "Return valid JSON matching the output contract. Do not include markdown outside JSON.",
    ].join("\\n"),
    inputContract: [
      "reportPurpose",
      "referenceResources[]",
      "genomeEvidence[] with gene, rsid or star allele, observed value, build, and source file",
      "missingInputPolicy",
      "consumerTone",
    ],
    outputContract: [
      "reportOverview",
      "keyHighlights",
      "resultRows[] with item, geneticAnalysis, genes, sourceIds, plainEnglishMeaning",
      "practicalNextSteps",
      "references",
      "appendix with genotype summary, glossary, probabilities, uncertainty, missing inputs, limitations",
    ],
    appendixPolicy:
      "Probability, confidence, calibration status, and missing-data limitations must appear after the deterministic report sections.",
    probabilityDisclosure:
      "Use calibrated probabilities only when provided by the input evidence. Otherwise use directional confidence labels and say not quantified.",
    safetyNotes: [
      "This is educational wellness information, not diagnosis.",
      "Medication and supplement findings require clinician or pharmacist review.",
      "Genetics is one input among environment, lifestyle, age, sex, and medical history.",
    ],
    extractionStatus: "curated",
  },
  sampleRows: wellnessSampleRows,
  genotypeSummary: wellnessGenotypeSummary,
  localTestFixture: wellnessLocalTestFixture,
  outputSections: [
    {
      sortOrder: 1,
      title: "Report overview",
      purpose: "Explain what the report covers, what input data was used, and the consumer-safe limits.",
      expectedFields: [
        { key: "reportTitle", label: "Report title", description: "Human-readable title.", type: "string", required: true },
        { key: "inputManifestHash", label: "Input manifest hash", description: "Hash for reproducibility without storing raw genome files.", type: "string", required: true },
        { key: "sectionsUnavailable", label: "Unavailable sections", description: "Sections skipped because evidence was missing.", type: "string[]", required: true },
      ],
    },
    {
      sortOrder: 2,
      title: "Result table",
      purpose: "Mirror the sample report table shape with consumer wording.",
      expectedFields: [
        { key: "item", label: "Drug or supplement", description: "The medicine, vitamin, or supplement row.", type: "string", required: true },
        { key: "geneticAnalysis", label: "Result Of Genetic Analysis", description: "Plain-English result statement.", type: "string", required: true },
        { key: "genes", label: "Gene(s)", description: "Genes or variants used for the row.", type: "string[]", required: true },
        { key: "sourceIds", label: "Source", description: "Reference IDs or FDA/article label if exact citation is unavailable.", type: "string[]", required: true },
      ],
    },
    {
      sortOrder: 3,
      title: "Practical next steps",
      purpose: "Give safe, non-diagnostic actions for a general customer.",
      expectedFields: [
        { key: "guidance", label: "Guidance", description: "Lifestyle or clinician-discussion suggestions.", type: "string[]", required: true },
      ],
    },
    {
      sortOrder: 4,
      title: "Appendix",
      purpose: "Keep probabilities, uncertainty, glossary, genotype summary, and missing data outside the deterministic main result.",
      expectedFields: [
        { key: "genotypeSummary", label: "Genotype summary", description: "Observed alleles or unavailable markers.", type: "object[]", required: true },
        { key: "probabilities", label: "Probabilities", description: "Probability and confidence notes.", type: "object[]", required: true },
        { key: "limitations", label: "Limitations", description: "Known limits and missing evidence.", type: "string[]", required: true },
      ],
    },
  ],
};

const observedCatalog: Array<[string, string]> = [
  ["Next-Gen Disease Screen", "Health"],
  ["Genome Explorer v3", "Sequencing Apps"],
  ["Health Scan", "Health"],
  ["AI Reports", "Sequencing Apps"],
  ["Mental Health Genetic Guide", "Health"],
  ["Heart Health Genetic Guide", "Health"],
  ["Oncology Genetic Guide", "Health"],
  ["Detox Pathway", "Wellness"],
  ["Chronic Fatigue DNA Health Report", "Wellness"],
  ["Personalized Vitamins and Supplements", "Nutrition"],
  ["StrateGene", "Wellness"],
  ["My Heart Health", "Health"],
  ["Ozempic and GLP-1 Agonists", "Medication"],
  ["Chronic Pain DNA Report", "Health"],
  ["Respiratory Health DNA Report", "Health"],
  ["Healthy Weight", "Fitness"],
  ["Medications PGx: Complete DNA Guide", "Medication"],
  ["My Personality Traits", "Traits"],
  ["Female Sexual and Reproductive Health", "Health"],
  ["Gut Health", "Wellness"],
  ["Cardiovascular Health", "Health"],
  ["Carrier Status", "Family Planning"],
  ["Alzheimer's Risk APOE Gene Analysis", "Health"],
  ["Medication and Drug Response", "Medication"],
  ["Arthritis Prevention", "Health"],
  ["Cannabis DNA Health Report", "Medication"],
  ["Healthcare Pro", "Professional"],
  ["Wellness and Longevity", "Wellness"],
  ["TBG Total Wellness", "Wellness"],
  ["Prevent Sudden Death", "Health"],
  ["Disease Risk Genetic Test Report", "Health"],
  ["Complete Genome Analysis", "Sequencing Apps"],
  ["Enhanced Longevity", "Wellness"],
  ["Inflammation And Immunity", "Health"],
  ["Sleep DNA Wellness", "Wellness"],
  ["MTHFR DNA Wellness Report", "Wellness"],
  ["Cognitive Function", "Traits"],
  ["Promethease", "Sequencing Apps"],
  ["Genetic Ancestry with Haplogroups", "Ancestry"],
  ["Mosaic Biodata", "Sequencing Apps"],
  ["Food Sensitivity", "Nutrition"],
  ["Nourish", "Nutrition"],
  ["DNA Diet", "Nutrition"],
  ["Fitness DNA Test Report", "Fitness"],
  ["RunDNA", "Fitness"],
  ["Skin Genes", "Traits"],
  ["Clinical Annotator of Variants", "Sequencing Apps"],
  ["Variant Effect Predictor", "Bioinformatics"],
  ["Short Read Mapper", "Sequencing Apps"],
  ["Skin and Beauty DNA Report", "Traits"],
  ["Musculoskeletal DNA Report", "Fitness"],
  ["Methylation Pathway", "Wellness"],
  ["Dysautonomia", "Health"],
  ["Connective Tissue Disorders and EDS", "Health"],
  ["Brain Health", "Health"],
  ["Cancer Risk", "Health"],
  ["Autoimmune Disorders", "Health"],
  ["Immune System Health", "Health"],
  ["Endocrine Health", "Health"],
  ["Respiratory Health", "Health"],
  ["Pediatric Health", "Health"],
  ["Digestive Disorders and Gut Health", "Health"],
  ["EvE Premium", "Bioinformatics"],
  ["Imputation Analysis", "Bioinformatics"],
  ["Variant Discovery", "Bioinformatics"],
  ["Genetic Counseling", "Bioinformatics"],
  ["Sequencing Depth and Coverage", "Bioinformatics"],
  ["Comprehensive Health Screen WGS Bundle", "DNA Test Kit Bundles"],
  ["Expedited Advanced Health Screen WGS Bundle", "DNA Test Kit Bundles"],
  ["Ultra Rapid Professional Health Screen WGS Bundle", "DNA Test Kit Bundles"],
];

const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const authenticatedCardOverrides: Record<
  string,
  { provider: string; visibleFields: string[]; notes: string[] }
> = {
  "next-gen-disease-screen": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: Free", "CTA: Get App", "Developed by Sequencing.com"],
    notes: ["Authenticated first fold showed this Sequencing Apps card as Free with Get App CTA."],
  },
  "genome-explorer-v3": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: Free", "CTA: Get App", "Developed by Sequencing.com"],
    notes: ["Authenticated first fold showed this Sequencing Apps card as Free with Get App CTA."],
  },
  "health-scan": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: included with Premium & Pro", "CTA: Get App", "Developed by Sequencing.com"],
    notes: ["Authenticated first fold showed this Sequencing Apps card as included with Premium & Pro."],
  },
  "ai-reports": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: included with Premium & Pro", "CTA: Get Report", "Developed by Sequencing.com"],
    notes: ["Authenticated first fold showed this Sequencing Apps card as included with Premium & Pro and Get Report CTA."],
  },
  "heart-health-genetic-guide": {
    provider: "Quantum Genomics | Golden Gate Gene",
    visibleFields: ["Marketplace card: $79", "CTA: Get Report", "Developed by Quantum Genomics | Golden Gate Gene"],
    notes: ["Authenticated first fold showed this Health card with $79 price and Get Report CTA."],
  },
  "oncology-genetic-guide": {
    provider: "Quantum Genomics | Golden Gate Gene",
    visibleFields: ["Marketplace card: $79", "CTA: Get Report", "Developed by Quantum Genomics | Golden Gate Gene"],
    notes: ["Authenticated first fold showed this Health card with $79 price and Get Report CTA."],
  },
  "eve-premium": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: $19.99", "CTA: Get App", "Developed by Sequencing.com"],
    notes: ["Authenticated page 3 screenshot showed this Bioinformatics card with $19.99 price and Get App CTA."],
  },
  "imputation-analysis": {
    provider: "GeneX",
    visibleFields: ["Marketplace card: $9.99", "CTA: Get App", "Developed by GeneX"],
    notes: ["Authenticated page 3 screenshot showed this Bioinformatics card with $9.99 price and Get App CTA."],
  },
  "variant-discovery": {
    provider: "GeneX",
    visibleFields: ["Marketplace card: $19", "CTA: Get App", "Developed by GeneX"],
    notes: ["Authenticated page 3 screenshot showed this Bioinformatics card with $19 price and Get App CTA."],
  },
  "variant-effect-predictor": {
    provider: "GeneX",
    visibleFields: ["Marketplace card: $19.99", "CTA: Get App", "Developed by GeneX"],
    notes: ["Authenticated page 3 screenshot showed this Bioinformatics card with $19.99 price and Get App CTA."],
  },
  "genetic-counseling": {
    provider: "DNAVisit",
    visibleFields: ["Marketplace card: $179", "CTA: Get App", "Developed by DNAVisit"],
    notes: ["Authenticated page 3 screenshot showed this Bioinformatics card with $179 price and Get App CTA."],
  },
  "sequencing-depth-and-coverage": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: $9.99", "CTA: Get App", "Developed by Sequencing.com"],
    notes: ["Authenticated page 3 screenshot showed this Bioinformatics card with $9.99 price and Get App CTA."],
  },
  "comprehensive-health-screen-wgs-bundle": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: $399", "CTA: View Bundle", "Developed by Sequencing.com"],
    notes: ["Authenticated page 3 screenshot showed this DNA Test Kit Bundles card with $399 price and View Bundle CTA."],
  },
  "expedited-advanced-health-screen-wgs-bundle": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: $499", "CTA: View Bundle", "Developed by Sequencing.com"],
    notes: ["Authenticated page 3 screenshot showed this DNA Test Kit Bundles card with $499 price and View Bundle CTA."],
  },
  "ultra-rapid-professional-health-screen-wgs-bundle": {
    provider: "Sequencing.com",
    visibleFields: ["Marketplace card: $799", "CTA: View Bundle", "Developed by Sequencing.com"],
    notes: ["Authenticated page 3 screenshot showed this DNA Test Kit Bundles card with $799 price and View Bundle CTA."],
  },
};

const claimScopeForCategory = (category: string) => {
  if (category === "Medication") return "pharmacogenomics";
  if (category === "Health") return "medical-risk";
  if (category === "Bioinformatics") return "genome-analysis-tool";
  if (category === "DNA Test Kit Bundles") return "test-kit-bundle";
  if (category === "Sequencing Apps") return "sequencing-app";
  return "wellness";
};

const makeBacklogReport = ([title, category]: [string, string]): ReportPackageSeed => ({
  slug: slugify(title),
  title,
  subtitle: "Marketplace report observed; extraction pending",
  category,
  provider: authenticatedCardOverrides[slugify(title)]?.provider ?? "Sequencing.com",
  version: "0.1.0",
  status: "catalog-observed",
  summary:
    "Name and category were observed from public Sequencing.com marketplace-related evidence. Full mock report extraction is pending.",
  detail:
    "This entry is a scaffold for full report-package curation. The direct marketplace is sign-in gated, so this package currently stores observed catalog identity and awaits authenticated detail/sample extraction.",
  audience: "general consumer",
  claimScope: claimScopeForCategory(category),
  sourceUrl: sourceUrls.appAggregate,
  marketplaceUrl: `${sourceUrls.marketplace}/${slugify(title)}`,
  curationStatus: "direct",
  sampleReportStatus: "Catalog name observed; mock report not yet extracted.",
  sourceArtifacts: [sourceUrls.appAggregate, sourceUrls.marketplace, "output/browser/sequencing-marketplace-auth.png"],
  curationCompleteness: {
    catalog: true,
    detail: false,
    sampleReport: false,
    references: false,
    localFixture: false,
    notes: [
      "Catalog identity observed; detail page/sample report extraction is still pending.",
      ...(authenticatedCardOverrides[slugify(title)]?.notes ?? []),
    ],
  },
  tags: [category.toLowerCase(), "catalog-backlog"],
  visibleFields: [
    "Report/app name",
    "Category",
    "Marketplace identity",
    ...(authenticatedCardOverrides[slugify(title)]?.visibleFields ?? []),
  ],
  genomeInputs: [],
  references: sharedReferences,
  prompt: {
    title: `${title} local-agent prompt placeholder`,
    deterministicPrompt: [
      `Generate a plain-English ${title} report from local genome-derived evidence and supplied references.`,
      "Use only provided evidence and references. Do not invent genes, variants, scores, studies, or conclusions.",
      "Write deterministic report content first. Put probability, confidence, missing data, and uncertainty in the appendix.",
      "If authenticated Sequencing.com mock-report sections are provided, preserve those sections and output all visible information.",
      "Return valid JSON matching the output contract.",
    ].join("\\n"),
    inputContract: ["reportPurpose", "referenceResources[]", "genomeEvidence[]", "mockReportSections[] if available"],
    outputContract: ["overview", "findings[]", "references", "appendix.probabilities", "appendix.uncertaintyNotes"],
    appendixPolicy: "Probability and uncertainty must appear after deterministic sections.",
    probabilityDisclosure: "Do not quantify probability unless calibrated evidence is supplied.",
    safetyNotes: ["Educational report only.", "Medical-risk or medication claims require professional review."],
    extractionStatus: "inferred",
  },
  sampleRows: [],
  genotypeSummary: [],
  localTestFixture: null,
  outputSections: [
    {
      sortOrder: 1,
      title: "Report overview",
      purpose: "Summarize report purpose and data availability.",
      expectedFields: [
        { key: "summary", label: "Summary", description: "Consumer-friendly overview.", type: "string", required: true },
      ],
    },
    {
      sortOrder: 2,
      title: "Findings",
      purpose: "Structured findings derived from local evidence.",
      expectedFields: [
        { key: "findings", label: "Findings", description: "Trait, gene, result, evidence, and guidance rows.", type: "object[]", required: true },
      ],
    },
    {
      sortOrder: 3,
      title: "Appendix",
      purpose: "Probability, uncertainty, and missing data notes.",
      expectedFields: [
        { key: "limitations", label: "Limitations", description: "Missing inputs and uncertainty.", type: "string[]", required: true },
      ],
    },
  ],
});

export const seedReportPackages: ReportPackageSeed[] = [
  wellnessGeneticGuide,
  ...observedCatalog
    .filter(([title]) => slugify(title) !== wellnessGeneticGuide.slug)
    .map(makeBacklogReport),
];
