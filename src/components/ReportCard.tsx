import { CARD_READINESS_KEYS, deriveAgentReadinessState, getCurationReadinessItem } from "../lib/readiness";
import {
  officialEvidenceTierFor,
  officialEvidenceTierLabelFor,
  officialOutputNextEvidenceFor,
} from "../lib/formalEvidenceBacklog";
import type { FormalEvidenceTarget, OfficialOutputCaptureStatusRow } from "../lib/formalEvidenceBacklog";
import type { ReadinessAuditRow, ReportSummary } from "../lib/types";

type OfficialOutputCaptureStage = OfficialOutputCaptureStatusRow["stage"];

type ReportCardProps = {
  report: ReportSummary;
  readiness?: ReadinessAuditRow | null;
  officialOutputCaptureStage?: OfficialOutputCaptureStage | null;
  officialOutputCaptureTarget?: FormalEvidenceTarget | null;
  isSelected: boolean;
  onSelect: () => void;
};

const captureStageClass = (stage: OfficialOutputCaptureStage | null | undefined) =>
  stage ? `evidence-status evidence-status-${stage}` : "evidence-status evidence-status-loading";
const formatCaptureStageLabel = (stage: OfficialOutputCaptureStage | null | undefined) =>
  stage ? stage.replace(/[-_]/g, " ") : "status missing";

