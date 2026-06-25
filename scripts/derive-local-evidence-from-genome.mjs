#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

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
const templatePath = args.get("--template");
const vcfPath = args.get("--vcf") ?? args.get("--genome");
const qcSummaryPath = args.get("--qc-summary") ?? args.get("--depth-summary") ?? args.get("--derived-qc");
const outPath = args.get("--out");
const requestedSample = args.get("--sample") ?? null;
const allowEmpty = args.get("--allow-empty") === "true";
const allowFiltered = args.get("--allow-filtered") === "true";
const coordinateMapPath =
  args.get("--coordinate-map") ??
  args.get("--rsid-coordinate-map") ??
  (existsSync(DEFAULT_COORDINATE_MAP_PATH) ? DEFAULT_COORDINATE_MAP_PATH : null);
const requestedAssembly = args.get("--assembly") ?? null;

if (vcfPath && qcSummaryPath) {
  throw new Error("Pass either --vcf/--genome or --qc-summary/--depth-summary, not both.");
}

const inputPath = vcfPath ?? qcSummaryPath;

if (!templatePath || !inputPath || !outPath) {
  throw new Error(
    "Usage: npm run agent:derive-evidence -- --template tmp/evidence-templates/<slug>.derived-evidence-template.json (--vcf /path/to/local.vcf[.gz] | --qc-summary /path/to/local-depth-summary.json) --out tmp/evidence-templates/<slug>.filled-derived-evidence.json [--sample SAMPLE_ID] [--coordinate-map reference/variant-rsid-coordinate-map.json] [--assembly GRCh38|GRCh37]",
  );
}

for (const path of [templatePath, inputPath, coordinateMapPath].filter(Boolean)) {
  if (!existsSync(path)) {
    throw new Error(`Missing required file: ${path}`);
  }
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const normalizeRsid = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const normalizeChrom = (value) => String(value ?? "").replace(/^chr/i, "").trim();
const normalizeAssemblyKey = (value) => {
  const text = String(value ?? "").toLowerCase();
  const has38 = text.includes("grch38") || text.includes("hg38") || text.includes("gcf_000001405.4");
  const has37 = text.includes("grch37") || text.includes("hg19") || text.includes("gcf_000001405.2");
  if (has38 && !has37) return "GRCh38";
  if (has37 && !has38) return "GRCh37";
  return null;
};
const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalizeAllele = (value) => (typeof value === "string" ? value.trim().toUpperCase() : "");
const sha256 = (value) =>
  `sha256:${createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex")}`;

const rawGenomeExtensions = /\.(bam|cram|fastq|fq|gvcf|sam|vcf)(\.gz)?$/i;
const safeDerivedSourceFile = (path) => basename(path).replace(rawGenomeExtensions, ".derived-evidence.json");
const rawFieldNames = new Set([
  "bam",
  "bases",
  "cram",
  "fastq",
  "genotypeCalls",
  "rawFileContents",
  "rawGenome",
  "rawGenotypeRows",
  "rawLine",
  "reads",
  "sam",
  "sequence",
  "vcf",
  "vcfLine",
]);
const rawGenomeFileReference = /(?:^|[\s"'(])(?:[~./]|[A-Za-z0-9_-])[\w./~ -]*\.(?:bam|cram|fastq|fq|gvcf|sam|vcf)(?:\.gz)?(?=$|[\s"',)])/i;
const longDnaSequence = /\b[ACGTN]{80,}\b/i;
const vcfHeader = /#CHROM\s+POS\s+ID\s+REF\s+ALT/i;
const vcfRecord =
  /(^|\n)(?:chr)?(?:[0-9]{1,2}|X|Y|M|MT)\t\d+\t[^\t]*\t[ACGTN.]+\t(?:[ACGTN,<>.]+)\t/i;

const rejectRawContent = (value, rootPath) => {
  const problems = [];
  const visit = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [key, entry] of Object.entries(node)) {
        const childPath = `${path}.${key}`;
        if (rawFieldNames.has(key)) {
          problems.push(`${childPath} looks like raw genome data`);
        }
        visit(entry, childPath);
      }
      return;
    }
    if (typeof node !== "string") {
      return;
    }
    if (vcfHeader.test(node) || vcfRecord.test(node) || longDnaSequence.test(node)) {
      problems.push(`${path} contains raw-sequence-like content`);
    }
    if (rawGenomeFileReference.test(node)) {
      problems.push(`${path} points at a raw genome file`);
    }
  };
  visit(value, rootPath);
  if (problems.length > 0) {
    throw new Error(`Derived QC summary failed local privacy checks:\n- ${problems.join("\n- ")}`);
  }
};

