#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const defaultStatusPath = "reference/catalog/official-output-capture-status.json";
const endpointBase = "https://sequencing.com/api/sequencing/public/reports";

const parseArgs = () => {
  const args = new Map();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const next = process.argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(arg, next);
      index += 1;
    } else {
      args.set(arg, "true");
    }
  }
  return args;
};

const args = parseArgs();
const statusPath = args.get("--status") ?? defaultStatusPath;
const format = args.get("--format") ?? "json";
const outPath = args.get("--out") ?? null;
const reportFilter = args.get("--report") ?? args.get("--slug") ?? null;
const timeoutMs = Number(args.get("--timeout-ms") ?? 20000);

if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const compactText = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");
const isPlainObject = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const sha256Text = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const scalarOrNull = (value) => {
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  const text = compactText(value);
  return text.length > 0 ? text : null;
};

const formalFieldTextPattern =
  /\b(each row|columns? such as|columns? include|fields? include|inputs?\s*&\s*outputs?|search by|provides information on a position|graph and table|average, maximum, and minimum depth|depth for your entire genome|broken down by each chromosome|truly sequenced at 30x)\b/i;
const formalFieldListPatterns = [
  /\bcolumns? (?:such as|include|including)\s+([^.;]+)/gi,
  /\bfields? (?:such as|include|including)\s+([^.;]+)/gi,
  /\bsearch by\s+([^.;]+)/gi,
  /\boutputs? (?:such as|include|including)\s+([^.;]+)/gi,
];
const outputLanguagePatterns = [
  ["result", /\bresults?\b/i],
  ["sample", /\bsamples?\b/i],
  ["report", /\breports?\b/i],
  ["output", /\boutputs?\b/i],
  ["table", /\btables?\b/i],
  ["graph", /\bgraphs?\b/i],
  ["citation", /\bcitations?\b/i],
  ["download", /\bdownloads?\b/i],
  ["pdf", /\bpdf\b/i],
];
const outputKeyPattern =
  /^(reportFile|sampleRows|sample_rows|resultRows|result_rows|results|findings|generatedOutput|generated_output|mockReport|mock_report|sampleReport|sample_report|formalFields|formal_fields|citationBindings|citation_bindings|rows|columns)$/i;

const extractFormalFieldTerms = (text) => {
  const terms = [];
  const compact = compactText(text);
  if (!compact || !formalFieldTextPattern.test(compact)) {
    return [];
  }
  for (const pattern of formalFieldListPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(compact)) !== null) {
      const fragment = match[1].split(/\b(?:when|if|where|based on)\b/i)[0];
      for (const term of fragment.replace(/\s+and\s+/gi, ", ").split(",")) {
        const cleaned = term.trim().replace(/^(?:and|or)\s+/i, "");
        if (cleaned.length > 0 && cleaned.length <= 64) {
          terms.push(cleaned);
        }
      }
    }
  }
  if (/\b(depth|coverage)\b/i.test(compact) && /\b(graph|table|average|maximum|minimum|chromosome|30x)\b/i.test(compact)) {
    terms.push("scope", "chromosome", "averageDepth", "maximumDepth", "minimumDepth", "thirtyXDepthCheck");
  }
  return [...new Set(terms)];
};

const outputLanguageSignals = (text) =>
  outputLanguagePatterns
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);

const summarizeText = (text) => {
  const compact = compactText(text);
  if (!compact) {
    return null;
  }
  return {
    hash: sha256Text(compact),
    length: compact.length,
    outputLanguageSignals: outputLanguageSignals(compact),
    formalFieldTerms: extractFormalFieldTerms(compact),
  };
};

const summarizeInfoTabs = (item) =>
  Array.isArray(item?.info_tab)
    ? item.info_tab.map((tab) => ({
        label: compactText(tab?.info_tab_label),
        content: summarizeText(tab?.info_tab_content),
      }))
    : [];

const summarizeRelatedReports = (item) =>
  Array.isArray(item?.relatedReports)
    ? item.relatedReports
        .filter((report) => isNonEmptyString(report?.reportFile))
        .map((report) => ({
          title: compactText(report?.title),
          uri: compactText(report?.uri),
          reportFile: compactText(report?.reportFile),
          boundary:
            "Related report files are sibling context only. They do not count as exact-package official output for the target slug.",
        }))
    : [];

const summarizeEndpointIdentity = (item) => ({
  id: scalarOrNull(item?.id),
  nid: scalarOrNull(item?.nid),
  type: scalarOrNull(item?.type),
  category: scalarOrNull(item?.category),
  publisher: scalarOrNull(item?.publisher),
  productId: scalarOrNull(item?.product_id),
});

