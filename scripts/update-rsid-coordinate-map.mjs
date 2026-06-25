#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DEFAULT_FIXTURES_DIR = "fixtures/synthetic";
const DEFAULT_OUT_PATH = "reference/variant-rsid-coordinate-map.json";
const NCBI_REFSNP_BASE_URL = "https://api.ncbi.nlm.nih.gov/variation/v0/refsnp";

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
const fixturesDir = args.get("--fixtures-dir") ?? DEFAULT_FIXTURES_DIR;
const outPath = args.get("--out") ?? DEFAULT_OUT_PATH;
const allowMissing = args.get("--allow-missing") === "true";
const requestDelayMs = Number.parseInt(args.get("--delay-ms") ?? "350", 10);
const requestRetries = Number.parseInt(args.get("--retries") ?? "4", 10);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const normalizeRsid = (value) => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^rs\d+$/.test(normalized) ? normalized : "";
};
const refsnpIdForRsid = (rsid) => normalizeRsid(rsid).replace(/^rs/, "");
const uniqueSorted = (values) =>
  [...new Set(values.filter((value) => isNonEmptyString(value)))].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeAssemblyKey = (value) => {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("grch38") || text.includes("hg38") || text.includes("gcf_000001405.4")) {
    return "GRCh38";
  }
  if (text.includes("grch37") || text.includes("hg19") || text.includes("gcf_000001405.2")) {
    return "GRCh37";
  }
  return null;
};

const chromFromRefSeq = (seqId) => {
  if (seqId === "NC_012920.1") {
    return "MT";
  }
  const match = /^NC_(\d{6})\./.exec(String(seqId ?? ""));
  if (!match) {
    return null;
  }
  const number = Number.parseInt(match[1], 10);
  if (number >= 1 && number <= 22) {
    return String(number);
  }
  if (number === 23) {
    return "X";
  }
  if (number === 24) {
    return "Y";
  }
  return null;
};

const scanFixtureRsids = () => {
  if (!existsSync(fixturesDir)) {
    throw new Error(`Missing fixtures directory: ${fixturesDir}`);
  }

  const usage = new Map();
  for (const fileName of readdirSync(fixturesDir).filter((name) => name.endsWith(".fixture.json")).sort()) {
    const filePath = join(fixturesDir, fileName);
    const fixture = readJson(filePath);
    const reportSlug = fileName.replace(/\.fixture\.json$/, "");
    const rows = Array.isArray(fixture.genomeEvidence) ? fixture.genomeEvidence : [];
    for (const row of rows) {
      const rsid = normalizeRsid(row.rsid);
      if (!rsid) {
        continue;
      }
      const current = usage.get(rsid) ?? { rsid, fixtureRows: 0, reports: new Set(), inputIds: new Set() };
      current.fixtureRows += 1;
      current.reports.add(reportSlug);
      if (isNonEmptyString(row.inputId)) {
        current.inputIds.add(row.inputId);
      }
      usage.set(rsid, current);
    }
  }

  return [...usage.values()].sort((left, right) => refsnpIdForRsid(left.rsid) - refsnpIdForRsid(right.rsid));
};

const fetchRefSnp = async (rsid) => {
  const refsnpId = refsnpIdForRsid(rsid);
  const sourceUrl = `${NCBI_REFSNP_BASE_URL}/${refsnpId}`;
  let lastStatus = null;
  for (let attempt = 0; attempt <= requestRetries; attempt += 1) {
    if (attempt > 0 || requestDelayMs > 0) {
      await sleep(requestDelayMs * Math.max(1, attempt));
    }
    const response = await fetch(sourceUrl);
    lastStatus = response.status;
    if (response.ok) {
      return { sourceUrl, data: await response.json() };
    }
    if (![429, 500, 502, 503, 504].includes(response.status)) {
      throw new Error(`NCBI RefSNP request failed for ${rsid}: HTTP ${response.status}`);
    }
  }
  throw new Error(`NCBI RefSNP request failed for ${rsid}: HTTP ${lastStatus} after ${requestRetries + 1} attempts`);
};