const splitInfo = (info) => {
  const parsed = new Map();
  for (const part of String(info ?? "").split(";")) {
    if (!part) continue;
    const [key, value = "true"] = part.split("=");
    parsed.set(key, value);
  }
  return parsed;
};

const parseGt = (format, sampleValue) => {
  if (!format || !sampleValue) {
    return null;
  }
  const keys = format.split(":");
  const values = sampleValue.split(":");
  const gtIndex = keys.indexOf("GT");
  if (gtIndex < 0) {
    return null;
  }
  const gt = values[gtIndex];
  if (!gt || gt === "." || gt.includes(".")) {
    return { gt, alleleIndexes: [], phased: gt.includes("|"), missing: true };
  }
  const separator = gt.includes("|") ? "|" : "/";
  return {
    gt,
    alleleIndexes: gt.split(/[|/]/).map((value) => Number.parseInt(value, 10)),
    phased: separator === "|",
    missing: false,
  };
};

const basesForGt = (ref, alt, gt) => {
  if (!gt || gt.missing || gt.alleleIndexes.length === 0) {
    return null;
  }
  const alleles = [ref, ...String(alt ?? "").split(",")];
  const bases = gt.alleleIndexes.map((index) => alleles[index] ?? `allele${index}`);
  return bases.join(gt.phased ? "|" : "/");
};

const recordIds = (id, info) => {
  const ids = new Set();
  for (const value of String(id ?? "").split(/[;,]/)) {
    if (/^rs\d+$/i.test(value)) {
      ids.add(normalizeRsid(value));
    }
  }
  for (const key of ["RS", "RSPOS", "dbSNP", "DBSNP", "Existing_variation"]) {
    const value = info.get(key);
    if (!value) continue;
    for (const entry of String(value).split(/[&,;,]/)) {
      if (/^rs\d+$/i.test(entry)) {
        ids.add(normalizeRsid(entry));
      } else if (key === "RS" && /^\d+$/.test(entry)) {
        ids.add(`rs${entry}`);
      }
    }
  }
  return [...ids];
};

const template = readJson(templatePath);
const coordinateMap = coordinateMapPath ? readJson(coordinateMapPath) : null;
const rawTemplateRows = Array.isArray(template.genomeEvidence) ? template.genomeEvidence : [];
const templateAssembly = template.inputManifest?.genomeBuild ?? null;
const requestedAssemblyKey = normalizeAssemblyKey(requestedAssembly);
const derivedGenomeBuild =
  requestedAssemblyKey ??
  normalizeAssemblyKey(template.inputManifest?.genomeBuild) ??
  template.inputManifest?.genomeBuild ??
  "local-vcf-derived";
const hasCoordinate = (row) =>
  normalizeChrom(row.chrom ?? row.contig ?? row.chromosome) && parsePositiveInteger(row.pos ?? row.position ?? row.start);
const selectCoordinate = (row, { overrideExisting = false } = {}) => {
  if (!coordinateMap || (hasCoordinate(row) && !overrideExisting)) {
    return null;
  }
  const rsid = normalizeRsid(row.rsid);
  const entry = rsid ? coordinateMap.mappings?.[rsid] : null;
  const assembly = requestedAssemblyKey ?? normalizeAssemblyKey(row.assembly) ?? normalizeAssemblyKey(templateAssembly);
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
    expectedReferenceAllele: placement.deletedSequences?.[0],
  };
};
let coordinateMapRows = 0;
const templateRows = rawTemplateRows.map((row) => {
  const shouldOverrideExisting = Boolean(
    isNonEmptyString(row.coordinateSource) && (requestedAssemblyKey || !isNonEmptyString(row.expectedReferenceAllele)),
  );
  const coordinate = selectCoordinate(row, { overrideExisting: shouldOverrideExisting });
  if (coordinate) {
    coordinateMapRows += 1;
    return { ...row, ...coordinate };
  }
  if (hasCoordinate(row) && isNonEmptyString(row.coordinateSource)) {
    coordinateMapRows += 1;
    return row;
  }
  return row;
});
if (templateRows.length === 0) {
  throw new Error("Template must contain genomeEvidence[] rows");
}

