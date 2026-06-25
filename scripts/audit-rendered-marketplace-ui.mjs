#!/usr/bin/env node

import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const expected = {
  marketplacePositions: 164,
  namedPackages: 154,
  uniqueHrefs: 87,
  duplicatePlacements: 77,
  duplicateGroups: 50,
  orderAliases: 3,
  routeAliases: 10,
  unresolvedIdentities: 0,
};

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

const format = args.get("--format") ?? "json";
if (!["json", "compact"].includes(format)) {
  throw new Error(`Unsupported --format ${format}; expected json or compact`);
}

const timeoutMs = Number(args.get("--timeout-ms") ?? 30000);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
  throw new Error("--timeout-ms must be a positive number");
}
const selectedCaptureReport = args.get("--report") ?? "sequencing-depth-and-coverage";

const withSelectedReport = (value) => {
  const parsed = new URL(value);
  if (!parsed.searchParams.has("report")) {
    parsed.searchParams.set("report", selectedCaptureReport);
  }
  return parsed.toString();
};

const getOpenPort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (!port) {
          reject(new Error("Could not allocate a local port"));
          return;
        }
        resolve(port);
      });
    });
  });

const waitForUrl = async (url, deadlineMs) => {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < deadlineMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
};

const playwrightCliPath = () => {
  const codexHome = process.env.CODEX_HOME || join(process.env.HOME || "", ".codex");
  const wrapperPath = join(codexHome, "skills/playwright/scripts/playwright_cli.sh");
  if (existsSync(wrapperPath)) {
    return { command: wrapperPath, prefix: [] };
  }
  return { command: "npx", prefix: ["--yes", "--package", "@playwright/cli", "playwright-cli"] };
};

const parsePlaywrightResult = (stdout) => {
  const marker = "### Result\n";
  const start = stdout.indexOf(marker);
  if (start < 0) {
    throw new Error(`Playwright eval output did not include a result block:\n${stdout.slice(0, 2000)}`);
  }
  const afterMarker = stdout.slice(start + marker.length);
  const end = afterMarker.indexOf("\n### ");
  const jsonText = (end >= 0 ? afterMarker.slice(0, end) : afterMarker).trim();
  return JSON.parse(jsonText);
};

const runPlaywright = ({ session, command, prefix }, commandArgs, options = {}) => {
  const run = spawnSync(command, [...prefix, ...commandArgs], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PLAYWRIGHT_CLI_SESSION: session,
    },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    ...options,
  });
  if (run.status !== 0) {
    throw new Error(run.stderr.trim() || run.stdout.trim() || `playwright-cli exited with ${run.status}`);
  }
  return run;
};

const addCheck = (checks, key, ok, expectedValue, actualValue) => {
  checks.push({
    key,
    ok,
    expected: expectedValue,
    actual: actualValue,
  });
};

