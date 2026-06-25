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
  const inspectButtons = [...document.querySelectorAll("#position-ledger .position-row button")];
  const officialCaptureCards = [...document.querySelectorAll(".official-capture-card")];
  const officialCaptureCardTexts = officialCaptureCards.map((card) => normalize(card.innerText));

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
    officialOutputBlockerCards: document.querySelectorAll(".card-official-action").length,
    officialCaptureCards: officialCaptureCards.length,
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
    containsEvidenceQueue: /Evidence queue/i.test(bodyText),
    containsAgentPromptNav: /Agent Prompt/i.test(bodyText),
    containsOutputSchemaNav: /Output Schema/i.test(bodyText),
    containsReferencesNav: /References/i.test(bodyText),
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
    "official_output_blocker_cards",
    rendered.officialOutputBlockerCards === 21,
    21,
    rendered.officialOutputBlockerCards,
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
      !/unblocked promotion candidates/i.test(rendered.officialCaptureBoardText),
    "board uses row-evidence promotable wording and avoids ambiguous promotion-candidate copy",
    rendered.officialCaptureBoardText,
  );
  addCheck(
    checks,
    "primary_objective_nav_and_queue",
    rendered.containsEvidenceQueue &&
      rendered.containsAgentPromptNav &&
      rendered.containsOutputSchemaNav &&
      rendered.containsReferencesNav,
    "Evidence queue plus Agent Prompt, Output Schema, and References navigation are present",
    {
      containsEvidenceQueue: rendered.containsEvidenceQueue,
      containsAgentPromptNav: rendered.containsAgentPromptNav,
      containsOutputSchemaNav: rendered.containsOutputSchemaNav,
      containsReferencesNav: rendered.containsReferencesNav,
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
      officialCaptureCards: rendered.officialCaptureCards,
      officialCaptureCardsWithRouteArtifact: rendered.officialCaptureCardsWithRouteArtifact,
      officialCaptureCardsWithPublicArtifact: rendered.officialCaptureCardsWithPublicArtifact,
      officialCaptureCardsWithFormalGate: rendered.officialCaptureCardsWithFormalGate,
      officialCaptureCardsWithCaptureStatusSnapshotCommand:
        rendered.officialCaptureCardsWithCaptureStatusSnapshotCommand,
      officialCaptureCardsWithRouteProbeBoundary: rendered.officialCaptureCardsWithRouteProbeBoundary,
      officialCaptureCardsWithPublicPromotionGaps: rendered.officialCaptureCardsWithPublicPromotionGaps,
      localRunReadyCards: rendered.localRunReadyCards,
      localRunScaffoldCards: rendered.localRunScaffoldCards,
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
