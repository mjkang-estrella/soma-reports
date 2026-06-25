#!/usr/bin/env node

import {
  officialOutputCaptureSchema,
  validateOfficialOutputCaptureArtifact,
} from "./lib/official-output-capture-validator.mjs";

const sourceId = "dysautonomia-redacted-official-output";

const baseCapture = {
  schema: officialOutputCaptureSchema,
  slug: "dysautonomia",
  title: "Dysautonomia",
  capturedAt: "2026-06-24T18:00:00.000Z",
  captureUrl: "https://sequencing.com/marketplace/dysautonomia",
  sourceKind: "private-completed-output-redacted",
  privacyBoundary: {
    rawGenomeIncluded: false,
    privateValuesRedacted: true,
    commitSafe: true,
  },
  reportFile: "",
  sourceArtifacts: ["https://sequencing.com/marketplace/dysautonomia"],
  sourceResources: [
    {
      id: sourceId,
      title: "Dysautonomia redacted official completed output",
      sourceType: "redacted_official_completed_output",
      url: "https://sequencing.com/marketplace/dysautonomia",
      evidenceLevel: "official-output",
      extractionStatus: "direct",
      scope: "report_specific",
      usedFor: ["sampleRows", "formalFields", "citationBindings"],
    },
  ],
  sampleRows: [
    {
      rowId: "dysautonomia-official-row-1",
      section: "Results",
      item: "Autonomic nervous system summary",
      geneticAnalysis: "Redacted official completed-output row structure.",
      observedField: "summary",
      sourceResourceIds: [sourceId],
      sourceBindingStatus: "exact",
    },
  ],
  formalFields: [
    {
      key: "dysautonomia_summary",
      label: "Autonomic nervous system summary",
      observedField: "summary",
      outputPath: "sections.results.summary",
      status: "covered",
      sourceLabel: sourceId,
      sourceBindingStatus: "exact",
    },
  ],
  citationBindings: [
    {
      rowId: "dysautonomia-official-row-1",
      sourceResourceIds: [sourceId],
      sourceBindingStatus: "exact",
    },
  ],
  generatedOutput: {
    valueRedaction: "Private values redacted before repository export.",
    privateResultUrlCommitted: false,
  },
};

