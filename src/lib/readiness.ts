import type { CurationCompleteness, ReadinessAuditRow, ReportSummary } from "./types";

export type CurationReadinessKey = Exclude<keyof CurationCompleteness, "notes">;

export type CurationReadinessItem = {
  key: CurationReadinessKey;
  label: string;
  pendingLabel: string;
  weight: number;
};

export const CURATION_READINESS_ITEMS: CurationReadinessItem[] = [
  { key: "catalog", label: "Catalog identity", pendingLabel: "Catalog missing", weight: 1 },
  { key: "detail", label: "Detail page", pendingLabel: "Detail pending", weight: 1 },
  { key: "references", label: "Background refs", pendingLabel: "Refs pending", weight: 1 },
  { key: "sampleReport", label: "Sample rows", pendingLabel: "Sample rows pending", weight: 2 },
  { key: "prompt", label: "Agent prompt", pendingLabel: "Prompt pending", weight: 2 },
  { key: "outputFormat", label: "Output schema", pendingLabel: "Schema pending", weight: 2 },
  { key: "formalFields", label: "Formal map", pendingLabel: "Formal pending", weight: 2 },
  { key: "localFixture", label: "Local fixture", pendingLabel: "Fixture pending", weight: 2 },
  { key: "citationBindings", label: "Row citations", pendingLabel: "Row citations pending", weight: 3 },
];

export const CARD_READINESS_KEYS: CurationReadinessKey[] = [
  "catalog",
  "references",
  "sampleReport",
  "prompt",
  "outputFormat",
  "formalFields",
  "localFixture",
  "citationBindings",
];

export const getCurationReadinessItem = (key: CurationReadinessKey) =>
  CURATION_READINESS_ITEMS.find((item) => item.key === key);

export const readinessScore = (report: Pick<ReportSummary, "curationCompleteness">) =>
  CURATION_READINESS_ITEMS.reduce((score, item) => {
    return report.curationCompleteness[item.key] ? score + item.weight : score;
  }, 0);

export type AgentReadinessKind =
  | "loading"
  | "identity-gap"
  | "formal-equivalent"
  | "sample-backed-formal"
  | "local-scaffold"
  | "evidence-pending";

export type AgentEvidenceStatus =
  | "formal-equivalent"
  | "sample-backed-formal"
  | "local-scaffold"
  | "evidence-pending";

export type AgentReadinessState = {
  kind: AgentReadinessKind;
  evidenceStatus: AgentEvidenceStatus;
  label: string;
  packageStateLabels: string[];
  formalEquivalentReady: boolean;
  sampleBackedFormalReady: boolean;
  localScaffoldOnly: boolean;
  identityGap: boolean;
  loading: boolean;
  usageBoundary: string;
};

export type LocalAgentEvidenceChip = {
  key:
    | "references"
    | "prompt"
    | "fixture"
    | "result"
    | "plainEnglish"
    | "appendixProbability"
    | "scaffoldBoundary";
  label: string;
  status: "ready" | "pending" | "neutral";
};

export const ALL_PACKAGE_STATES = "All";

const hasLocalScaffoldEvidence = (readiness: ReadinessAuditRow) =>
  readiness.status !== "authenticated-gap" &&
  readiness.evidence.references > 0 &&
  readiness.evidence.prompt &&
  readiness.evidence.localFixture &&
  readiness.evidence.outputSections > 0 &&
  !readiness.sampleBackedFormalReady;

const labelForKind = (kind: AgentReadinessKind) => {
  switch (kind) {
    case "loading":
      return "Loading readiness";
    case "identity-gap":
      return "Identity gap";
    case "formal-equivalent":
      return "Full parity";
    case "sample-backed-formal":
      return "Sample-backed formal";
    case "local-scaffold":
      return "Local scaffold";
    case "evidence-pending":
      return "Evidence pending";
  }
};

const usageBoundaryForKind = (kind: AgentReadinessKind) => {
  switch (kind) {
    case "formal-equivalent":
      return "Use as formal-equivalent local-agent report structure with source bindings, deterministic output, and appendix-only probability disclosure.";
    case "sample-backed-formal":
      return "Use as sample-backed local-agent report structure while preserving source bindings and appendix-only probability disclosure.";
    case "local-scaffold":
      return "Use as local prompt, fixture, references, and deterministic output schema only; do not treat as source-backed Sequencing.com formal sample evidence.";
    case "identity-gap":
      return "Do not use as a report package until non-duplicate marketplace identity evidence is captured.";
    case "loading":
      return "Readiness audit is loading; do not classify this package for local-agent execution yet.";
    case "evidence-pending":
      return "Use for catalog and research review only; local-agent execution still needs prompt, fixture, schema, and formal evidence.";
  }
};

