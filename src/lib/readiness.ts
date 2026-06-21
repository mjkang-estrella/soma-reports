import type { CurationCompleteness, ReportSummary } from "./types";

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
  { key: "sampleReport", label: "Sample report", pendingLabel: "Sample pending", weight: 2 },
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
