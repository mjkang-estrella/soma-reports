import type { ReportPackage } from "../lib/types";

type ReportDetailProps = {
  report: ReportPackage | null | undefined;
};

export function ReportDetail({ report }: ReportDetailProps) {
  if (report === undefined) {
    return (
      <section className="theme-light detail-wrapper container" aria-busy="true">
        <div className="empty-state">Loading report package...</div>
      </section>
    );
  }

  if (report === null) {
    return (
      <section className="theme-light detail-wrapper container">
        <div className="empty-state">Select a report package to inspect its prompt and output schema.</div>
      </section>
    );
  }

  const copyPrompt = async () => {
    if (!report.prompt) {
      return;
    }
    await navigator.clipboard.writeText(report.prompt.deterministicPrompt);
  };

  const copyFixture = async () => {
    if (!report.localTestFixture) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(report.localTestFixture, null, 2));
  };

  return (
    <section className="theme-light detail-wrapper container">
      <div className="detail-grid">
        <aside className="detail-sidebar">
          <div className="filter-group">
            <div className="filter-group-header">
              <span className="eyebrow">Selected report</span>
              <span className="meta-text">04.</span>
            </div>
            <h2>{report.title}</h2>
            <p className="body-text">{report.subtitle}</p>
            <dl className="meta-list">
              <div>
                <dt>Claim scope</dt>
                <dd>{report.claimScope}</dd>
              </div>
              <div>
                <dt>Curation</dt>
                <dd>{report.curationStatus}</dd>
              </div>
              <div>
                <dt>Sample status</dt>
                <dd>{report.sampleReportStatus}</dd>
              </div>
            </dl>
            <a className="btn btn-outline wide" href={report.sourceUrl} target="_blank" rel="noreferrer">
              Source
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          </div>
        </aside>

        <div className="detail-content">
          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Purpose</span>
              <span className="meta-text">{report.status}</span>
            </div>
            <p>{report.detail}</p>
            <div className="tag-row">
              {report.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </section>

          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Visible report fields</span>
              <span className="meta-text">{report.visibleFields.length} fields</span>
            </div>
            <ul className="columns-list">
              {report.visibleFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </section>

          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Extraction completeness</span>
              <span className="meta-text">{report.sourceArtifacts.length} artifacts</span>
            </div>
            <div className="status-grid">
              {Object.entries(report.curationCompleteness)
                .filter(([key]) => key !== "notes")
                .map(([key, value]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <strong>{value ? "Done" : "Pending"}</strong>
                  </div>
                ))}
            </div>
            <ul className="columns-list">
              {report.curationCompleteness.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Genome inputs</span>
              <span className="meta-text">{report.genomeInputs.length} inputs</span>
            </div>
            {report.genomeInputs.length > 0 ? (
              <div className="table-like">
                {report.genomeInputs.map((input) => (
                  <div key={input.id} className="table-row">
                    <span>{input.label}</span>
                    <span>{input.kind}</span>
                    <span>{input.missingDataBehavior}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Inputs are pending authenticated mock-report extraction.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Mock report rows</span>
              <span className="meta-text">{report.sampleRows.length} rows</span>
            </div>
            {report.sampleRows.length > 0 ? (
              <div className="sample-row-table">
                <div className="sample-row header">
                  <span>Group</span>
                  <span>Item</span>
                  <span>Result Of Genetic Analysis</span>
                  <span>Gene(s)</span>
                  <span>Source</span>
                </div>
                {report.sampleRows.map((row) => (
                  <div key={`${row.sortOrder}-${row.item}`} className="sample-row">
                    <span>{row.groupTitle}</span>
                    <span>
                      <strong>{row.item}</strong>
                      {row.brandName ? <small>{row.brandName}</small> : null}
                    </span>
                    <span>{row.geneticAnalysis}</span>
                    <span>{row.genes.join(", ")}</span>
                    <span>{row.sourceLabel}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Mock report rows are pending extraction.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Genotype summary</span>
              <span className="meta-text">{report.genotypeSummary.length} rows</span>
            </div>
            {report.genotypeSummary.length > 0 ? (
              <div className="sample-row-table genotype-table">
                <div className="sample-row header">
                  <span>Tier</span>
                  <span>Gene</span>
                  <span>Variant ID</span>
                  <span>Genotype</span>
                  <span>Effect / phenotype</span>
                </div>
                {report.genotypeSummary.map((row) => (
                  <div key={`${row.sortOrder}-${row.gene}-${row.variantId}`} className="sample-row">
                    <span>{row.tier}</span>
                    <span>{row.gene}</span>
                    <span>{row.variantId || "-"}</span>
                    <span>{row.genotype}</span>
                    <span>
                      {row.effect}
                      {row.phenotype ? <small>{row.phenotype}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Genotype summary is pending extraction.</p>
            )}
          </section>

          <section className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Local run fixture</span>
              <button className="btn btn-primary" type="button" onClick={copyFixture} disabled={!report.localTestFixture}>
                Copy fixture
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            {report.localTestFixture ? (
              <>
                <p className="body-text">
                  Synthetic derived evidence only. This fixture is for testing prompt/output behavior
                  without putting raw genome files into Convex.
                </p>
                <pre className="fixture-block">{JSON.stringify(report.localTestFixture, null, 2)}</pre>
              </>
            ) : (
              <p className="body-text">Local run fixture is pending for this report.</p>
            )}
          </section>

          <section id="prompt" className="detail-section prompt-section">
            <div className="detail-section-header">
              <span className="eyebrow">Agent prompt</span>
              <button className="btn btn-primary" type="button" onClick={copyPrompt} disabled={!report.prompt}>
                Copy prompt
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            {report.prompt ? (
              <>
                <pre>{report.prompt.deterministicPrompt}</pre>
                <div className="contract-grid">
                  <ContractList title="Input contract" items={report.prompt.inputContract} />
                  <ContractList title="Output contract" items={report.prompt.outputContract} />
                  <ContractList title="Safety notes" items={report.prompt.safetyNotes} />
                </div>
                <p className="body-text">{report.prompt.appendixPolicy}</p>
              </>
            ) : (
              <p className="body-text">Prompt package is not yet available.</p>
            )}
          </section>

          <section id="schema" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Output format</span>
              <span className="meta-text">{report.outputSections.length} sections</span>
            </div>
            <div className="schema-list">
              {report.outputSections.map((section) => (
                <div key={section.title} className="schema-section">
                  <div className="schema-title">
                    <span>{String(section.sortOrder).padStart(2, "0")}.</span>
                    <h3>{section.title}</h3>
                  </div>
                  <p>{section.purpose}</p>
                  <ul>
                    {section.expectedFields.map((field) => (
                      <li key={field.key}>
                        <strong>{field.label}</strong>
                        <span>{field.type}</span>
                        <p>{field.description}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section id="references" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Reference resources</span>
              <span className="meta-text">{report.references.length} resources</span>
            </div>
            <div className="references-list">
              {report.references.map((reference) => (
                <a key={`${reference.title}-${reference.url}`} href={reference.url} target="_blank" rel="noreferrer">
                  <span className="eyebrow">{reference.sourceType}</span>
                  <strong>{reference.title}</strong>
                  <p>{reference.note}</p>
                  <small>
                    {reference.theme} - {reference.evidenceLevel} - {reference.extractionStatus}
                  </small>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function ContractList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