const summarizeAppMetadata = (item) => {
  const app = item?.app_id;
  if (!isPlainObject(app)) {
    return null;
  }
  return {
    appid: scalarOrNull(app.appid),
    label: scalarOrNull(app.label),
    backend: scalarOrNull(app.backend),
    backendApiAppId: scalarOrNull(app.backend_settings?.api_app_id),
  };
};

const summarizeProductData = (item) => {
  const productData = item?.product_data;
  if (!isPlainObject(productData)) {
    return null;
  }
  const fieldAppTargets = Array.isArray(productData.field_app?.und)
    ? productData.field_app.und
        .map((entry) => ({
          targetId: scalarOrNull(entry?.target_id),
          targetRevisionId: scalarOrNull(entry?.target_revision_id),
        }))
        .filter((entry) => entry.targetId !== null || entry.targetRevisionId !== null)
    : [];
  return {
    productId: scalarOrNull(productData.product_id),
    sku: scalarOrNull(productData.sku),
    type: scalarOrNull(productData.type),
    fieldAppTargets,
  };
};

const walkOutputKeys = (value, path = "$", signals = []) => {
  if (Array.isArray(value)) {
    if (value.length > 0 && outputKeyPattern.test(path.split(".").pop()?.replace(/\[\d+\]$/, "") ?? "")) {
      signals.push({ path, kind: "non-empty-output-array", count: value.length });
    }
    value.slice(0, 20).forEach((entry, index) => walkOutputKeys(entry, `${path}[${index}]`, signals));
    return signals;
  }
  if (!isPlainObject(value)) {
    return signals;
  }
  for (const [key, entry] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (outputKeyPattern.test(key)) {
      if (isNonEmptyString(entry)) {
        signals.push({ path: childPath, kind: "non-empty-output-string", hash: sha256Text(compactText(entry)) });
      } else if (Array.isArray(entry) && entry.length > 0) {
        signals.push({ path: childPath, kind: "non-empty-output-array", count: entry.length });
      } else if (isPlainObject(entry) && Object.keys(entry).length > 0) {
        signals.push({ path: childPath, kind: "non-empty-output-object", keys: Object.keys(entry).sort() });
      }
    }
    walkOutputKeys(entry, childPath, signals);
  }
  return signals;
};

const publicEndpointFor = (slug) => `${endpointBase}/${encodeURIComponent(slug)}`;

const fetchText = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal });
    return {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      text: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
};

const parseEndpointItem = (text) => {
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { parsed: false, item: null };
  }
  return {
    parsed: true,
    item: Array.isArray(parsed) ? parsed[0] : parsed?.[0] ?? parsed,
  };
};

const endpointProbeFor = async (row) => {
  const endpointUrl = publicEndpointFor(row.slug);
  try {
    const response = await fetchText(endpointUrl);
    const { parsed, item } = parseEndpointItem(response.text);
    const reportFile = compactText(item?.reportFile);
    const outputKeySignals = parsed && item ? walkOutputKeys(item) : [];
    const body = parsed && item ? summarizeText(item.body) : null;
    const summary = parsed && item ? summarizeText(item.summary) : null;
    const infoTabs = parsed && item ? summarizeInfoTabs(item) : [];
    const formalFieldTerms = [
      ...(body?.formalFieldTerms ?? []),
      ...(summary?.formalFieldTerms ?? []),
      ...infoTabs.flatMap((tab) => tab.content?.formalFieldTerms ?? []),
    ];
    const relatedReportFiles = parsed && item ? summarizeRelatedReports(item) : [];

    return {
      slug: row.slug,
      title: row.title,
      priority: row.priority ?? null,
      stage: row.stage ?? null,
      officialEvidenceTier: row.officialEvidenceTier ?? null,
      endpointUrl,
      httpStatus: response.status,
      ok: response.ok,
      contentType: response.contentType,
      bytes: response.text.length,
      parsed,
      endpointTitle: compactText(item?.title),
      endpointUri: compactText(item?.uri),
      endpointIdentity: parsed && item ? summarizeEndpointIdentity(item) : null,
      appMetadata: parsed && item ? summarizeAppMetadata(item) : null,
      productData: parsed && item ? summarizeProductData(item) : null,
      appId: item?.app_id?.backend_settings?.api_app_id ?? item?.app_id?.appid ?? null,
      price: compactText(item?.price),
      reportFile,
      exactPackageOutputSignals: {
        reportFile: Boolean(reportFile),
        nonEmptyOutputKeySignals: outputKeySignals.filter(
          (signal) => signal.path !== "$.reportFile" && !signal.path.startsWith("$.relatedReports"),
        ),
        bodyOutputLanguageSignals: body?.outputLanguageSignals ?? [],
        summaryOutputLanguageSignals: summary?.outputLanguageSignals ?? [],
        infoTabOutputLanguageSignals: [
          ...new Set(infoTabs.flatMap((tab) => tab.content?.outputLanguageSignals ?? [])),
        ],
      },
      body,
      summary,
      infoTabs,
      formalFieldTerms: [...new Set(formalFieldTerms)],
      relatedReportFiles,
      promotionBoundary:
        "Public endpoint probes are planning evidence only. Do not promote readiness without exact-package non-private rows, covered formalFields, source-backed citationBindings, and rowEvidenceReady validation.",
    };
  } catch (error) {
    return {
      slug: row.slug,
      title: row.title,
      priority: row.priority ?? null,
      stage: row.stage ?? null,
      officialEvidenceTier: row.officialEvidenceTier ?? null,
      endpointUrl,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      promotionBoundary:
        "Public endpoint probes are planning evidence only. Do not promote readiness without exact-package non-private rows, covered formalFields, source-backed citationBindings, and rowEvidenceReady validation.",
    };
  }
};