export function ReportCard({
  report,
  readiness,
  officialOutputCaptureStage,
  officialOutputCaptureTarget,
  isSelected,
  onSelect,
}: ReportCardProps) {
  const readinessState = deriveAgentReadinessState(report, readiness);
  const hasOfficialOutputCaptureStage = officialOutputCaptureStage !== undefined;
  const officialOutputAction =
    officialOutputCaptureTarget?.captureStatus?.nextAction ??
    officialOutputCaptureTarget?.firstRequiredEvidence ??
    null;
  const captureNextEvidence = officialOutputNextEvidenceFor(officialOutputCaptureTarget?.captureStatus);
  const officialOutputEvidenceNeeded = officialOutputCaptureTarget
    ? captureNextEvidence.length > 0
      ? captureNextEvidence
      : [officialOutputCaptureTarget.firstRequiredEvidence]
    : [];
  const officialOutputCommand =
    officialOutputCaptureTarget?.captureStatus?.nextCommand ??
    officialOutputCaptureTarget?.redactionTemplateCommand ??
    null;
  const officialEvidenceTier = officialEvidenceTierFor(officialOutputCaptureTarget?.captureStatus);
  const officialEvidenceTierLabel = officialEvidenceTierLabelFor(officialOutputCaptureTarget?.captureStatus);
  const officialEvidenceTierDetail =
    officialEvidenceTier === "official-boundary-modeled"
      ? `${officialOutputCaptureTarget?.captureStatus?.officialBoundaryModeledFields ?? 0} official fields/scope signals; no source rows.`
      : officialEvidenceTier === "official-metadata-only"
        ? "Product and route metadata only; no official output fields or rows."
        : "Official output rows still pending.";
  const combinedGaps = readiness
    ? [...new Set([...readiness.declaredGaps, ...readiness.formalReportDeclaredGaps, ...readiness.derivedGaps])]
    : [];
  const gapCount = combinedGaps.length;
  const gapLabels = combinedGaps.map((gap) => gap.replaceAll("_", " ").replaceAll("-", " "));
  const evidenceItems = readiness
    ? [
        `Refs ${readiness.evidence.references}`,
        readiness.evidence.prompt ? "Prompt ready" : "Prompt pending",
        `Schema ${readiness.evidence.outputSections}`,
        `Sample rows ${readiness.evidence.sampleRows}`,
        `Formal fields ${readiness.evidence.formalFields}`,
        `Citations ${readiness.evidence.exactCitationRows}`,
      ]
    : [];
  const localRunAction = readinessState.sampleBackedFormalReady
    ? {
        label: "Run locally",
        className: "local-run-ready",
        detail: readinessState.formalEquivalentReady
          ? "Formal-equivalent package with source-bound rows, prompt, schema, and local evidence workflow."
          : "Source-backed package with prompt, schema, sample rows, citations, and local evidence workflow.",
      }
    : readinessState.localScaffoldOnly
      ? {
          label: "Scaffold run only",
          className: "local-run-scaffold",
          detail: "Prompt, references, schema, and fixture exist; official sample rows and citations are still pending.",
        }
      : {
          label: "Needs evidence",
          className: "local-run-pending",
          detail: "Inspect the package before local execution; required prompt, schema, or evidence is incomplete.",
        };

  return (
    <button className={isSelected ? "report-card selected" : "report-card"} type="button" onClick={onSelect}>
      <div className="report-card-header">
        <div className="report-card-meta-top">
          <span className="eyebrow">{report.category}</span>
          <span className={`evidence-status evidence-status-${readinessState.kind}`}>{readinessState.label}</span>
        </div>
        <h3 className="text-h3">{report.title}</h3>
        <span className="meta-text">{report.version}</span>
      </div>
      <p className="report-card-desc body-text">{report.summary}</p>
      {readiness || hasOfficialOutputCaptureStage ? (
        <div className="strict-readiness-row" aria-label="Formal readiness">
          {readiness ? (
            <>
              <span className={readiness.formalEquivalentReady ? "ready" : "pending"}>
                {readiness.formalEquivalentReady ? "Full parity" : "No formal parity"}
              </span>
              <span className={readiness.sampleBackedFormalReady ? "ready" : "pending"}>
                {readiness.sampleBackedFormalReady ? "Sample-backed" : "No source rows"}
              </span>
              <span className={readiness.evidence.exactCitationRows > 0 ? "ready" : "neutral"}>
                {readiness.evidence.exactCitationRows} exact rows
              </span>
              <span className={gapCount === 0 ? "ready" : "pending"}>{gapCount} gaps</span>
            </>
          ) : null}
          {hasOfficialOutputCaptureStage ? (
            <span className={captureStageClass(officialOutputCaptureStage)}>
              Output {formatCaptureStageLabel(officialOutputCaptureStage)}
            </span>
          ) : null}
        </div>
      ) : null}
      {readiness ? (
        <div className="card-evidence-strip" aria-label="Evidence coverage">
          {evidenceItems.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {gapLabels.length > 0 ? (
        <p className="card-blockers">
          Blocks: {gapLabels.slice(0, 4).join(", ")}
          {gapLabels.length > 4 ? `, +${gapLabels.length - 4} more` : ""}
        </p>
      ) : null}
      {readinessState.localScaffoldOnly ? (
        <p className="card-blockers">
          Local scaffold only: synthetic fixture/schema; not a Sequencing.com sample output.
        </p>
      ) : null}
      <div className={`local-run-strip ${localRunAction.className}`} aria-label="Local run readiness">
        <strong>{localRunAction.label}</strong>
        <span>{localRunAction.detail}</span>
      </div>
      {officialOutputCaptureTarget ? (
        <div className="card-official-action" aria-label="Official output blocker action">
          <strong>Official output blocker</strong>
          <span className={`evidence-status evidence-status-${officialEvidenceTier}`}>
            {officialEvidenceTierLabel}
          </span>
          <span>{officialEvidenceTierDetail}</span>
          {officialOutputEvidenceNeeded[0] ? <span>Evidence needed: {officialOutputEvidenceNeeded[0]}</span> : null}
          <span>{officialOutputAction}</span>
          {officialOutputCommand ? <code>{officialOutputCommand}</code> : null}
        </div>
      ) : null}
      <div className="readiness-row" aria-label="Curation readiness">
        {CARD_READINESS_KEYS.map((key) => {
          const item = getCurationReadinessItem(key);
          const ready = Boolean(report.curationCompleteness[key]);
          return (
            <span key={key} className={ready ? "ready" : "pending"}>
              {ready ? item?.label : item?.pendingLabel}
            </span>
          );
        })}
      </div>
      <div className="report-card-footer">
        <div className="provider-tag">
          <span className="provider-avatar" aria-hidden="true" />
          {report.provider}
        </div>
        {report.priceLabel ? <span className="price-pill">{report.priceLabel}</span> : null}
        <span className="btn btn-primary inline-cta">
          {localRunAction.label}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </button>
  );
}