const evaluateRenderedPage = `async () => {
  const selectedCaptureReport = ${JSON.stringify(selectedCaptureReport)};
  const normalize = (value) => (value || "").replace(/\\s+/g, " ").trim();
  const waitFor = async (predicate, timeout = 20000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeout) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("Timed out waiting for rendered marketplace UI");
  };

  await waitFor(() => document.querySelectorAll("#position-ledger .position-row:not(.header)").length === 164);
  await waitFor(() => /\\d+ recent runs/i.test(document.querySelector(".run-ledger-panel")?.innerText || ""));

  const ledger = document.getElementById("position-ledger");
  if (ledger) {
    ledger.open = true;
  }
  await new Promise((resolve) => requestAnimationFrame(resolve));

  const rows = [...document.querySelectorAll("#position-ledger .position-row:not(.header)")];
  const rowTexts = rows.map((row) => normalize(row.innerText));
  const proofText = normalize(document.querySelector(".marketplace-proof-strip")?.innerText);
  const noticeText = normalize(document.querySelector(".notice-strip")?.innerText);
  const showingText = normalize(document.querySelector(".results-header .eyebrow")?.innerText);
  const bodyText = normalize(document.body.innerText);
  const cards = [...document.querySelectorAll(".report-card")];
  const cardTexts = cards.map((card) => normalize(card.innerText));
  const inspectButtons = [...document.querySelectorAll("#position-ledger .position-row button")];
  const officialCaptureCards = [...document.querySelectorAll(".official-capture-card")];
  const officialCaptureCardTexts = officialCaptureCards.map((card) => normalize(card.innerText));
  const officialCapturePacketButtons = [...document.querySelectorAll(".completion-workbench-actions button")].filter(
    (button) => /copy packet/i.test(button.innerText || ""),
  );
  const buttonTexts = [...document.querySelectorAll("button")].map((button) =>
    normalize(button.textContent || button.innerText),
  );
  const selectedReportTitle = normalize(document.querySelector(".detail-sidebar h2")?.innerText);
  const selectedDetailText = normalize(document.querySelector("#report-detail")?.innerText);
  const readOnlyLocalRunText = normalize(document.querySelector('[aria-label="Read-only local-run checks"]')?.innerText);
  const writePrivateLocalRunText = normalize(document.querySelector('[aria-label="Local run commands that write tmp"]')?.innerText);
  const selectedEvidencePacketPanel = [...document.querySelectorAll("#official-output-capture .capture-template-panel")].find((panel) =>
    /Official evidence packet/i.test(panel.innerText || ""),
  );
  const selectedEvidencePacketText = normalize(selectedEvidencePacketPanel?.querySelector("pre")?.innerText);
  const selectedCaptureTemplatePanel = [...document.querySelectorAll("#official-output-capture .capture-template-panel")].find((panel) =>
    /Sanitized artifact template/i.test(panel.innerText || ""),
  );
  const selectedCaptureTemplateText = normalize(selectedCaptureTemplatePanel?.querySelector("pre")?.innerText);
  const runLedgerText = normalize(document.querySelector(".run-ledger-panel")?.innerText);

  return {
    url: window.location.href,
    title: document.title,
    hero: normalize(document.querySelector("h1")?.innerText),
    proofText,
    noticeText,
    showingText,
    ledgerOpen: Boolean(ledger?.open),
    positionRows: rows.length,
    headerRows: document.querySelectorAll("#position-ledger .position-row.header").length,
    firstPositionText: rowTexts[0] || null,
    lastPositionText: rowTexts[rowTexts.length - 1] || null,
    loadingRows: rowTexts.filter((text) => /loading authenticated position ledger/i.test(text)).length,
    pendingIdentityRows: rowTexts.filter((text) => /package identity pending/i.test(text)).length,
    inspectButtons: inspectButtons.length,
    duplicateGroupItems: document.querySelectorAll(".position-duplicate-list li").length,
    aliasRows: document.querySelectorAll(".alias-list > div").length,
    routeAliasRows: document.querySelectorAll(".route-alias-list > div").length,
    reportCards: cards.length,
    selectedCards: cards.filter((card) => card.classList.contains("selected")).length,
    localRunReadyCards: document.querySelectorAll(".local-run-strip.local-run-ready").length,
    localRunScaffoldCards: document.querySelectorAll(".local-run-strip.local-run-scaffold").length,
    localAgentPromptArtifactCards: cardTexts.filter((text) => /Prompt artifact/i.test(text)).length,
    localAgentFixtureArtifactCards: cardTexts.filter((text) => /Fixture artifact/i.test(text)).length,
    localAgentDeterministicResultCards: cardTexts.filter((text) => /Deterministic result JSON/i.test(text)).length,
    localAgentPlainEnglishGuardCards: cardTexts.filter((text) => /Plain-English guard/i.test(text)).length,
    localAgentAppendixProbabilityGuardCards: cardTexts.filter((text) => /Appendix probability guard/i.test(text)).length,
    localAgentScaffoldOnlyCards: cardTexts.filter((text) => /Scaffold-only local/i.test(text)).length,
    positionRowsWithPromptArtifact: rowTexts.filter((text) => /Prompt artifact/i.test(text)).length,
    positionRowsWithFixtureArtifact: rowTexts.filter((text) => /Fixture artifact/i.test(text)).length,
    positionRowsWithDeterministicResultJson: rowTexts.filter((text) => /Deterministic result JSON/i.test(text)).length,
    positionRowsWithPlainEnglishGuard: rowTexts.filter((text) => /Plain-English guard/i.test(text)).length,
    positionRowsWithAppendixProbabilityGuard: rowTexts.filter((text) => /Appendix probability guard/i.test(text)).length,
    officialOutputBlockerCards: document.querySelectorAll(".card-official-action").length,
    officialBoundaryModeledReportCards: cardTexts.filter((text) => /Official boundary modeled/i.test(text)).length,
    metadataOnlyReportCards: cardTexts.filter((text) => /Metadata only/i.test(text)).length,
    officialCaptureCards: officialCaptureCards.length,
    officialCapturePacketButtons: officialCapturePacketButtons.length,
    officialBoundaryModeledCaptureCards: officialCaptureCardTexts.filter((text) =>
      /Boundary tier\\s+Official boundary modeled/i.test(text),
    ).length,
    metadataOnlyCaptureCards: officialCaptureCardTexts.filter((text) =>
      /Boundary tier\\s+Metadata only/i.test(text),
    ).length,
    officialCaptureCardsWithRouteArtifact: officialCaptureCardTexts.filter((text) =>
      /Route probe artifact/i.test(text),
    ).length,
    officialCaptureCardsWithPublicArtifact: officialCaptureCardTexts.filter((text) =>
      /Public evidence artifact/i.test(text),
    ).length,
    officialCaptureCardsWithFormalGate: officialCaptureCardTexts.filter((text) =>
      /Formal gate missing|Formal gate ready/i.test(text),
    ).length,
    officialCaptureCardsWithCaptureStatusSnapshotCommand: officialCaptureCardTexts.filter((text) =>
      /npm run scaffold:capture-status:snapshot/i.test(text),
    ).length,
    officialCaptureCardsWithRouteProbeBoundary: officialCaptureCardTexts.filter((text) =>
      /Latest authenticated route probe/i.test(text),
    ).length,
    officialCaptureCardsWithPublicPromotionGaps: officialCaptureCardTexts.filter((text) =>
      /Missing for promotion:/i.test(text),
    ).length,
    officialCaptureBoardText: normalize(document.querySelector(".official-capture-board")?.innerText).slice(0, 3000),
    selectedReportTitle,
    selectedDetailText: selectedDetailText.slice(0, 4000),
    selectedEvidencePacketText: selectedEvidencePacketText.slice(0, 5000),
    selectedEvidencePacketRendered: /Official evidence packet/i.test(selectedEvidencePacketPanel?.innerText || ""),
    selectedEvidencePacketHasProvenance:
      selectedEvidencePacketText.includes(\`"captureUrl": "https://sequencing.com/marketplace/\${selectedCaptureReport}"\`) &&
      selectedEvidencePacketText.includes('"routeProbe"') &&
      selectedEvidencePacketText.includes('"publicBundleEvidence"') &&
      selectedEvidencePacketText.includes('"publicEndpointProbe"') &&
      selectedEvidencePacketText.includes('"publicCaptureTemplatePath"') &&
      selectedEvidencePacketText.includes('"sanitizedDraftPath"') &&
      selectedEvidencePacketText.includes('"committedCapturePath"'),
    selectedEvidencePacketHasSourceWorkflows:
      selectedEvidencePacketText.includes('"publicCaptureTemplate"') &&
      selectedEvidencePacketText.includes("npm run scaffold:capture-template") &&
      selectedEvidencePacketText.includes("npm run scaffold:capture-session -- --source public") &&
      selectedEvidencePacketText.includes("npm run scaffold:capture-session -- --source private") &&
      selectedEvidencePacketText.includes("npm run scaffold:capture-session -- --source both") &&
      selectedEvidencePacketText.includes("npm run scaffold:redaction-template") &&
      selectedEvidencePacketText.includes("npm run scaffold:sanitize-output"),
    selectedEvidencePacketHasPrivacyBoundary:
      selectedEvidencePacketText.includes('"rawGenomeIncluded": false') &&
      selectedEvidencePacketText.includes('"privateValuesRedacted": true') &&
      selectedEvidencePacketText.includes('"commitSafe": true'),
    selectedEvidencePacketHasPromotionGate:
      selectedEvidencePacketText.includes('"rowEvidenceReadyCaptures": 0') &&
      selectedEvidencePacketText.includes('"promotesSampleBackedFormalReady": false') &&
      selectedEvidencePacketText.includes('"validateCommittedCapture"') &&
      selectedEvidencePacketText.includes('"nextEvidenceNeeded"'),
    selectedCaptureTemplateText: selectedCaptureTemplateText.slice(0, 3000),
    selectedDetailShowsBoundaryModeled: /Official boundary\\s+Official boundary modeled/i.test(selectedDetailText),
    selectedDetailShowsMetadataOnly: /Official boundary\\s+Metadata only/i.test(selectedDetailText),
    selectedDetailShowsSampleBackedPending: /Sample-backed formal\\s+Pending/i.test(selectedDetailText),
    selectedDetailShowsRowReadyZero: /Row-ready captures\\s+0/i.test(selectedDetailText),
    selectedDetailShowsMissingOfficialRows: /official non-private sampleRows\\[\\], resultRows\\[\\], reportFile, or export rows/i.test(selectedDetailText),
    selectedDetailHasLiteralReportSlugPlaceholder: /\\{report\\.slug\\}/i.test(selectedDetailText),
    selectedDetailHasSelectedTemplateAuditCommand: selectedDetailText.includes(
      \`npm run scaffold:template-audit -- --report \${selectedCaptureReport}\`,
    ),
    selectedDetailShowsPublicEndpointProbe:
      /Public report endpoint probe/i.test(selectedDetailText) &&
      selectedDetailText.includes(\`https://sequencing.com/api/sequencing/public/reports/\${selectedCaptureReport}\`),
    selectedDetailShowsPublicEndpointOutputBoundary:
      /Exact-package reportFile:\\s+empty/i.test(selectedDetailText) &&
      /Exact output key signals:\\s+0/i.test(selectedDetailText) &&
      /rowEvidenceReady validation/i.test(selectedDetailText),
    selectedCaptureTemplateHasPlaceholderStatus:
      selectedCaptureTemplateText.includes('"sourceBindingStatus": "replace-with-exact-direct-or-official"'),
    selectedCaptureTemplateHasConfirmationFields:
      selectedCaptureTemplateText.includes('"sourceBindingConfirmed": false') &&
      selectedCaptureTemplateText.includes('"sourceBindingConfirmationNote": "replace-with-visible-row-or-export-binding-note"'),
    selectedCaptureTemplateHasEagerExactStatus: selectedCaptureTemplateText.includes('"sourceBindingStatus": "exact"'),
    runLedgerText,
    runLedgerResolved: /\\d+ recent runs/i.test(runLedgerText),
    runLedgerShowsRawGenomeBoundary: /Raw genome stored\\s+no/i.test(runLedgerText),
    runLedgerShowsConvexBoundary: /Stored in Convex\\s+hashes, counts, status, artifact paths/i.test(runLedgerText),
    copyReadOnlyChecksButtons: buttonTexts.filter((text) => text === "Copy read-only checks").length,
    copyLocalRunWritesTmpButtons: buttonTexts.filter((text) => text === "Copy local run commands (writes tmp)").length,
    copyBundleValidatorWritesTmpButtons: buttonTexts.filter((text) => text === "Copy bundle validator (writes tmp)").length,
    createConvexDraftButtons: buttonTexts.filter((text) => text === "Create Convex draft").length,
    saveConvexResultSummaryButtons: buttonTexts.filter((text) => text === "Save Convex result summary").length,
    readOnlyLocalRunText: readOnlyLocalRunText.slice(0, 2500),
    writePrivateLocalRunText: writePrivateLocalRunText.slice(0, 3500),
    readOnlyLocalRunIncludesChecks:
      /agent:workflow-check/i.test(readOnlyLocalRunText) &&
      /--strict true/i.test(readOnlyLocalRunText) &&
      /agent:validate-run/i.test(readOnlyLocalRunText),
    readOnlyLocalRunExcludesWrites:
      !/SOMA_LOCAL_GENOME|agent:prepare-local|agent:derive-evidence|agent:seed-cache|agent:bundle|agent:update-rsid-coordinate-map|--out tmp\\//i.test(
        readOnlyLocalRunText,
      ),
    writePrivateLocalRunIncludesWrites:
      /SOMA_LOCAL_GENOME/i.test(writePrivateLocalRunText) &&
      /agent:prepare-local/i.test(writePrivateLocalRunText) &&
      /agent:derive-evidence/i.test(writePrivateLocalRunText) &&
      /agent:generate-local-result/i.test(writePrivateLocalRunText) &&
      /--out tmp\\//i.test(writePrivateLocalRunText) &&
      /SOMA_LOCAL_RUNNER/i.test(writePrivateLocalRunText),
    selectedDetailShowsSplitWorkflow:
      /Read-only checks\\s+no tmp writes; no raw genome input/i.test(selectedDetailText) &&
      /Local run commands\\s+writes ignored tmp artifacts; may read private genome input/i.test(selectedDetailText),
    containsEvidenceQueue: /Evidence queue/i.test(bodyText),
    containsAgentPromptNav: /Agent Prompt/i.test(bodyText),
    containsOutputSchemaNav: /Output Schema/i.test(bodyText),
    containsReferencesNav: /References/i.test(bodyText),
    containsPublicCaptureSessionCommand:
      /npm run scaffold:capture-session -- --source public --format md --out tmp\\/official-output-capture-session-public\\.md/i.test(
        bodyText,
      ),
    containsPrivateCaptureSessionCommand:
      /npm run scaffold:capture-session -- --source private --format md --out tmp\\/official-output-capture-session-private\\.md/i.test(
        bodyText,
      ),
    containsCombinedCaptureSessionCommand:
      /npm run scaffold:capture-session -- --source both --format md --out tmp\\/official-output-capture-session\\.md/i.test(
        bodyText,
      ),
    containsPublicEndpointProbeSummary:
      /Public endpoint probe:\\s+21\\/21 fetched,\\s+18 parsed,\\s+3 expected unavailable,\\s+0 exact report files,\\s+0 exact output-row signal targets/i.test(
        bodyText,
      ),
    bodySample: bodyText.slice(0, 1000)
  };
}`;

