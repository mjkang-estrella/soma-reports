import { CURATION_READINESS_ITEMS } from "../lib/readiness";
import type { ReportPackage } from "../lib/types";

type ReportDetailProps = {
  report: ReportPackage | null | undefined;
};

const FORMAL_FIELD_STATUS_META: Record<
  ReportPackage["formalFields"][number]["status"],
  { className: string; label: string }
> = {
  covered: { className: "ready", label: "Mapped" },
  pending: { className: "pending", label: "Unmapped" },
  not_applicable: { className: "neutral", label: "N/A" },
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

  const promptReady = Boolean(report.prompt && report.curationCompleteness.prompt);
  const localFixture = report.localTestFixture;
  const expectedAssertions = localFixture?.expectedAssertions;
  const referenceProvenance = report.references.filter(
    (reference) => reference.sourceArtifact || reference.accessedAt || reference.contentHash,
  );
  const runSafeguards = [
    {
      label: "Audience",
      value: report.audience || "general customer",
    },
    {
      label: "Consumer tone",
      value: localFixture?.consumerTone ?? "plain English required by prompt",
    },
    {
      label: "Raw genome",
      value: localFixture?.inputManifest.rawGenomeReturned === false ? "not returned" : "not yet verified",
    },
    {
      label: "Probability",
      value: expectedAssertions?.probabilitiesOnlyInAppendix ? "appendix only" : "review appendix policy",
    },
    {
      label: "Citation policy",
      value: expectedAssertions?.everyFindingHasReference ? "every finding cited" : "citation review pending",
    },
  ];
  const localAgentInput =
    report.prompt && localFixture && report.curationCompleteness.prompt
      ? {
          schemaVersion: "soma-reports.local-agent-input.v1",
          reportSlug: report.slug,
          reportTitle: report.title,
          reportPurpose: localFixture.reportPurpose ?? report.summary,
          prompt: report.prompt.deterministicPrompt,
          promptMetadata: {
            title: report.prompt.title,
            promptVersion: report.prompt.promptVersion ?? null,
            promptHash: report.prompt.promptHash ?? null,
            outputFormatHash: report.prompt.outputFormatHash ?? null,
            inputContract: report.prompt.inputContract,
            outputContract: report.prompt.outputContract,
            appendixPolicy: report.prompt.appendixPolicy,
            probabilityDisclosure: report.prompt.probabilityDisclosure,
            safetyNotes: report.prompt.safetyNotes,
          },
          privacyBoundary: {
            rawGenomeIncluded: false,
            derivedEvidenceOnly: true,
            uploadRequired: false,
          },
          fixture: {
            ...localFixture,
            packageSlug: localFixture.packageSlug ?? report.slug,
          },
          formalArtifacts: {
            references: report.references,
            outputSections: report.outputSections,
            formalFields: report.formalFields,
            sampleRows: report.sampleRows,
            genotypeSummary: report.genotypeSummary,
            sourceArtifacts: report.sourceArtifacts,
          },
          agentInstructions: [
            "Use the prompt exactly as supplied unless the user explicitly asks for edits.",
            "Use fixture.genomeEvidence, fixture.referenceResources, and formalArtifacts as evidence.",
            "When formalArtifacts.sampleRows are present, preserve their report structure and source bindings.",
            "Return deterministic report JSON first.",
            "Put probability, confidence, and uncertainty in the appendix only.",
            "Do not include raw genome data in output.",
          ],
        }
      : null;

  const copyPrompt = async () => {
    if (!report.prompt || !promptReady) {
      return;
    }
    await navigator.clipboard.writeText(report.prompt.deterministicPrompt);
  };

  const copyFixture = async () => {
    if (!report.localTestFixture) {
      return;
    }
    await navigator.clipboard.writeText(
      JSON.stringify({ ...report.localTestFixture, packageSlug: report.localTestFixture.packageSlug ?? report.slug }, null, 2),
    );
  };

  const copyLocalAgentInput = async () => {
    if (!localAgentInput) {
      return;
    }
    await navigator.clipboard.writeText(JSON.stringify(localAgentInput, null, 2));
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
              {report.priceLabel ? (
                <div>
                  <dt>Marketplace price</dt>
                  <dd>{report.priceLabel}</dd>
                </div>
              ) : null}
              {report.catalogCategories?.length ? (
                <div>
                  <dt>Catalog categories</dt>
                  <dd>{report.catalogCategories.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            <a className="btn btn-outline wide" href={report.sourceUrl} target="_blank" rel="noreferrer">
              Source
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
            <nav className="detail-nav" aria-label="Report detail sections">
              <a href="#visible-fields">Fields</a>
              <a href="#formal-map">Formal map</a>
              <a href="#provenance">Provenance</a>
              <a href="#sample-report">Sample rows</a>
              <a href="#fixture">Fixture</a>
              <a href="#prompt">Prompt</a>
              <a href="#schema">Schema</a>
              <a href="#references">References</a>
            </nav>
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
            <div className="status-grid safeguard-grid" aria-label="Local run safeguards">
              {runSafeguards.map((safeguard) => (
                <div key={safeguard.label}>
                  <span>{safeguard.label}</span>
                  <strong>{safeguard.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section id="visible-fields" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Visible report fields</span>
              <span className="meta-text">{report.visibleFields.length} fields</span>
            </div>
            <ul className="columns-list">
              {report.visibleFields.map((field, index) => (
                <li key={`${index}-${field}`}>{field}</li>
              ))}
            </ul>
          </section>

          <section id="formal-map" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Formal equivalent map</span>
              <span className="meta-text">{report.formalFields.length} fields</span>
            </div>
            {report.formalFields.length > 0 ? (
              <div className="coverage-list">
                {report.formalFields.map((field) => {
                  const status = FORMAL_FIELD_STATUS_META[field.status];
                  return (
                    <div key={`${field.sortOrder}-${field.observedField}`}>
                      <span className={status.className}>{status.label}</span>
                      <strong>{field.observedField}</strong>
                      <small>
                        {field.sourceLabel} {"->"} {field.outputPath}
                      </small>
                      <p>{field.notes}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="body-text">Formal equivalent mapping is pending extraction.</p>
            )}
          </section>

          <section id="curation" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Extraction completeness</span>
              <span className="meta-text">{report.sourceArtifacts.length} artifacts</span>
            </div>
            <div className="status-grid">
              {CURATION_READINESS_ITEMS.map((item) => {
                const value = report.curationCompleteness[item.key];
                return (
                  <div key={item.key}>
                    <span>{item.label}</span>
                    <strong>{value ? "Done" : "Pending"}</strong>
                  </div>
                );
              })}
            </div>
            <ul className="columns-list">
              {report.curationCompleteness.notes.map((note, index) => (
                <li key={`${index}-${note}`}>{note}</li>
              ))}
            </ul>
          </section>

          <section id="provenance" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Evidence provenance</span>
              <span className="meta-text">{report.sourceArtifacts.length} artifacts</span>
            </div>
            <dl className="inline-meta-list">
              <div>
                <dt>Catalog source</dt>
                <dd>{report.catalogSource ?? "not captured"}</dd>
              </div>
              <div>
                <dt>Prompt hash</dt>
                <dd>{report.prompt?.promptHash ?? "pending"}</dd>
              </div>
              <div>
                <dt>Output hash</dt>
                <dd>{report.prompt?.outputFormatHash ?? "pending"}</dd>
              </div>
              <div>
                <dt>Marketplace URL</dt>
                <dd>{report.marketplaceUrl}</dd>
              </div>
            </dl>
            {report.sourceArtifacts.length > 0 ? (
              <ul className="artifact-list">
                {report.sourceArtifacts.map((artifact) => (
                  <li key={artifact}>{artifact}</li>
                ))}
              </ul>
            ) : (
              <p className="body-text">Source artifacts are pending for this report.</p>
            )}
            {referenceProvenance.length > 0 ? (
              <div className="provenance-list">
                {referenceProvenance.map((reference) => (
                  <div key={`${reference.title}-${reference.sourceArtifact ?? reference.contentHash ?? reference.url}`}>
                    <strong>{reference.title}</strong>
                    <small>{reference.resourceId ?? "unkeyed-reference"}</small>
                    {reference.sourceArtifact ? <small>Artifact: {reference.sourceArtifact}</small> : null}
                    {reference.accessedAt ? <small>Accessed: {reference.accessedAt}</small> : null}
                    {reference.contentHash ? <small>Hash: {reference.contentHash}</small> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section id="genome-inputs" className="detail-section">
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
                    <span>{input.assembly}</span>
                    <span>{input.required ? "required" : "optional"}</span>
                    <span>{input.missingDataBehavior}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Inputs are pending authenticated mock-report extraction.</p>
            )}
          </section>

          <section id="sample-report" className="detail-section">
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
                  <span>Description</span>
                  <span>Gene(s)</span>
                  <span>Source binding</span>
                </div>
                {report.sampleRows.map((row) => (
                  <div key={`${row.sortOrder}-${row.item}`} className="sample-row">
                    <span>{row.groupTitle}</span>
                    <span>
                      <strong>{row.item}</strong>
                      {row.brandName ? <small>{row.brandName}</small> : null}
                    </span>
                    <span>{row.geneticAnalysis}</span>
                    <span>{row.description ?? "-"}</span>
                    <span>{row.genes.join(", ")}</span>
                    <span>
                      <strong>{row.sourceLabel}</strong>
                      {row.sourceResourceIds?.length ? <small>{row.sourceResourceIds.join(", ")}</small> : null}
                      {row.sourceBindingStatus ? <small>{row.sourceBindingStatus}</small> : null}
                      {row.sourceBindingNote ? <small>{row.sourceBindingNote}</small> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Mock report rows are pending extraction.</p>
            )}
          </section>

          <section id="genotype-summary" className="detail-section">
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

          <section id="fixture" className="detail-section">
            <div className="detail-section-header">
              <span className="eyebrow">Local run fixture</span>
              <div className="detail-actions">
                <button className="btn btn-outline" type="button" onClick={copyLocalAgentInput} disabled={!localAgentInput}>
                  Copy agent input
                </button>
                <button className="btn btn-primary" type="button" onClick={copyFixture} disabled={!report.localTestFixture}>
                  Copy fixture
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </div>
            {report.localTestFixture ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Agent input</dt>
                    <dd>{localAgentInput ? "prompt, fixture, schema, references" : "pending prompt readiness"}</dd>
                  </div>
                  <div>
                    <dt>References</dt>
                    <dd>{report.references.length}</dd>
                  </div>
                  <div>
                    <dt>Output sections</dt>
                    <dd>{report.outputSections.length}</dd>
                  </div>
                  <div>
                    <dt>Sample rows</dt>
                    <dd>{report.sampleRows.length}</dd>
                  </div>
                </dl>
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
              <button className="btn btn-primary" type="button" onClick={copyPrompt} disabled={!promptReady}>
                Copy prompt
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
            {report.prompt ? (
              <>
                <dl className="inline-meta-list">
                  <div>
                    <dt>Prompt title</dt>
                    <dd>{report.prompt.title}</dd>
                  </div>
                  <div>
                    <dt>Version</dt>
                    <dd>{report.prompt.promptVersion ?? "pending"}</dd>
                  </div>
                  <div>
                    <dt>Extraction</dt>
                    <dd>{report.prompt.extractionStatus}</dd>
                  </div>
                  <div>
                    <dt>Copy status</dt>
                    <dd>{promptReady ? "ready" : "draft only"}</dd>
                  </div>
                </dl>
                {!promptReady ? (
                  <p className="body-text">
                    This inferred prompt is visible for review, but it is not ready for local-agent execution.
                  </p>
                ) : null}
                <pre>{report.prompt.deterministicPrompt}</pre>
                <div className="contract-grid">
                  <ContractList title="Input contract" items={report.prompt.inputContract} />
                  <ContractList title="Output contract" items={report.prompt.outputContract} />
                  <ContractList title="Safety notes" items={report.prompt.safetyNotes} />
                </div>
                <p className="body-text">{report.prompt.appendixPolicy}</p>
                <p className="body-text">{report.prompt.probabilityDisclosure}</p>
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
                        <span>
                          {field.type}
                          {field.required ? " required" : " optional"}
                        </span>
                        <p>{field.description}</p>
                        {field.fieldPath ||
                        field.citationRequired ||
                        field.formalSourceField ||
                        field.sourceBinding ||
                        field.allowsUnavailable ? (
                          <small>
                            {field.fieldPath ? `Path: ${field.fieldPath}. ` : ""}
                            {field.citationRequired ? "Citation required. " : ""}
                            {field.formalSourceField ? `Source: ${field.formalSourceField}. ` : ""}
                            {field.sourceBinding ? `Binding: ${field.sourceBinding}. ` : ""}
                            {field.allowsUnavailable ? "Unavailable value allowed." : ""}
                          </small>
                        ) : null}
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
                    {reference.resourceId ? `${reference.resourceId} - ` : ""}
                    {reference.scope ?? "background"} - {reference.theme} - {reference.evidenceLevel} -{" "}
                    {reference.extractionStatus}
                  </small>
                  {reference.usedFor?.length ? <small>Used for: {reference.usedFor.join(", ")}</small> : null}
                  {reference.sourceArtifact ? <small>Artifact: {reference.sourceArtifact}</small> : null}
                  {reference.accessedAt ? <small>Accessed: {reference.accessedAt}</small> : null}
                  {reference.contentHash ? <small>Hash: {reference.contentHash}</small> : null}
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
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