const status = readJson(statusPath);
const sourceRows = (status.rows ?? []).filter((row) => !reportFilter || row.slug === reportFilter);
const rows = [];
for (const row of sourceRows) {
  rows.push(await endpointProbeFor(row));
}

const exactReportFileRows = rows.filter((row) => isNonEmptyString(row.reportFile));
const exactRowsWithOutputKeys = rows.filter((row) => row.exactPackageOutputSignals?.nonEmptyOutputKeySignals?.length > 0);
const relatedReportFileRows = rows.filter((row) => row.relatedReportFiles?.length > 0);
const formalFieldSignalRows = rows.filter((row) => row.formalFieldTerms?.length > 0);
const unavailableRows = rows.filter((row) => row.httpStatus && row.httpStatus >= 400);
const failedRows = rows.filter((row) => row.ok !== true);

const summary = {
  schemaVersion: "soma-reports.public-report-endpoint-probe.v1",
  generatedAt: new Date().toISOString(),
  statusPath,
  endpointBase,
  filters: {
    report: reportFilter,
    timeoutMs,
  },
  totals: {
    targets: sourceRows.length,
    fetched: rows.length,
    ok: rows.filter((row) => row.ok).length,
    failed: failedRows.length,
    unavailable: unavailableRows.length,
    parsed: rows.filter((row) => row.parsed).length,
    exactReportFiles: exactReportFileRows.length,
    exactOutputKeySignalTargets: exactRowsWithOutputKeys.length,
    relatedReportFileTargets: relatedReportFileRows.length,
    formalFieldSignalTargets: formalFieldSignalRows.length,
    infoTabTargets: rows.filter((row) => row.infoTabs?.length > 0).length,
  },
  exactReportFileRows: exactReportFileRows.map((row) => ({ slug: row.slug, reportFile: row.reportFile })),
  exactOutputKeySignalRows: exactRowsWithOutputKeys.map((row) => ({
    slug: row.slug,
    signals: row.exactPackageOutputSignals.nonEmptyOutputKeySignals,
  })),
  relatedReportFileRows: relatedReportFileRows.map((row) => ({
    slug: row.slug,
    relatedReportFiles: row.relatedReportFiles,
  })),
  formalFieldSignalRows: formalFieldSignalRows.map((row) => ({
    slug: row.slug,
    formalFieldTerms: row.formalFieldTerms,
  })),
  rows,
  privacyBoundary:
    "This probe reads public Sequencing.com report metadata endpoints only. It stores hashes and small structural metadata, not raw genome data, private completed reports, account URLs, or private result rows.",
};

const compactSummary = {
  schemaVersion: summary.schemaVersion,
  generatedAt: summary.generatedAt,
  statusPath: summary.statusPath,
  endpointBase: summary.endpointBase,
  filters: summary.filters,
  totals: summary.totals,
  exactReportFileRows: summary.exactReportFileRows,
  exactOutputKeySignalRows: summary.exactOutputKeySignalRows,
  relatedReportFileRows: summary.relatedReportFileRows,
  formalFieldSignalRows: summary.formalFieldSignalRows,
  rows: rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    priority: row.priority,
    httpStatus: row.httpStatus,
    ok: row.ok,
    parsed: row.parsed,
    endpointIdentity: row.endpointIdentity,
    appId: row.appId,
    appMetadata: row.appMetadata,
    productData: row.productData,
    reportFile: row.reportFile,
    infoTabs: row.infoTabs?.map((tab) => tab.label) ?? [],
    formalFieldTerms: row.formalFieldTerms ?? [],
    relatedReportFiles: row.relatedReportFiles ?? [],
    promotionBoundary: row.promotionBoundary,
  })),
  privacyBoundary: summary.privacyBoundary,
};

const output = JSON.stringify(format === "compact" ? compactSummary : summary, null, 2);
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${output}\n`);
}

console.log(output);