const serverUrlArg = args.get("--url");
const session = `soma-ui-audit-${process.pid}-${Date.now()}`;
let devServer = null;
let url = serverUrlArg;

try {
  if (!url) {
    const port = await getOpenPort();
    url = `http://127.0.0.1:${port}/`;
    devServer = spawn("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForUrl(url, timeoutMs);
  }
  url = withSelectedReport(url);

  const playwright = playwrightCliPath();
  runPlaywright({ ...playwright, session }, ["open", url]);
  runPlaywright({ ...playwright, session }, ["resize", "1440", "1200"]);
  const evalRun = runPlaywright({ ...playwright, session }, ["eval", evaluateRenderedPage], {
    timeout: timeoutMs + 5000,
  });
  const rendered = parsePlaywrightResult(evalRun.stdout);

  const checks = [];
  addCheck(checks, "document_title", rendered.title === "SomaReports", "SomaReports", rendered.title);
  addCheck(
    checks,
    "coverage_proof_text",
    rendered.proofText.includes("164 Sequencing.com positions verified") &&
      rendered.proofText.includes("154 named report identities") &&
      rendered.proofText.includes("87") &&
      rendered.proofText.includes("77 duplicate category placements") &&
      rendered.proofText.includes("0") &&
      rendered.proofText.includes("unresolved identities"),
    "proof strip shows 164 positions, 154 identities, 87 hrefs, 77 duplicates, and 0 unresolved",
    rendered.proofText,
  );
  addCheck(
    checks,
    "position_ledger_rows",
    rendered.positionRows === expected.marketplacePositions,
    expected.marketplacePositions,
    rendered.positionRows,
  );
  addCheck(checks, "position_ledger_open", rendered.ledgerOpen === true, true, rendered.ledgerOpen);
  addCheck(checks, "position_ledger_no_loading_row", rendered.loadingRows === 0, 0, rendered.loadingRows);
  addCheck(checks, "position_ledger_no_identity_pending", rendered.pendingIdentityRows === 0, 0, rendered.pendingIdentityRows);
  addCheck(checks, "position_ledger_inspect_buttons", rendered.inspectButtons === expected.marketplacePositions, expected.marketplacePositions, rendered.inspectButtons);
  addCheck(checks, "duplicate_groups_rendered", rendered.duplicateGroupItems === expected.duplicateGroups, expected.duplicateGroups, rendered.duplicateGroupItems);
  addCheck(checks, "order_aliases_rendered", rendered.aliasRows === expected.orderAliases, expected.orderAliases, rendered.aliasRows);
  addCheck(
    checks,
    "route_aliases_rendered",
    rendered.routeAliasRows === expected.routeAliases,
    expected.routeAliases,
    rendered.routeAliasRows,
  );
  addCheck(
    checks,
    "first_and_last_positions",
    /1\s+Sequencing Apps\s+Next-Gen Disease Screen/i.test(rendered.firstPositionText ?? "") &&
      /164\s+DNA Test Kit Bundles\s+Ultra Rapid Professional Health Screen WGS Bundle/i.test(
        rendered.lastPositionText ?? "",
      ),
    "first row is Next-Gen Disease Screen and last row is Ultra Rapid Professional Health Screen WGS Bundle",
    {
      firstPositionText: rendered.firstPositionText,
      lastPositionText: rendered.lastPositionText,
    },
  );
  addCheck(checks, "report_cards_rendered", rendered.reportCards === expected.namedPackages, expected.namedPackages, rendered.reportCards);
  addCheck(
    checks,
    "showing_named_packages",
    rendered.showingText.toLowerCase().includes(`showing ${expected.namedPackages} packages`),
    `Showing ${expected.namedPackages} packages`,
    rendered.showingText,
  );
  addCheck(
    checks,
    "local_run_surfaces_rendered",
    rendered.localRunReadyCards + rendered.localRunScaffoldCards === expected.namedPackages,
    expected.namedPackages,
    {
      localRunReadyCards: rendered.localRunReadyCards,
      localRunScaffoldCards: rendered.localRunScaffoldCards,
    },
  );
  addCheck(
    checks,
    "local_agent_artifact_chips_on_report_cards",
    rendered.localAgentPromptArtifactCards === expected.namedPackages &&
      rendered.localAgentFixtureArtifactCards === expected.namedPackages &&
      rendered.localAgentDeterministicResultCards === expected.namedPackages &&
      rendered.localAgentPlainEnglishGuardCards === expected.namedPackages &&
      rendered.localAgentAppendixProbabilityGuardCards === expected.namedPackages &&
      rendered.localAgentScaffoldOnlyCards === 21,
    "all 154 report cards show local prompt, fixture, deterministic result, plain-English guard, and appendix probability guard chips; 21 remain scaffold-only",
    {
      promptArtifactCards: rendered.localAgentPromptArtifactCards,
      fixtureArtifactCards: rendered.localAgentFixtureArtifactCards,
      deterministicResultCards: rendered.localAgentDeterministicResultCards,
      plainEnglishGuardCards: rendered.localAgentPlainEnglishGuardCards,
      appendixProbabilityGuardCards: rendered.localAgentAppendixProbabilityGuardCards,
      scaffoldOnlyCards: rendered.localAgentScaffoldOnlyCards,
    },
  );
  addCheck(
    checks,
    "local_agent_artifact_chips_on_position_rows",
    rendered.positionRowsWithPromptArtifact === expected.marketplacePositions &&
      rendered.positionRowsWithFixtureArtifact === expected.marketplacePositions &&
      rendered.positionRowsWithDeterministicResultJson === expected.marketplacePositions &&
      rendered.positionRowsWithPlainEnglishGuard === expected.marketplacePositions &&
      rendered.positionRowsWithAppendixProbabilityGuard === expected.marketplacePositions,
    "all 164 authenticated marketplace positions show local prompt, fixture, deterministic result, plain-English guard, and appendix probability guard chips",
    {
      promptArtifactRows: rendered.positionRowsWithPromptArtifact,
      fixtureArtifactRows: rendered.positionRowsWithFixtureArtifact,
      deterministicResultRows: rendered.positionRowsWithDeterministicResultJson,
      plainEnglishGuardRows: rendered.positionRowsWithPlainEnglishGuard,
      appendixProbabilityGuardRows: rendered.positionRowsWithAppendixProbabilityGuard,
    },
  );
  addCheck(
    checks,
    "official_output_blocker_cards",
    rendered.officialOutputBlockerCards === 21,
    21,
    rendered.officialOutputBlockerCards,
  );
  addCheck(
    checks,
    "official_boundary_tier_report_cards",
    rendered.officialBoundaryModeledReportCards === 9 && rendered.metadataOnlyReportCards === 12,
    "9 report cards show official-boundary modeled and 12 show metadata only",
    {
      officialBoundaryModeledReportCards: rendered.officialBoundaryModeledReportCards,
      metadataOnlyReportCards: rendered.metadataOnlyReportCards,
    },
  );
  addCheck(
    checks,
    "official_capture_board_cards",
    rendered.officialCaptureCards === 21,
    21,
    rendered.officialCaptureCards,
  );
  addCheck(
    checks,
    "official_capture_board_packet_actions",
    rendered.officialCapturePacketButtons === 21,
    "all 21 completion workbench rows expose Copy packet",
    rendered.officialCapturePacketButtons,
  );
  addCheck(
    checks,
    "official_capture_boundary_tier_cards",
    rendered.officialBoundaryModeledCaptureCards === 9 && rendered.metadataOnlyCaptureCards === 12,
    "9 capture cards show Boundary tier Official boundary modeled and 12 show Boundary tier Metadata only",
    {
      officialBoundaryModeledCaptureCards: rendered.officialBoundaryModeledCaptureCards,
      metadataOnlyCaptureCards: rendered.metadataOnlyCaptureCards,
    },
  );
  addCheck(
    checks,
    "official_capture_board_artifact_trail",
    rendered.officialCaptureCardsWithRouteArtifact === 21 &&
      rendered.officialCaptureCardsWithPublicArtifact === 21,
    "all 21 official capture cards show route probe and public evidence artifact fields",
    {
      routeArtifactCards: rendered.officialCaptureCardsWithRouteArtifact,
      publicArtifactCards: rendered.officialCaptureCardsWithPublicArtifact,
    },
  );
  addCheck(
    checks,
    "official_capture_board_formal_gate",
    rendered.officialCaptureCardsWithFormalGate === 21,
    "all 21 official capture cards show formal validator gate state",
    rendered.officialCaptureCardsWithFormalGate,
  );
  addCheck(
    checks,
    "official_capture_board_command_chain",
    rendered.officialCaptureCardsWithCaptureStatusSnapshotCommand === 21,
    "all 21 official capture cards show the capture-status snapshot command",
    rendered.officialCaptureCardsWithCaptureStatusSnapshotCommand,
  );
  addCheck(
    checks,
    "official_capture_board_boundary_evidence",
    rendered.officialCaptureCardsWithRouteProbeBoundary >= 7 &&
      rendered.officialCaptureCardsWithPublicPromotionGaps >= 5,
    "route-probe boundary blocks and public promotion gaps are rendered for known evidence rows",
    {
      routeProbeBoundaryCards: rendered.officialCaptureCardsWithRouteProbeBoundary,
      publicPromotionGapCards: rendered.officialCaptureCardsWithPublicPromotionGaps,
    },
  );
  addCheck(
    checks,
    "official_capture_board_nonpromotion_wording",
    /row-evidence promotable/i.test(rendered.officialCaptureBoardText) &&
      /9 official-boundary modeled/i.test(rendered.officialCaptureBoardText) &&
      /12 metadata-only/i.test(rendered.officialCaptureBoardText) &&
      /0 row-ready/i.test(rendered.officialCaptureBoardText) &&
      /0 exact report files/i.test(rendered.officialCaptureBoardText) &&
      /0 exact output-row signal targets/i.test(rendered.officialCaptureBoardText) &&
      !/unblocked promotion candidates/i.test(rendered.officialCaptureBoardText),
    "board uses row-evidence promotable wording, exposes 9/12/0 tier counts, public endpoint zero-output counts, and avoids ambiguous promotion-candidate copy",
    rendered.officialCaptureBoardText,
  );
  addCheck(
    checks,
    "selected_capture_boundary_detail",
    (rendered.selectedDetailShowsBoundaryModeled || rendered.selectedDetailShowsMetadataOnly) &&
      rendered.selectedDetailShowsSampleBackedPending &&
      rendered.selectedDetailShowsRowReadyZero &&
      rendered.selectedDetailShowsMissingOfficialRows,
    "selected report detail shows an official boundary tier, sample-backed formal pending, row-ready captures 0, and missing official row evidence",
    {
      selectedReportTitle: rendered.selectedReportTitle,
      selectedDetailShowsBoundaryModeled: rendered.selectedDetailShowsBoundaryModeled,
      selectedDetailShowsMetadataOnly: rendered.selectedDetailShowsMetadataOnly,
      selectedDetailShowsSampleBackedPending: rendered.selectedDetailShowsSampleBackedPending,
      selectedDetailShowsRowReadyZero: rendered.selectedDetailShowsRowReadyZero,
      selectedDetailShowsMissingOfficialRows: rendered.selectedDetailShowsMissingOfficialRows,
      selectedDetailText: rendered.selectedDetailText,
    },
  );
  addCheck(
    checks,
    "selected_capture_commands_bind_report_slug",
    !rendered.selectedDetailHasLiteralReportSlugPlaceholder &&
      rendered.selectedDetailHasSelectedTemplateAuditCommand,
    "selected report detail renders the concrete template-audit command for the selected slug and no literal {report.slug} placeholder",
    {
      selectedReport: selectedCaptureReport,
      selectedReportTitle: rendered.selectedReportTitle,
      selectedDetailHasLiteralReportSlugPlaceholder: rendered.selectedDetailHasLiteralReportSlugPlaceholder,
      selectedDetailHasSelectedTemplateAuditCommand: rendered.selectedDetailHasSelectedTemplateAuditCommand,
    },
  );
  addCheck(
    checks,
    "selected_public_endpoint_probe_rendered",
    rendered.containsPublicEndpointProbeSummary &&
      rendered.selectedDetailShowsPublicEndpointProbe &&
      rendered.selectedDetailShowsPublicEndpointOutputBoundary,
    "official capture board and selected detail render public endpoint probe metadata without promoting report files or output rows",
    {
      selectedReport: selectedCaptureReport,
      containsPublicEndpointProbeSummary: rendered.containsPublicEndpointProbeSummary,
      selectedDetailShowsPublicEndpointProbe: rendered.selectedDetailShowsPublicEndpointProbe,
      selectedDetailShowsPublicEndpointOutputBoundary: rendered.selectedDetailShowsPublicEndpointOutputBoundary,
    },
  );
  addCheck(
    checks,
    "selected_official_evidence_packet_rendered",
    rendered.selectedEvidencePacketRendered &&
      rendered.selectedEvidencePacketHasProvenance &&
      rendered.selectedEvidencePacketHasPrivacyBoundary &&
      rendered.selectedEvidencePacketHasPromotionGate &&
      rendered.selectedEvidencePacketHasSourceWorkflows,
    "selected detail renders an official evidence packet with provenance, privacy boundary, non-promotion gate, and source workflows",
    {
      selectedEvidencePacketRendered: rendered.selectedEvidencePacketRendered,
      selectedEvidencePacketHasProvenance: rendered.selectedEvidencePacketHasProvenance,
      selectedEvidencePacketHasPrivacyBoundary: rendered.selectedEvidencePacketHasPrivacyBoundary,
      selectedEvidencePacketHasPromotionGate: rendered.selectedEvidencePacketHasPromotionGate,
      selectedEvidencePacketHasSourceWorkflows: rendered.selectedEvidencePacketHasSourceWorkflows,
      selectedEvidencePacketText: rendered.selectedEvidencePacketText,
    },
  );
  addCheck(
    checks,
    "selected_capture_template_binding_contract",
    rendered.selectedCaptureTemplateHasPlaceholderStatus &&
      rendered.selectedCaptureTemplateHasConfirmationFields &&
      !rendered.selectedCaptureTemplateHasEagerExactStatus,
    "selected official-output artifact template uses placeholder sourceBindingStatus, confirmation fields, and no eager exact status",
    {
      selectedReportTitle: rendered.selectedReportTitle,
      hasPlaceholderStatus: rendered.selectedCaptureTemplateHasPlaceholderStatus,
      hasConfirmationFields: rendered.selectedCaptureTemplateHasConfirmationFields,
      hasEagerExactStatus: rendered.selectedCaptureTemplateHasEagerExactStatus,
      selectedCaptureTemplateText: rendered.selectedCaptureTemplateText,
    },
  );
  addCheck(
    checks,
    "convex_run_ledger_rendered",
    rendered.runLedgerResolved &&
      rendered.runLedgerShowsRawGenomeBoundary &&
      rendered.runLedgerShowsConvexBoundary,
    "selected report renders a resolved Convex run ledger with raw-genome storage boundary",
    {
      runLedgerResolved: rendered.runLedgerResolved,
      runLedgerShowsRawGenomeBoundary: rendered.runLedgerShowsRawGenomeBoundary,
      runLedgerShowsConvexBoundary: rendered.runLedgerShowsConvexBoundary,
      runLedgerText: rendered.runLedgerText,
    },
  );
  addCheck(
    checks,
    "local_run_command_split_rendered",
    rendered.copyReadOnlyChecksButtons >= 2 &&
      rendered.copyLocalRunWritesTmpButtons >= 1 &&
      rendered.copyBundleValidatorWritesTmpButtons >= 1 &&
      rendered.createConvexDraftButtons >= 1 &&
      rendered.saveConvexResultSummaryButtons >= 1 &&
      rendered.selectedDetailShowsSplitWorkflow &&
      rendered.readOnlyLocalRunIncludesChecks &&
      rendered.readOnlyLocalRunExcludesWrites &&
      rendered.writePrivateLocalRunIncludesWrites,
    "selected report renders separate read-only checks, write/private local-run commands, and explicit Convex write actions",
    {
      copyReadOnlyChecksButtons: rendered.copyReadOnlyChecksButtons,
      copyLocalRunWritesTmpButtons: rendered.copyLocalRunWritesTmpButtons,
      copyBundleValidatorWritesTmpButtons: rendered.copyBundleValidatorWritesTmpButtons,
      createConvexDraftButtons: rendered.createConvexDraftButtons,
      saveConvexResultSummaryButtons: rendered.saveConvexResultSummaryButtons,
      selectedDetailShowsSplitWorkflow: rendered.selectedDetailShowsSplitWorkflow,
      readOnlyLocalRunIncludesChecks: rendered.readOnlyLocalRunIncludesChecks,
      readOnlyLocalRunExcludesWrites: rendered.readOnlyLocalRunExcludesWrites,
      writePrivateLocalRunIncludesWrites: rendered.writePrivateLocalRunIncludesWrites,
      readOnlyLocalRunText: rendered.readOnlyLocalRunText,
      writePrivateLocalRunText: rendered.writePrivateLocalRunText,
    },
  );
  addCheck(
    checks,
    "primary_objective_nav_and_queue",
    rendered.containsEvidenceQueue &&
      rendered.containsAgentPromptNav &&
      rendered.containsOutputSchemaNav &&
      rendered.containsReferencesNav &&
      rendered.containsPublicCaptureSessionCommand &&
      rendered.containsPrivateCaptureSessionCommand &&
      rendered.containsCombinedCaptureSessionCommand,
    "Evidence queue, source-specific capture-session commands, plus Agent Prompt, Output Schema, and References navigation are present",
    {
      containsEvidenceQueue: rendered.containsEvidenceQueue,
      containsAgentPromptNav: rendered.containsAgentPromptNav,
      containsOutputSchemaNav: rendered.containsOutputSchemaNav,
      containsReferencesNav: rendered.containsReferencesNav,
      containsPublicCaptureSessionCommand: rendered.containsPublicCaptureSessionCommand,
      containsPrivateCaptureSessionCommand: rendered.containsPrivateCaptureSessionCommand,
      containsCombinedCaptureSessionCommand: rendered.containsCombinedCaptureSessionCommand,
    },
  );

  const summary = {
    schemaVersion: "soma-reports.rendered-marketplace-ui-audit.v1",
    generatedAt: new Date().toISOString(),
    ok: checks.every((check) => check.ok),
    expected,
    url,
    rendered,
    checks,
    failedChecks: checks.filter((check) => !check.ok),
    privacyBoundary:
      "This audit renders the local SomaReports app against configured Convex query data and inspects DOM text/counts only. It does not read raw genome files or private completed-report payloads.",
  };

  const compactSummary = {
    schemaVersion: summary.schemaVersion,
    generatedAt: summary.generatedAt,
    ok: summary.ok,
    url: summary.url,
    rendered: {
      title: rendered.title,
      positionRows: rendered.positionRows,
      reportCards: rendered.reportCards,
      inspectButtons: rendered.inspectButtons,
      duplicateGroupItems: rendered.duplicateGroupItems,
      aliasRows: rendered.aliasRows,
      routeAliasRows: rendered.routeAliasRows,
      officialOutputBlockerCards: rendered.officialOutputBlockerCards,
      officialBoundaryModeledReportCards: rendered.officialBoundaryModeledReportCards,
      metadataOnlyReportCards: rendered.metadataOnlyReportCards,
      officialCaptureCards: rendered.officialCaptureCards,
      officialCapturePacketButtons: rendered.officialCapturePacketButtons,
      officialBoundaryModeledCaptureCards: rendered.officialBoundaryModeledCaptureCards,
      metadataOnlyCaptureCards: rendered.metadataOnlyCaptureCards,
      officialCaptureCardsWithRouteArtifact: rendered.officialCaptureCardsWithRouteArtifact,
      officialCaptureCardsWithPublicArtifact: rendered.officialCaptureCardsWithPublicArtifact,
      officialCaptureCardsWithFormalGate: rendered.officialCaptureCardsWithFormalGate,
      officialCaptureCardsWithCaptureStatusSnapshotCommand:
        rendered.officialCaptureCardsWithCaptureStatusSnapshotCommand,
      officialCaptureCardsWithRouteProbeBoundary: rendered.officialCaptureCardsWithRouteProbeBoundary,
      officialCaptureCardsWithPublicPromotionGaps: rendered.officialCaptureCardsWithPublicPromotionGaps,
      selectedReportTitle: rendered.selectedReportTitle,
      selectedCaptureTemplateHasPlaceholderStatus: rendered.selectedCaptureTemplateHasPlaceholderStatus,
      selectedCaptureTemplateHasConfirmationFields: rendered.selectedCaptureTemplateHasConfirmationFields,
      selectedCaptureTemplateHasEagerExactStatus: rendered.selectedCaptureTemplateHasEagerExactStatus,
      selectedDetailShowsBoundaryModeled: rendered.selectedDetailShowsBoundaryModeled,
      selectedDetailShowsMetadataOnly: rendered.selectedDetailShowsMetadataOnly,
      selectedDetailShowsSampleBackedPending: rendered.selectedDetailShowsSampleBackedPending,
      selectedDetailShowsRowReadyZero: rendered.selectedDetailShowsRowReadyZero,
      selectedDetailShowsMissingOfficialRows: rendered.selectedDetailShowsMissingOfficialRows,
      selectedDetailHasLiteralReportSlugPlaceholder: rendered.selectedDetailHasLiteralReportSlugPlaceholder,
      selectedDetailHasSelectedTemplateAuditCommand: rendered.selectedDetailHasSelectedTemplateAuditCommand,
      selectedDetailShowsPublicEndpointProbe: rendered.selectedDetailShowsPublicEndpointProbe,
      selectedDetailShowsPublicEndpointOutputBoundary: rendered.selectedDetailShowsPublicEndpointOutputBoundary,
      selectedEvidencePacketRendered: rendered.selectedEvidencePacketRendered,
      selectedEvidencePacketHasProvenance: rendered.selectedEvidencePacketHasProvenance,
      selectedEvidencePacketHasPrivacyBoundary: rendered.selectedEvidencePacketHasPrivacyBoundary,
      selectedEvidencePacketHasPromotionGate: rendered.selectedEvidencePacketHasPromotionGate,
      selectedEvidencePacketHasSourceWorkflows: rendered.selectedEvidencePacketHasSourceWorkflows,
      runLedgerResolved: rendered.runLedgerResolved,
      runLedgerShowsRawGenomeBoundary: rendered.runLedgerShowsRawGenomeBoundary,
      copyReadOnlyChecksButtons: rendered.copyReadOnlyChecksButtons,
      copyLocalRunWritesTmpButtons: rendered.copyLocalRunWritesTmpButtons,
      copyBundleValidatorWritesTmpButtons: rendered.copyBundleValidatorWritesTmpButtons,
      createConvexDraftButtons: rendered.createConvexDraftButtons,
      saveConvexResultSummaryButtons: rendered.saveConvexResultSummaryButtons,
      selectedDetailShowsSplitWorkflow: rendered.selectedDetailShowsSplitWorkflow,
      readOnlyLocalRunIncludesChecks: rendered.readOnlyLocalRunIncludesChecks,
      readOnlyLocalRunExcludesWrites: rendered.readOnlyLocalRunExcludesWrites,
      writePrivateLocalRunIncludesWrites: rendered.writePrivateLocalRunIncludesWrites,
      containsPublicCaptureSessionCommand: rendered.containsPublicCaptureSessionCommand,
      containsPrivateCaptureSessionCommand: rendered.containsPrivateCaptureSessionCommand,
      containsCombinedCaptureSessionCommand: rendered.containsCombinedCaptureSessionCommand,
      containsPublicEndpointProbeSummary: rendered.containsPublicEndpointProbeSummary,
      localRunReadyCards: rendered.localRunReadyCards,
      localRunScaffoldCards: rendered.localRunScaffoldCards,
      localAgentPromptArtifactCards: rendered.localAgentPromptArtifactCards,
      localAgentFixtureArtifactCards: rendered.localAgentFixtureArtifactCards,
      localAgentDeterministicResultCards: rendered.localAgentDeterministicResultCards,
      localAgentPlainEnglishGuardCards: rendered.localAgentPlainEnglishGuardCards,
      localAgentAppendixProbabilityGuardCards: rendered.localAgentAppendixProbabilityGuardCards,
      localAgentScaffoldOnlyCards: rendered.localAgentScaffoldOnlyCards,
      positionRowsWithPromptArtifact: rendered.positionRowsWithPromptArtifact,
      positionRowsWithFixtureArtifact: rendered.positionRowsWithFixtureArtifact,
      positionRowsWithDeterministicResultJson: rendered.positionRowsWithDeterministicResultJson,
      positionRowsWithPlainEnglishGuard: rendered.positionRowsWithPlainEnglishGuard,
      positionRowsWithAppendixProbabilityGuard: rendered.positionRowsWithAppendixProbabilityGuard,
      firstPositionText: rendered.firstPositionText,
      lastPositionText: rendered.lastPositionText,
    },
    failedChecks: summary.failedChecks,
  };

  console.log(JSON.stringify(format === "compact" ? compactSummary : summary, null, 2));
  if (!summary.ok) {
    process.exitCode = 1;
  }
} finally {
  try {
    const playwright = playwrightCliPath();
    runPlaywright({ ...playwright, session }, ["close"], { stdio: "ignore" });
  } catch {
    // The CLI may already have closed the ephemeral browser session.
  }
  if (devServer) {
    devServer.kill("SIGTERM");
  }
}