const placementToMapping = (placement) => {
  const trait = placement.placement_annot?.seq_id_traits_by_assembly?.find(
    (entry) => entry?.is_top_level === true && entry?.is_chromosome === true && !entry?.is_alt && !entry?.is_patch,
  );
  const assemblyKey = normalizeAssemblyKey(trait?.assembly_name ?? trait?.assembly_accession);
  if (!assemblyKey || placement.placement_annot?.seq_type !== "refseq_chromosome") {
    return null;
  }

  const spdis = (placement.alleles ?? []).map((allele) => allele?.allele?.spdi).filter(Boolean);
  const spdiPositions = uniqueSorted(spdis.map((spdi) => String(spdi.position ?? ""))).map((value) =>
    Number.parseInt(value, 10),
  );
  const spdiPosition = spdiPositions.length === 1 && Number.isInteger(spdiPositions[0]) ? spdiPositions[0] : null;
  const chrom = chromFromRefSeq(placement.seq_id);
  if (!chrom || spdiPosition === null) {
    return null;
  }

  return {
    assemblyKey,
    placement: {
      assemblyName: trait.assembly_name,
      assemblyAccession: trait.assembly_accession,
      refSeq: placement.seq_id,
      chrom,
      spdiPosition,
      pos: spdiPosition + 1,
      deletedSequences: uniqueSorted(spdis.map((spdi) => spdi.deleted_sequence)),
      insertedSequences: uniqueSorted(spdis.map((spdi) => spdi.inserted_sequence)),
      hgvsExamples: uniqueSorted((placement.alleles ?? []).map((allele) => allele?.hgvs)).slice(0, 8),
      positionConvention: "VCF POS is NCBI SPDI position + 1.",
    },
  };
};

const buildMapping = async (usage) => {
  const { sourceUrl, data } = await fetchRefSnp(usage.rsid);
  const placements = {};
  for (const placement of data.primary_snapshot_data?.placements_with_allele ?? []) {
    const mapped = placementToMapping(placement);
    if (!mapped || placements[mapped.assemblyKey]) {
      continue;
    }
    placements[mapped.assemblyKey] = mapped.placement;
  }

  return {
    rsid: usage.rsid,
    refsnpId: refsnpIdForRsid(usage.rsid),
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    ncbiLastUpdateDate: data.last_update_date ?? null,
    fixtureRows: usage.fixtureRows,
    reports: uniqueSorted([...usage.reports]),
    inputIds: uniqueSorted([...usage.inputIds]),
    placements,
  };
};

const usages = scanFixtureRsids();
const mappings = {};
const missing = [];

for (const usage of usages) {
  const mapping = await buildMapping(usage);
  if (!mapping.placements.GRCh38 && !mapping.placements.GRCh37) {
    missing.push(usage.rsid);
    if (!allowMissing) {
      throw new Error(`No GRCh37/GRCh38 top-level RefSeq chromosome placement found for ${usage.rsid}`);
    }
  }
  mappings[usage.rsid] = mapping;
}

const output = {
  schemaVersion: "soma-reports.rsid-coordinate-map.v1",
  generatedAt: new Date().toISOString(),
  generatedBy: "scripts/update-rsid-coordinate-map.mjs",
  source: {
    name: "NCBI RefSNP API",
    baseUrl: NCBI_REFSNP_BASE_URL,
    coordinateConvention: "NCBI SPDI positions are 0-based; VCF/gVCF POS is 1-based, so this map stores pos = spdiPosition + 1.",
  },
  fixtureScan: {
    fixturesDir,
    rsidCount: usages.length,
    fixtureRowsWithRsids: usages.reduce((sum, usage) => sum + usage.fixtureRows, 0),
  },
  missing,
  mappings,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      ok: true,
      outPath,
      rsidCount: usages.length,
      fixtureRowsWithRsids: output.fixtureScan.fixtureRowsWithRsids,
      missing: missing.length,
    },
    null,
    2,
  ),
);
