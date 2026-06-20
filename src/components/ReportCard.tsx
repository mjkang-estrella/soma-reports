import type { ReportSummary } from "../lib/types";

type ReportCardProps = {
  report: ReportSummary;
  isSelected: boolean;
  onSelect: () => void;
};

export function ReportCard({ report, isSelected, onSelect }: ReportCardProps) {
  return (
    <button className={isSelected ? "report-card selected" : "report-card"} type="button" onClick={onSelect}>
      <div className="report-card-header">
        <div className="report-card-meta-top">
          <span className="eyebrow">{report.category}</span>
          <span className="meta-text">{report.version}</span>
        </div>
        <h3 className="text-h3">{report.title}</h3>
      </div>
      <p className="report-card-desc body-text">{report.summary}</p>
      <div className="report-card-footer">
        <div className="provider-tag">
          <span className="provider-avatar" aria-hidden="true" />
          {report.provider}
        </div>
        <span className="btn btn-primary inline-cta">
          Inspect
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </button>
  );
}
