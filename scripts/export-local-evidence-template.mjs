#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_COORDINATE_MAP_PATH = "reference/variant-rsid-coordinate-map.json";

const parseArgs = () => {
  const parsed = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    parsed.set(arg, next && !next.startsWith("--") ? next : "true");
    if (next && !next.startsWith("--")) {
      index += 1;
    }
  }
  return parsed;
};

const args = parseArgs();
const reportSlug = args.get("--report");
const bundlePath = args.get("--bundle") ?? (reportSlug ? `tmp/agent-bundles/${reportSlug}.validated.json` : null);
const outPath =
  args.get("--out") ?? (reportSlug ? `tmp/evidence-templates/${reportSlug}.derived-evidence-template.json` : null);
const coordinateMapPath =
  args.get("--coordinate-map") ??
  args.get("--rsid-coordinate-map") ??
  (existsSync(DEFAULT_COORDINATE_MAP_PATH) ? DEFAULT_COORDINATE_MAP_PATH : null);
const requestedAssembly = args.get("--assembly") ?? null;

if (!reportSlug || !bundlePath || !outPath) {
  throw new Error(
    "Usage: npm run agent:evidence-template -- --report <slug> [--bundle tmp/agent-bundles/<slug>.validated.json] [--out tmp/evidence-templates/<slug>.derived-evidence-template.json] [--coordinate-map reference/variant-rsid-coordinate-map.json] [--assembly GRCh38|GRCh37]",
  );
}

if (!existsSync(bundlePath)) {
  throw new Error(`Missing validated bundle at ${bundlePath}. Run npm run agent:export first, or pass --bundle.`);
}