const canaries = [
  {
    name: "private-result-url-email-genotype",
    capture: {
      ...baseCapture,
      captureUrl: "https://sequencing.com/results/dysautonomia/private-run-123",
      sourceArtifacts: ["https://sequencing.com/results/dysautonomia/private-run-123"],
      sourceResources: [
        {
          ...baseCapture.sourceResources[0],
          url: "https://sequencing.com/results/dysautonomia/private-run-123",
        },
      ],
      sampleRows: [
        {
          ...baseCapture.sampleRows[0],
          geneticAnalysis: "Private row for user@example.com with genotype rs429358 C/T.",
        },
      ],
      generatedOutput: {
        valueRedaction: "Private values were not redacted.",
        privateResultUrlCommitted: true,
      },
    },
    expectOk: false,
    expectRowEvidenceReady: false,
  },
  {
    name: "missing-citation-bindings",
    capture: {
      ...baseCapture,
      citationBindings: [],
    },
    expectOk: true,
    expectRowEvidenceReady: false,
  },
  {
    name: "citation-binding-missing-row",
    capture: {
      ...baseCapture,
      citationBindings: [
        {
          ...baseCapture.citationBindings[0],
          rowId: "missing-output-row",
        },
      ],
    },
    expectOk: false,
    expectRowEvidenceReady: false,
  },
  {
    name: "formal-field-unknown-source-id",
    capture: {
      ...baseCapture,
      formalFields: [
        {
          ...baseCapture.formalFields[0],
          sourceResourceIds: ["missing-source-resource"],
          sourceLabel: sourceId,
        },
      ],
    },
    expectOk: false,
    expectRowEvidenceReady: false,
  },
  {
    name: "result-rows-only-source-bound",
    capture: {
      ...baseCapture,
      sourceResources: [
        {
          ...baseCapture.sourceResources[0],
          usedFor: ["resultRows", "formalFields", "citationBindings"],
        },
      ],
      sampleRows: [],
      resultRows: [
        {
          rowId: "dysautonomia-official-result-row-1",
          section: "Results",
          item: "Autonomic nervous system summary",
          values: {
            summary: "Redacted official completed-output row structure.",
          },
          sourceResourceIds: [sourceId],
          sourceBindingStatus: "exact",
        },
      ],
      citationBindings: [
        {
          rowId: "dysautonomia-official-result-row-1",
          sourceResourceIds: [sourceId],
          sourceBindingStatus: "exact",
        },
      ],
    },
    expectOk: true,
    expectRowEvidenceReady: true,
  },
  {
    name: "result-rows-only-missing-source-binding",
    capture: {
      ...baseCapture,
      sampleRows: [],
      resultRows: [
        {
          rowId: "dysautonomia-official-result-row-1",
          section: "Results",
          item: "Autonomic nervous system summary",
          values: {
            summary: "Redacted official completed-output row structure.",
          },
        },
      ],
      citationBindings: [
        {
          rowId: "dysautonomia-official-result-row-1",
          sourceResourceIds: [sourceId],
          sourceBindingStatus: "exact",
        },
      ],
    },
    expectOk: false,
    expectRowEvidenceReady: false,
  },
  {
    name: "metadata-only-sample-and-citation-bindings",
    capture: {
      ...baseCapture,
      sourceResources: [
        ...baseCapture.sourceResources,
        {
          id: "dysautonomia-authenticated-detail-metadata",
          title: "Dysautonomia authenticated detail metadata",
          sourceType: "authenticated_detail_metadata",
          url: "https://sequencing.com/marketplace/dysautonomia",
          evidenceLevel: "metadata-only",
          extractionStatus: "direct",
          scope: "report_specific",
          usedFor: ["catalogMetadata"],
        },
      ],
      sampleRows: [
        {
          ...baseCapture.sampleRows[0],
          sourceResourceIds: ["dysautonomia-authenticated-detail-metadata"],
          sourceBindingStatus: "exact",
        },
      ],
      citationBindings: [
        {
          ...baseCapture.citationBindings[0],
          sourceResourceIds: ["dysautonomia-authenticated-detail-metadata"],
          sourceBindingStatus: "exact",
        },
      ],
    },
    expectOk: true,
    expectRowEvidenceReady: false,
  },
  {
    name: "metadata-only-formal-field-binding",
    capture: {
      ...baseCapture,
      sourceResources: [
        ...baseCapture.sourceResources,
        {
          id: "dysautonomia-authenticated-detail-metadata",
          title: "Dysautonomia authenticated detail metadata",
          sourceType: "authenticated_detail_metadata",
          url: "https://sequencing.com/marketplace/dysautonomia",
          evidenceLevel: "metadata-only",
          extractionStatus: "direct",
          scope: "report_specific",
          usedFor: ["catalogMetadata"],
        },
      ],
      formalFields: [
        {
          ...baseCapture.formalFields[0],
          sourceResourceIds: ["dysautonomia-authenticated-detail-metadata"],
          sourceBindingStatus: "exact",
          sourceLabel: "dysautonomia-authenticated-detail-metadata",
        },
      ],
    },
    expectOk: true,
    expectRowEvidenceReady: false,
  },
  {
    name: "derived-official-bindings-boundary-only",
    capture: {
      ...baseCapture,
      sampleRows: [
        {
          ...baseCapture.sampleRows[0],
          sourceBindingStatus: "derived",
        },
      ],
      formalFields: [
        {
          ...baseCapture.formalFields[0],
          sourceBindingStatus: "derived",
        },
      ],
      citationBindings: [
        {
          ...baseCapture.citationBindings[0],
          sourceBindingStatus: "derived",
        },
      ],
    },
    expectOk: true,
    expectRowEvidenceReady: false,
  },
];

const results = canaries.map((canary) => {
  const validation = validateOfficialOutputCaptureArtifact(canary.capture, {
    path: `privacy-canary/${canary.name}.json`,
    expectedSlug: canary.capture.slug,
  });
  const passed =
    validation.ok === canary.expectOk && validation.rowEvidenceReady === canary.expectRowEvidenceReady;
  return {
    name: canary.name,
    passed,
    expected: {
      ok: canary.expectOk,
      rowEvidenceReady: canary.expectRowEvidenceReady,
    },
    actual: {
      ok: validation.ok,
      rowEvidenceReady: validation.rowEvidenceReady,
      promotionSafeProvenance: validation.promotionSafeProvenance,
      outputSignalReview: validation.outputSignalReview,
      promotionCandidate: validation.promotionCandidate,
      problems: validation.problems,
    },
  };
});

const summary = {
  schemaVersion: "soma-reports.official-output-capture-privacy-canary.v1",
  generatedAt: new Date().toISOString(),
  ok: results.every((result) => result.passed),
  results,
};

console.log(JSON.stringify(summary, null, 2));

if (!summary.ok) {
  process.exit(1);
}
