#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) {
    continue;
  }
  const next = process.argv[index + 1];
  args.set(arg, next && !next.startsWith("--") ? next : "true");
  if (next && !next.startsWith("--")) {
    index += 1;
  }
}

const outPath = args.get("--out") ?? "tmp/local-artifact-seeds.agent-cache.json";
const tempBundlePath = resolve("tmp", `local-artifact-seeds.${process.pid}.${Date.now()}.mjs`);

const requiredAppendixOutputFields = [
  {
    key: "probabilities",
    label: "Probabilities",
    description:
      "Probability or confidence disclosures kept out of deterministic findings; use an empty array when no calibrated model is supplied.",
    type: "object[]",
    required: true,
    fieldPath: "appendix.probabilities",
    citationRequired: false,
    allowsUnavailable: true,
  },
  {
    key: "uncertainty",
    label: "Uncertainty",
    description:
      "Plain-English notes that explain missing evidence, calibration limits, and why probabilities or confidence are not emitted in the deterministic body.",
    type: "string[]",
    required: true,
    fieldPath: "appendix.uncertainty",
    citationRequired: false,
    allowsUnavailable: true,
  },
  {
    key: "missingInputs",
    label: "Missing inputs",
    description:
      "Required or useful genome inputs that were absent, unavailable, or intentionally not inferred from local evidence.",
    type: "string[]",
    required: true,
    fieldPath: "appendix.missingInputs",
    citationRequired: false,
    allowsUnavailable: true,
  },
  {
    key: "limitations",
    label: "Limitations",
    description:
      "Scope, source, calibration, and professional-review limits that keep the report educational and deterministic.",
    type: "string[]",
    required: true,
    fieldPath: "appendix.limitations",
    citationRequired: false,
    allowsUnavailable: true,
  },
];

const withRequiredAppendixOutputFields = (sections) => {
  const existingFieldPaths = new Set(
    sections.flatMap((section) => section.expectedFields.map((field) => field.fieldPath).filter(Boolean)),
  );
  const missingFields = requiredAppendixOutputFields.filter((field) => !existingFieldPaths.has(field.fieldPath));

  if (missingFields.length === 0) {
    return sections;
  }

  const appendixIndex = sections.findIndex(
    (section) =>
      section.title.toLowerCase().includes("appendix") ||
      section.expectedFields.some((field) => field.fieldPath?.startsWith("appendix.")),
  );

  if (appendixIndex >= 0) {
    return sections.map((section, index) => {
      if (index !== appendixIndex) {
        return section;
      }

      const existingKeys = new Set(section.expectedFields.map((field) => field.key));
      const expectedFields = section.expectedFields.map((field) => {
        const requiredField = missingFields.find((candidate) => candidate.key === field.key && !field.fieldPath);
        if (!requiredField) {
          return field;
        }

        return {
          ...field,
          required: true,
          fieldPath: requiredField.fieldPath,
          citationRequired: field.citationRequired ?? requiredField.citationRequired,
          allowsUnavailable: field.allowsUnavailable ?? requiredField.allowsUnavailable,
        };
      });

      return {
        ...section,
        expectedFields: [...expectedFields, ...missingFields.filter((field) => !existingKeys.has(field.key))],
      };
    });
  }

  return [
    ...sections,
    {
      sortOrder: Math.max(0, ...sections.map((section) => section.sortOrder)) + 1,
      title: "Appendix",
      purpose: "Keep uncertainty, missing data, calibration limits, and probability disclosures outside deterministic findings.",
      expectedFields: missingFields,
    },
  ];
};

mkdirSync(dirname(tempBundlePath), { recursive: true });

await build({
  entryPoints: ["convex/reportPackages.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  outfile: tempBundlePath,
  logLevel: "silent",
});

try {
  const { seedReportPackages } = await import(pathToFileURL(tempBundlePath).href);
  const artifacts = [...seedReportPackages]
    .sort((a, b) => a.title.localeCompare(b.title))
    .filter((report) => report.prompt && report.localTestFixture)
    .map((report) => ({
      slug: report.slug,
      prompt: report.prompt,
      references: report.references,
      outputSections: withRequiredAppendixOutputFields(report.outputSections),
      formalFields: report.formalFields,
      sampleRows: report.sampleRows,
      genotypeSummary: report.genotypeSummary,
      sourceArtifacts: report.sourceArtifacts,
      localTestFixture: report.localTestFixture,
    }));

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(artifacts, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, outPath, artifacts: artifacts.length }, null, 2));
} finally {
  rmSync(tempBundlePath, { force: true });
}