const targetRsids = new Set(templateRows.map((row) => normalizeRsid(row.rsid)).filter(Boolean));
const coordinateTargets = templateRows
  .map((row, index) => ({
    index,
    chrom: normalizeChrom(row.chrom ?? row.contig ?? row.chromosome),
    pos: parsePositiveInteger(row.pos ?? row.position ?? row.start),
    expectedReferenceAllele: normalizeAllele(row.expectedReferenceAllele),
  }))
  .filter((row) => row.chrom && row.pos);
const coordinateKey = (chrom, pos) => `${normalizeChrom(chrom)}:${pos}`;
const targetCoordinates = new Map(coordinateTargets.map((row) => [coordinateKey(row.chrom, row.pos), row]));
const referenceBlockMatchesTarget = (target, { chrom, pos, end, ref, isReferenceBlock }) =>
  normalizeChrom(chrom) === target.chrom &&
  target.pos >= pos &&
  target.pos <= end &&
  isReferenceBlock &&
  (!target.expectedReferenceAllele || normalizeAllele(ref) === target.expectedReferenceAllele);

const qcMetric = (summary, ...keys) => {
  for (const key of keys) {
    const parts = key.split(".");
    let value = summary;
    for (const part of parts) {
      value = value?.[part];
    }
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return null;
};
const numericMetric = (summary, ...keys) => {
  const value = qcMetric(summary, ...keys);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const formatMetric = (value, suffix = "") =>
  value === null ? null : `${Number.isInteger(value) ? value.toFixed(0) : value.toString()}${suffix}`;

if (qcSummaryPath) {
  if (rawGenomeExtensions.test(qcSummaryPath)) {
    throw new Error("QC summary input must be a derived JSON summary, not a raw genome/alignment file.");
  }

  const qcText = readFileSync(qcSummaryPath, "utf8");
  const qcSummary = JSON.parse(qcText);
  rejectRawContent(qcSummary, "$");
  const metrics = qcSummary.metrics ?? qcSummary.coverageSummary ?? qcSummary;
  const sourceFile = basename(qcSummaryPath);
  const qcGenomeBuild = qcSummary.inputManifest?.genomeBuild ?? template.inputManifest?.genomeBuild ?? "GRCh38-derived";
  const sourceArtifact = qcSummary.inputManifest?.source ?? "local-qc-summary-derived-evidence";
  const missingContext =
    qcMetric(metrics, "missingContext", "validationUnavailable", "regionalValidationUnavailable") ??
    "per-gene and exon-level region table, capture target definition, platform chemistry, read length, quality-filter thresholds, ploidy handling, benchmark truth-set comparison, and authenticated sample-report rows are unavailable in this derived QC summary";

  const outputRows = templateRows.map((row) => {
    const baseRow = {
      inputId: row.inputId,
      ...(isNonEmptyString(row.haplotype) ? { haplotype: row.haplotype } : {}),
      gene: row.gene,
      assembly: row.assembly ?? qcGenomeBuild,
      sourceFile,
      sourceArtifact,
    };
    const unavailable = (observedValue) => ({
      ...baseRow,
      observedValue,
      matchStatus: "unavailable",
      derivation: {
        method: "qc-summary",
        source: "local-derived-qc-summary",
      },
    });
    const observed = (observedValue, metricKeys) => ({
      ...baseRow,
      observedValue,
      matchStatus: "observed",
      derivation: {
        method: "qc-summary",
        metricKeys,
      },
    });

    if (row.inputId === "coverage-mean-autosomal-depth") {
      const mean = numericMetric(metrics, "meanAutosomalDepth", "meanDepth", "meanCoverage", "autosomal.meanDepth");
      const median = numericMetric(metrics, "medianAutosomalDepth", "medianDepth", "medianCoverage", "autosomal.medianDepth");
      if (mean !== null || median !== null) {
        return observed(
          [
            mean !== null ? `mean autosomal depth ${formatMetric(mean, "x")}` : null,
            median !== null ? `median autosomal depth ${formatMetric(median, "x")}` : null,
            "selected derived QC metric only",
          ]
            .filter(Boolean)
            .join("; "),
          ["meanAutosomalDepth", "medianAutosomalDepth"],
        );
      }
      return unavailable("mean and median autosomal depth were not supplied in the derived QC summary");
    }

    if (row.inputId === "coverage-breadth-thresholds") {
      const pct10x = numericMetric(metrics, "pct10x", "percent10x", "percentAtLeast10x", "basesAtLeast10xPct");
      const pct20x = numericMetric(metrics, "pct20x", "percent20x", "percentAtLeast20x", "basesAtLeast20xPct");
      const pctZero = numericMetric(metrics, "pctZeroCoverage", "percentZeroCoverage", "zeroCoveragePct");
      if (pct10x !== null || pct20x !== null || pctZero !== null) {
        return observed(
          [
            pct10x !== null ? `${formatMetric(pct10x, "%")} of assessed autosomal positions at or above 10x` : null,
            pct20x !== null ? `${formatMetric(pct20x, "%")} at or above 20x` : null,
            pctZero !== null ? `${formatMetric(pctZero, "%")} at zero observed coverage` : null,
          ]
            .filter(Boolean)
            .join("; "),
          ["pct10x", "pct20x", "pctZeroCoverage"],
        );
      }
      return unavailable("coverage breadth thresholds were not supplied in the derived QC summary");
    }

    if (row.inputId === "coverage-uniformity-summary") {
      const cv = numericMetric(metrics, "coverageCoefficientOfVariation", "coefficientOfVariation", "coverageCv");
      const pctWithin = numericMetric(
        metrics,
        "pctBases05x15xMean",
        "percentBasesBetweenHalfAndOnePointFiveMean",
        "basesBetween05x15xMeanPct",
      );
      if (cv !== null || pctWithin !== null) {
        return observed(
          [
            cv !== null ? `coverage coefficient of variation ${formatMetric(cv)}` : null,
            pctWithin !== null
              ? `${formatMetric(pctWithin, "%")} of assessed autosomal bases between 0.5x and 1.5x the mean depth`
              : null,
          ]
            .filter(Boolean)
            .join("; "),
          ["coverageCoefficientOfVariation", "pctBases05x15xMean"],
        );
      }
      return unavailable("coverage uniformity metrics were not supplied in the derived QC summary");
    }

    if (row.inputId === "coverage-regional-validation-unavailable") {
      return unavailable(String(missingContext));
    }

    return unavailable(
      "This row requires a specialized derived QC summary metric that was not recognized by the generic QC extractor.",
    );
  });

  const matchedRows = outputRows.filter((row) => row.matchStatus === "observed");
  if (!allowEmpty && matchedRows.length === 0) {
    throw new Error(
      "No observed local QC metrics were found. Re-run with --allow-empty true only when an all-unavailable local run is intentional.",
    );
  }

  const output = {
    schemaVersion: "soma-reports.local-derived-evidence.v1",
    generatedAt: new Date().toISOString(),
    reportSlug: template.reportSlug,
    reportPurpose: template.reportPurpose ?? null,
    inputManifest: {
      hash: sha256({
        templateHash: template.templateHash ?? null,
        reportSlug: template.reportSlug,
        qcSummaryHash: sha256(qcText),
        matchedRows: matchedRows.map((row) => ({
          inputId: row.inputId,
          observedValue: row.observedValue,
          matchStatus: row.matchStatus,
        })),
      }),
      genomeBuild: qcGenomeBuild,
      rawGenomeReturned: false,
      source: "local-qc-summary-derived-evidence",
    },
    privacyBoundary: {
      rawGenomeIncluded: false,
      derivedEvidenceOnly: true,
      rawLineIncluded: false,
      rawGenomePathIncluded: false,
      note:
        "This file contains derived QC observations only. It does not include raw VCF/gVCF records, raw sequencing reads, raw alignment records, raw sequence strings, or raw genome file paths.",
    },
    derivationSummary: {
      templatePath,
      templateRows: templateRows.length,
      source: "local-qc-summary-derived-evidence",
      sourceFile,
      derivedGenomeBuild: qcGenomeBuild,
      matchedRows: matchedRows.length,
      unavailableRows: outputRows.length - matchedRows.length,
      allowEmpty,
    },
    genomeEvidence: outputRows,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportSlug: output.reportSlug,
        outPath,
        templateRows: templateRows.length,
        derivedGenomeBuild: qcGenomeBuild,
        source: "local-qc-summary-derived-evidence",
        matchedRows: matchedRows.length,
        unavailableRows: output.derivationSummary.unavailableRows,
        rawGenomeIncluded: false,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const rsidMatches = new Map();
const coordinateMatches = new Map();
let selectedSampleName = requestedSample;
let sampleColumnIndex = null;
let variantRecords = 0;
let referenceBlockRecords = 0;
let dataLines = 0;

const stream = createReadStream(vcfPath);
const inputStream = /\.gz$/i.test(vcfPath) ? stream.pipe(createGunzip()) : stream;
const rl = createInterface({ input: inputStream, crlfDelay: Infinity });

for await (const line of rl) {
  if (!line || line.startsWith("##")) {
    continue;
  }
  if (line.startsWith("#CHROM")) {
    const header = line.slice(1).split("\t");
    const samples = header.slice(9);
    if (requestedSample) {
      const sampleIndex = samples.indexOf(requestedSample);
      if (sampleIndex < 0) {
        throw new Error(`Sample '${requestedSample}' not found in VCF header`);
      }
      sampleColumnIndex = 9 + sampleIndex;
      selectedSampleName = requestedSample;
    } else if (samples.length > 0) {
      sampleColumnIndex = 9;
      selectedSampleName = samples[0];
    }
    continue;
  }
  if (line.startsWith("#")) {
    continue;
  }

  dataLines += 1;
  const parts = line.split("\t");
  if (parts.length < 8) {
    continue;
  }

  const [chrom, posText, id, ref, alt, , filter, infoText, format] = parts;
  const pos = parsePositiveInteger(posText);
  const info = splitInfo(infoText);
  const filterValue = filter && filter !== "." ? filter : null;
  const passesFilter = allowFiltered || !filterValue || filterValue === "PASS";
  const end = parsePositiveInteger(info.get("END")) ?? pos;
  const isReferenceBlock = String(alt ?? "").includes("<NON_REF>") || (end && pos && end > pos);
  if (isReferenceBlock) {
    referenceBlockRecords += 1;
  } else {
    variantRecords += 1;
  }

  const sampleValue = sampleColumnIndex === null ? null : parts[sampleColumnIndex];
  const gt = parseGt(format, sampleValue);
  const observedBases = basesForGt(ref, alt, gt);
  const normalizedIds = recordIds(id, info);

  for (const rsid of normalizedIds) {
    if (!targetRsids.has(rsid) || rsidMatches.has(rsid)) {
      continue;
    }
    rsidMatches.set(rsid, {
      rsid,
      chrom: normalizeChrom(chrom),
      pos,
      genotype: gt?.gt ?? null,
      observedValue: passesFilter
        ? observedBases ?? (gt?.missing ? "genotype missing in local VCF record" : "VCF record present; genotype unavailable")
        : `VCF record present, but FILTER=${filterValue}; not used as observed local evidence.`,
      matchStatus: passesFilter
        ? observedBases
          ? "observed"
          : gt?.missing
            ? "missing"
            : "observed_record_no_genotype"
        : "filtered",
      filter: filterValue,
    });
  }

  if (targetCoordinates.size > 0 && pos) {
    const directKey = coordinateKey(chrom, pos);
    if (targetCoordinates.has(directKey) && !coordinateMatches.has(directKey)) {
      coordinateMatches.set(directKey, {
        chrom: normalizeChrom(chrom),
        pos,
        genotype: gt?.gt ?? null,
        observedValue: passesFilter
          ? observedBases ?? "VCF record present at requested coordinate; genotype unavailable"
          : `VCF record present at requested coordinate, but FILTER=${filterValue}; not used as observed local evidence.`,
        matchStatus: passesFilter ? (observedBases ? "observed" : "observed_record_no_genotype") : "filtered",
        filter: filterValue,
      });
    }

    for (const target of coordinateTargets) {
      const key = coordinateKey(target.chrom, target.pos);
      if (coordinateMatches.has(key)) {
        continue;
      }
      if (referenceBlockMatchesTarget(target, { chrom, pos, end, ref, isReferenceBlock })) {
        coordinateMatches.set(key, {
          chrom: target.chrom,
          pos: target.pos,
          genotype: gt?.gt ?? "0/0",
          observedValue: passesFilter
            ? `reference block covers ${target.chrom}:${target.pos}; no alternate allele observed in local gVCF block`
            : `reference block covers ${target.chrom}:${target.pos}, but FILTER=${filterValue}; not used as observed local evidence.`,
          matchStatus: passesFilter ? "reference_block_covered" : "reference_block_filtered",
          filter: filterValue,
        });
      }
    }
  }
}

const coordinateProvenance = (row) => ({
  ...(isNonEmptyString(row.coordinateSource) ? { coordinateSource: row.coordinateSource } : {}),
  ...(isNonEmptyString(row.coordinateSourceUrl) ? { coordinateSourceUrl: row.coordinateSourceUrl } : {}),
  ...(isNonEmptyString(row.coordinateAssembly) ? { coordinateAssembly: row.coordinateAssembly } : {}),
  ...(isNonEmptyString(row.coordinateRefSeq) ? { coordinateRefSeq: row.coordinateRefSeq } : {}),
  ...(isNonEmptyString(row.coordinateConvention) ? { coordinateConvention: row.coordinateConvention } : {}),
  ...(isNonEmptyString(row.expectedReferenceAllele) ? { expectedReferenceAllele: row.expectedReferenceAllele } : {}),
});
const derivationCoordinateProvenance = (row) => {
  const provenance = coordinateProvenance(row);
  if (!provenance.coordinateSource) {
    return {};
  }
  return {
    ...provenance,
    ...(normalizeRsid(row.rsid) ? { coordinateRsid: normalizeRsid(row.rsid) } : {}),
  };
};

const outputRows = templateRows.map((row) => {
  const rsid = normalizeRsid(row.rsid);
  const chrom = normalizeChrom(row.chrom ?? row.contig ?? row.chromosome);
  const pos = parsePositiveInteger(row.pos ?? row.position ?? row.start);
  const coordinateMatch = chrom && pos ? coordinateMatches.get(coordinateKey(chrom, pos)) : null;
  const rsidMatch = rsid ? rsidMatches.get(rsid) : null;
  const match = rsidMatch ?? coordinateMatch ?? null;
  const rowAssembly = row.coordinateAssembly ?? row.assembly ?? derivedGenomeBuild;

  if (match) {
    return {
      inputId: row.inputId,
      ...(isNonEmptyString(row.rsid) ? { rsid: row.rsid } : {}),
      ...(isNonEmptyString(row.starAllele) ? { starAllele: row.starAllele } : {}),
      ...(isNonEmptyString(row.haplotype) ? { haplotype: row.haplotype } : {}),
      ...(chrom ? { chrom } : {}),
      ...(pos ? { pos } : {}),
      ...coordinateProvenance(row),
      gene: row.gene,
      observedValue: match.observedValue,
      assembly: rowAssembly,
      matchStatus: match.matchStatus,
      sourceFile: safeDerivedSourceFile(outPath),
      sourceArtifact: "local-vcf-derived-evidence",
      derivation: {
        method: rsidMatch ? "vcf-rsid-gt" : "vcf-coordinate-or-gvcf-block",
        genotype: match.genotype,
        filter: match.filter,
        ...derivationCoordinateProvenance(row),
      },
    };
  }

  const canMatch = rsid || (chrom && pos);
  return {
    inputId: row.inputId,
    ...(isNonEmptyString(row.rsid) ? { rsid: row.rsid } : {}),
    ...(isNonEmptyString(row.starAllele) ? { starAllele: row.starAllele } : {}),
    ...(isNonEmptyString(row.haplotype) ? { haplotype: row.haplotype } : {}),
    ...(chrom ? { chrom } : {}),
    ...(pos ? { pos } : {}),
    ...coordinateProvenance(row),
    gene: row.gene,
    observedValue: canMatch
      ? "No matching local VCF/gVCF record was found for this requested identifier or coordinate."
      : "This row requires a specialized derived model, haplotype caller, star-allele caller, clinical context, or report output that the generic VCF/gVCF extractor cannot derive.",
    assembly: rowAssembly,
    matchStatus: canMatch ? "not_found" : "source-output-unavailable",
    sourceFile: safeDerivedSourceFile(outPath),
    sourceArtifact: "local-vcf-derived-evidence",
  };
});

const matchedRows = outputRows.filter((row) =>
  ["observed", "observed_record_no_genotype", "reference_block_covered", "missing"].includes(row.matchStatus),
);
const selectedSampleLabel = selectedSampleName ? (requestedSample ? "requested-sample" : "first-vcf-sample") : null;
const actionableTargets = targetRsids.size + targetCoordinates.size;

if (!allowEmpty && actionableTargets > 0 && matchedRows.length === 0) {
  throw new Error(
    `No observed local evidence was found for ${actionableTargets} rsID/coordinate target(s). Re-run with --allow-empty true only when an all-unavailable local run is intentional.`,
  );
}

const output = {
  schemaVersion: "soma-reports.local-derived-evidence.v1",
  generatedAt: new Date().toISOString(),
  reportSlug: template.reportSlug,
  reportPurpose: template.reportPurpose ?? null,
  inputManifest: {
    hash: sha256({
      templateHash: template.templateHash ?? null,
      reportSlug: template.reportSlug,
      matchedRows: matchedRows.map((row) => ({
        inputId: row.inputId,
        rsid: row.rsid ?? null,
        gene: row.gene,
        observedValue: row.observedValue,
        matchStatus: row.matchStatus,
      })),
      dataLines,
      selectedSampleLabel,
    }),
    genomeBuild: derivedGenomeBuild,
    rawGenomeReturned: false,
    source: "local-vcf-derived-evidence",
  },
  privacyBoundary: {
    rawGenomeIncluded: false,
    derivedEvidenceOnly: true,
    rawLineIncluded: false,
    rawGenomePathIncluded: false,
    note:
      "This file contains derived observations only. It does not include raw VCF/gVCF records, raw sequence strings, or the raw genome file path.",
  },
  derivationSummary: {
    templatePath,
    templateRows: templateRows.length,
    selectedSample: selectedSampleLabel,
    dataLines,
    variantRecords,
    referenceBlockRecords,
    coordinateMapPath,
    requestedAssembly: requestedAssemblyKey,
    derivedGenomeBuild,
    coordinateMapRows,
    targetRsids: targetRsids.size,
    rsidMatches: rsidMatches.size,
    coordinateTargets: targetCoordinates.size,
    coordinateMatches: coordinateMatches.size,
    matchedRows: matchedRows.length,
    unavailableRows: outputRows.length - matchedRows.length,
    filteredRows: outputRows.filter((row) => row.matchStatus === "filtered" || row.matchStatus === "reference_block_filtered")
      .length,
    allowEmpty,
    allowFiltered,
  },
  genomeEvidence: outputRows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      reportSlug: output.reportSlug,
      outPath,
      templateRows: templateRows.length,
      selectedSample: selectedSampleLabel,
      derivedGenomeBuild,
      coordinateMapPath,
      coordinateMapRows,
      targetRsids: targetRsids.size,
      rsidMatches: rsidMatches.size,
      coordinateTargets: targetCoordinates.size,
      coordinateMatches: coordinateMatches.size,
      matchedRows: matchedRows.length,
      filteredRows: output.derivationSummary.filteredRows,
      rawGenomeIncluded: false,
    },
    null,
    2,
  ),
);