const packageLabelsForState = (kind: AgentReadinessKind, readiness?: ReadinessAuditRow | null) => {
  const labels = [ALL_PACKAGE_STATES];

  if (kind === "formal-equivalent") {
    labels.push("Full parity", "Sample-backed formal");
  }
  if (kind === "sample-backed-formal") {
    labels.push("Sample-backed formal", "Detail gap");
  }
  if (kind === "local-scaffold") {
    labels.push("Local scaffold", "Needs formal evidence");
  }
  if (kind === "identity-gap") {
    labels.push("Needs identity evidence");
  }
  if (kind === "evidence-pending") {
    labels.push("Needs formal evidence");
  }
  if (readiness && readiness.status !== "authenticated-gap" && readiness.evidence.sampleRows === 0) {
    labels.push("Sample-row backlog");
  }

  return [...new Set(labels)];
};

export const deriveAgentReadinessState = (
  report: ReportSummary,
  readiness?: ReadinessAuditRow | null,
): AgentReadinessState => {
  const kind: AgentReadinessKind =
    readiness === undefined
      ? "loading"
      : readiness === null
        ? "evidence-pending"
        : readiness.status === "authenticated-gap"
        ? "identity-gap"
        : readiness.formalEquivalentReady
          ? "formal-equivalent"
          : readiness.sampleBackedFormalReady
            ? "sample-backed-formal"
            : hasLocalScaffoldEvidence(readiness)
              ? "local-scaffold"
              : "evidence-pending";
  const evidenceStatus: AgentEvidenceStatus =
    kind === "formal-equivalent" || kind === "sample-backed-formal" || kind === "local-scaffold"
      ? kind
      : "evidence-pending";

  return {
    kind,
    evidenceStatus,
    label: labelForKind(kind),
    packageStateLabels: packageLabelsForState(kind, readiness),
    formalEquivalentReady: kind === "formal-equivalent",
    sampleBackedFormalReady: kind === "formal-equivalent" || kind === "sample-backed-formal",
    localScaffoldOnly: kind === "local-scaffold",
    identityGap: kind === "identity-gap",
    loading: kind === "loading",
    usageBoundary: usageBoundaryForKind(kind),
  };
};

export const localAgentEvidenceChipsFor = (
  readiness: ReadinessAuditRow | null | undefined,
  hasDeterministicResult: boolean,
  readinessState: AgentReadinessState,
): LocalAgentEvidenceChip[] => {
  const references = readiness?.evidence.references ?? 0;
  const promptReady = Boolean(readiness?.evidence.prompt);
  const fixtureReady = Boolean(readiness?.evidence.localFixture);
  const schemaReady = (readiness?.evidence.outputSections ?? 0) > 0;
  const plainEnglishGuardReady = promptReady && schemaReady;
  const appendixProbabilityGuardReady = promptReady && hasDeterministicResult;

  return [
    {
      key: "references",
      label: references > 0 ? `Refs ${references}` : "Refs pending",
      status: references > 0 ? "ready" : "pending",
    },
    {
      key: "prompt",
      label: promptReady ? "Prompt artifact" : "Prompt pending",
      status: promptReady ? "ready" : "pending",
    },
    {
      key: "fixture",
      label: fixtureReady ? "Fixture artifact" : "Fixture pending",
      status: fixtureReady ? "ready" : "pending",
    },
    {
      key: "result",
      label: hasDeterministicResult ? "Deterministic result JSON" : "Result JSON pending",
      status: hasDeterministicResult ? "ready" : "pending",
    },
    {
      key: "plainEnglish",
      label: plainEnglishGuardReady ? "Plain-English guard" : "Plain-English pending",
      status: plainEnglishGuardReady ? "ready" : "pending",
    },
    {
      key: "appendixProbability",
      label: appendixProbabilityGuardReady ? "Appendix probability guard" : "Appendix guard pending",
      status: appendixProbabilityGuardReady ? "ready" : "pending",
    },
    {
      key: "scaffoldBoundary",
      label: readinessState.localScaffoldOnly ? "Scaffold-only local" : "Source-backed local",
      status: readinessState.localScaffoldOnly ? "neutral" : readinessState.sampleBackedFormalReady ? "ready" : "pending",
    },
  ];
};