const sha256 = (value) => `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
const coordinateMap = coordinateMapPath ? JSON.parse(readFileSync(coordinateMapPath, "utf8")) : null;

if (bundle.reportSlug !== reportSlug) {
  throw new Error(`Bundle slug mismatch: expected ${reportSlug}, found ${bundle.reportSlug ?? "unknown"}`);
}

const fixtureRows = bundle.fixture?.genomeEvidence ?? [];
const uniqueSorted = (values) => [...new Set(values.filter((value) => typeof value === "string" && value.trim()))].sort();
const normalizeRsid = (value) => (typeof value === "string" && /^rs\d+$/i.test(value.trim()) ? value.trim().toLowerCase() : "");
const normalizeAssemblyKey = (value) => {
  const text = String(value ?? "").toLowerCase();
  const has38 = text.includes("grch38") || text.includes("hg38") || text.includes("gcf_000001405.4");
  const has37 = text.includes("grch37") || text.includes("hg19") || text.includes("gcf_000001405.2");
  if (has38 && !has37) return "GRCh38";
  if (has37 && !has38) return "GRCh37";
  return null;
};
const hasCoordinate = (row) =>
  (typeof row.chrom === "string" || typeof row.contig === "string") &&
  (Number.isFinite(row.pos) || Number.isFinite(row.position));
const selectCoordinate = (row) => {
  if (!coordinateMap || hasCoordinate(row)) {
    return null;
  }
  const rsid = normalizeRsid(row.rsid);
  if (!rsid) {
    return null;
  }
  const entry = coordinateMap.mappings?.[rsid];
  const assembly =
    normalizeAssemblyKey(requestedAssembly) ??
    normalizeAssemblyKey(row.assembly) ??
    normalizeAssemblyKey(bundle.fixture?.inputManifest?.genomeBuild);
  const placement = assembly ? entry?.placements?.[assembly] : null;
  if (!placement?.chrom || !Number.isFinite(placement.pos)) {
    return null;
  }
  return {
    chrom: placement.chrom,
    pos: placement.pos,
    coordinateSource: coordinateMap.source?.name ?? "NCBI RefSNP API",
    coordinateSourceUrl: entry.sourceUrl,
    coordinateAssembly: assembly,
    coordinateRefSeq: placement.refSeq,
    coordinateConvention: placement.positionConvention ?? coordinateMap.source?.coordinateConvention,
  };
};

let coordinateMapRows = 0;
const templateRows = fixtureRows.map((row, index) => {
  const coordinate = selectCoordinate(row);
  if (coordinate) {
    coordinateMapRows += 1;
  }
  return {
    sortOrder: index + 1,
    inputId: row.inputId,
    ...(typeof row.rsid === "string" ? { rsid: row.rsid } : {}),
    ...(typeof row.starAllele === "string" ? { starAllele: row.starAllele } : {}),
    ...(typeof row.haplotype === "string" ? { haplotype: row.haplotype } : {}),
    ...(typeof row.chrom === "string" ? { chrom: row.chrom } : {}),
    ...(typeof row.contig === "string" ? { contig: row.contig } : {}),
    ...(Number.isFinite(row.pos) ? { pos: row.pos } : {}),
    ...(Number.isFinite(row.position) ? { position: row.position } : {}),
    ...coordinate,
    gene: row.gene,
    assembly: row.assembly,
    observedValue: "",
    matchStatus: "unavailable",
    sourceFile: "derived-local-evidence.json",
    sourceArtifact: "local-derived-evidence",
    sampleOnlyObservedValue: row.observedValue,
    sampleOnlyMatchStatus: row.matchStatus,
    fillInstruction:
      "Replace observedValue and matchStatus with a derived local finding. Do not paste VCF/gVCF/FASTQ/BAM/CRAM records, raw sequence, or raw file paths.",
  };
});

const requiredFields = ["inputId", "gene", "observedValue", "assembly", "matchStatus"];
const optionalIdentifierFields = ["rsid", "starAllele", "haplotype"];
const optionalLocalExtractorFields = [
  "chrom",
  "pos",
  "position",
  "contig",
  "coordinateSource",
  "coordinateSourceUrl",
  "coordinateAssembly",
  "coordinateRefSeq",
  "coordinateConvention",
];
const identifiers = {
  inputIds: uniqueSorted(fixtureRows.map((row) => row.inputId)),
  rsids: uniqueSorted(fixtureRows.map((row) => row.rsid)),
  genes: uniqueSorted(fixtureRows.map((row) => row.gene)),
  starAlleles: uniqueSorted(fixtureRows.map((row) => row.starAllele)),
  haplotypes: uniqueSorted(fixtureRows.map((row) => row.haplotype)),
};

const template = {
  schemaVersion: "soma-reports.derived-evidence-template.v1",
  generatedAt: new Date().toISOString(),
  reportSlug,
  reportPurpose: bundle.agentRunInput?.reportPurpose ?? bundle.fixture?.reportPurpose ?? null,
  bundlePath,
  bundleHash: bundle.bundleHash,
  coordinateMap: coordinateMapPath
    ? {
        path: coordinateMapPath,
        source: coordinateMap?.source?.name ?? "NCBI RefSNP API",
        rowsEnriched: coordinateMapRows,
        requestedAssembly: normalizeAssemblyKey(requestedAssembly),
      }
    : null,
  templateHash: null,
  readiness: bundle.readiness,
  privacyBoundary: {
    rawGenomeIncluded: false,
    derivedEvidenceOnly: true,
    uploadRequired: false,
    allowedEvidence:
      "Derived observations such as genotype labels, star alleles, haplotypes, source-tool availability, or unavailable/missing statuses.",
    forbiddenEvidence:
      "Raw VCF/gVCF lines, FASTQ reads, BAM/CRAM/SAM records, long DNA sequence strings, raw file paths, or whole-genome call tables.",
  },
  derivedEvidenceSchema: {
    inputShape: "object with inputManifest and genomeEvidence[]",
    requiredRowFields: requiredFields,
    optionalIdentifierFields,
    optionalLocalExtractorFields,
    allowedMatchStatusExamples: [
      "observed",
      "unavailable",
      "not_found",
      "not_in_file",
      "missing",
      "reference_block_covered",
      "source-output-unavailable",
    ],
    rejectedMatchStatusExamples: [
      {
        value: "sample_pdf_match",
        reason:
          "Use only for synthetic fixture/sample-report provenance. Do not use it as user-derived local evidence.",
      },
    ],
  },
  inputManifest: {
    hash: "sha256:<hash-of-derived-evidence-json>",
    genomeBuild: fixtureRows.find((row) => typeof row.assembly === "string" && row.assembly.trim())?.assembly ?? "derived-local",
    rawGenomeReturned: false,
    source: "derived-local-evidence.json",
  },
  identifiers,
  genomeEvidence: templateRows,
  extractionInstructions: [
    "Inspect raw genome files only inside the local environment.",
    "Emit only the filled derived-evidence JSON, not raw records.",
    "Preserve inputId values from genomeEvidence[] so agent:prepare can compare supplied rows to the report fixture.",
    "Use unavailable, missing, not_found, or source-output-unavailable when a row cannot be derived from the local file.",
    "Use sourceFile as a derived-evidence manifest name, not a raw file path.",
    "For VCF/gVCF inputs, run npm run agent:derive-evidence to fill rsID rows and any rows where chrom/pos are supplied.",
    coordinateMapPath
      ? "Rows with rsIDs and no explicit coordinates may include NCBI RefSNP-derived chrom/pos values for recovering gVCF END= reference blocks; VCF POS is stored as SPDI position + 1."
      : "If rsID rows need gVCF END= reference-block recovery, pass --coordinate-map with an NCBI RefSNP-derived rsID coordinate map.",
    "After filling the template, run npm run agent:prepare with the filled JSON.",
  ],
  deriveEvidenceCommand: `npm run agent:derive-evidence -- --template ${outPath} --vcf /path/to/local-genome.vcf.gz --out tmp/evidence-templates/${reportSlug}.filled-derived-evidence.json`,
  prepareCommand: `npm run agent:prepare -- --report ${reportSlug} --evidence <filled-derived-evidence.json> --out tmp/agent-runs/${reportSlug}.agent-input.json`,
};

template.templateHash = sha256({
  reportSlug: template.reportSlug,
  bundleHash: template.bundleHash,
  identifiers: template.identifiers,
  genomeEvidence: template.genomeEvidence,
  derivedEvidenceSchema: template.derivedEvidenceSchema,
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(template, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      reportSlug,
      outPath,
      bundlePath,
      templateRows: templateRows.length,
      coordinateMapPath,
      coordinateMapRows,
      inputIds: identifiers.inputIds.length,
      rsids: identifiers.rsids.length,
      genes: identifiers.genes.length,
      templateHash: template.templateHash,
      rawGenomeIncluded: false,
      readiness: {
        evidenceStatus: bundle.readiness?.evidenceStatus,
        sampleBackedFormalReady: bundle.readiness?.sampleBackedFormalReady,
        localScaffoldOnly: bundle.readiness?.localScaffoldOnly,
      },
    },
    null,
    2,
  ),
);
