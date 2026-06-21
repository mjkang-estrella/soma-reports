# soma-reports

Standalone project for a clean-room, marketplace-style genome report runner.

The goal is to let report authors publish narrowly scoped genome report templates: a prompt, referenced research, required variants or traits, and an execution policy. A user can then run those templates against their own genome data to generate a personal report.

This repository is intentionally separate from `soma-context`. It may later share ideas or data formats, but it starts as an independent product surface.

## Product Idea

Sequencing.com has a useful marketplace pattern: people can choose report-style applications and run them on their own genomic data. `soma-reports` is a clean-room replication of that product pattern, not a copy of any proprietary implementation, code, branding, or marketplace content.

The project should support:

- Report submissions with explicit prompts, references, inputs, and expected output shape.
- Research-backed templates where citations are part of the package, not an afterthought.
- User-controlled genome execution, ideally local-first by default.
- Repeatable report runs so users can see what data and prompt produced a result.
- Clear separation between report author claims, cited evidence, and generated interpretation.

## Report Package Model

A report package should eventually describe:

- `id`: stable report identifier.
- `title`: user-facing report name.
- `description`: concise scope and limitations.
- `author`: submitter identity and contact metadata.
- `references`: papers, guidelines, or public resources used by the report.
- `genome_inputs`: variants, genes, traits, files, or derived features required.
- `prompt`: the report-generation prompt or prompt template.
- `output_schema`: structured result contract.
- `safety_notes`: limits, uncertainty, medical disclaimers, and escalation guidance.
- `version`: immutable package version for reproducible runs.

## Initial MVP

1. Define a portable report package format.
2. Build a small local runner that loads a user's genome file and a report package.
3. Generate a structured report with citations and explicit uncertainty.
4. Add a submission/review workflow for report packages.
5. Add a simple marketplace catalog UI once the package and runner model are stable.

## Privacy Principles

- Raw genome files should stay local unless the user explicitly chooses otherwise.
- Generated reports should record provenance without exposing raw data unnecessarily.
- Report packages should be inspectable before execution.
- The system should distinguish wellness, educational, and medical-risk claims.

## Current Status

Working Vite React + Convex app.

- Convex stores report package metadata, references, prompts, output sections, formal-field coverage, sample report rows, genotype summaries, and synthetic local-run fixtures.
- The frontend renders a marketplace catalog consistent with the original static HTML reference.
- Authenticated marketplace browsing showed 164 visible Sequencing.com marketplace card positions across 3 pages of 75, 75, and 14 cards. The fresh logged-in DOM capture is saved at `reference/catalog/sequencing-authenticated-marketplace-cards-2026-06-21.json`; it includes repeated slugs, so it is treated as slot/count evidence rather than proof of 164 unique recovered names.
- The current seed covers all 164 observed marketplace slots. It has 154 identified names: 150 URL-distinct entries extracted from Sequencing.com's public aggregate marketplace page plus 4 authenticated-only cards.
- The authenticated card capture confirms the 4 named authenticated-only entries already modeled. The remaining 10 authenticated slots are explicit placeholders named `Authenticated marketplace item NN`; they should only be replaced after authenticated page, SSR JSON, screenshot, or detail-page evidence identifies the actual report name and metadata.
- Identified catalog entries now receive conservative background reference packs by report category and title keywords. These packs support safe framing and local evidence lookup; they are not treated as recovered Sequencing.com mock-report bibliographies.
- All 154 identified entries have local-agent prompts, synthetic derived-evidence fixtures, deterministic result examples, references, and output schemas. Authenticated placeholder slots intentionally do not.
- At the current checkpoint, 35 reports are sample-backed formal packages with formal-field coverage, deterministic outputs, local-agent fixtures, and row-level citation bindings from public sample PDFs or directly matched public sample artifacts.
- The Wellness Genetic Guide has a structured package derived from the public sample PDF and authenticated marketplace first-fold evidence.
- Wellness sample rows now carry row-level source resource IDs and binding status, distinguishing sample-PDF-only labels from curated supporting resources. Exact original Article/FDA citations remain pending, so no report is marked fully ready yet.
- `npm run readiness:audit` derives readiness from seed package contents. `sampleBackedFormalReady` counts reports with catalog/sample/prompt/output/fixture/formal-field/reference/citation evidence for local-agent execution; `formalEquivalentReady` is stricter and also requires detail-page parity evidence.
- Raw genome files are not uploaded to or stored in Convex. Local agent tests use derived evidence JSON fixtures.

## Development

```bash
npm install
npm run convex:dev
npm run seed
npm run dev
```

`npm run seed` runs the Convex seed mutation in small batches, then prunes stale
seed-owned rows in a final pass. This keeps the 164-report seed below Convex's
single-function read limit while preserving the full catalog.

Useful checks:

```bash
npm run build
npm audit --json
npx convex dev --once
npm run readiness:audit
npm run agent:validate:all
npm run agent:assert-sync
```

Catalog extraction:

```bash
curl -L https://sequencing.com/apps/app-market/page_view_event/aggregate -o tmp/sequencing-aggregate.html
npm run catalog:extract
npm run catalog:assert
npm run seed
```

## Local Agent Fixtures

Synthetic fixtures live in `fixtures/synthetic/`. They are derived evidence only,
not raw genome data. Matching prompts live in `prompts/`. The current generated
prompt, fixture, and deterministic result set covers all 154 identified
marketplace entries; the 10 authenticated placeholder slots are excluded until
non-duplicate authenticated evidence identifies them.

Build a validated local agent bundle without calling an LLM or uploading raw genome data:

```bash
npm run agent:bundle -- --report wellness-genetic-guide --fixture fixtures/synthetic/wellness-genetic-guide.fixture.json --out tmp/agent-bundles/wellness-genetic-guide.json
```

The report detail page also exposes a **Copy agent input** action for ready
packages. It copies the prompt, synthetic fixture, output sections, formal-field
map, sample rows, genotype summary, references, and source artifacts as one
local-only JSON payload for an agent run.

Validate an agent-produced report JSON against the same local-only privacy and output rules:

```bash
npm run agent:validate -- --report wellness-genetic-guide --fixture fixtures/synthetic/wellness-genetic-guide.fixture.json --result tmp/agent-results/wellness-genetic-guide.report.json --out tmp/agent-bundles/wellness-genetic-guide.json
```

Validate every local package fixture that has a matching prompt:

```bash
npm run agent:validate:all
```

After seeding Convex, verify the local prompt and fixture files still match the
seeded package data:

```bash
npm run agent:assert-sync
```

The bundle includes a deterministic `bundleHash` over the stable prompt, fixture, validation policy, and agent input. `generatedAt` is included for traceability but is intentionally excluded from the hash.
