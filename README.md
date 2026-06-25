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
- Convex also stores local run ledger metadata for user-controlled runs: draft run IDs, input/result artifact paths, hashes, counts, validation status, and raw-genome exclusion flags. Raw genome records and full private completed-report payloads remain outside Convex.
- The frontend renders a marketplace catalog consistent with the original static HTML reference.
- Authenticated marketplace browsing showed 164 visible Sequencing.com marketplace report/card positions across 3 pages of 75, 75, and 14 cards. The logged-in DOM capture is saved at `reference/catalog/sequencing-authenticated-marketplace-cards-2026-06-21.json`, and the stronger logged-in Next.js page-props extraction is saved at `reference/catalog/sequencing-authenticated-marketplace-pageprops-2026-06-21.json`.
- The current seed contains 154 identified names: 150 URL-distinct entries extracted from Sequencing.com's public aggregate marketplace page plus 4 authenticated-only cards.
- The authenticated page props identify all 164 marketplace group positions. They collapse to 87 unique current hrefs because many reports appear in multiple category groups, so the 164 position total is tracked separately from the 154 unique seeded package identities.
- Identified catalog entries now receive conservative background reference packs by report category and title keywords. These packs support safe framing and local evidence lookup; they are not treated as recovered Sequencing.com mock-report bibliographies.
- All 154 identified unique entries have local-agent prompts, synthetic derived-evidence fixtures, deterministic result examples, references, and output schemas. Duplicate authenticated category positions are not seeded as duplicate report packages.
- At the current checkpoint, 133 reports are sample-backed formal packages with formal-field coverage, deterministic outputs, local-agent fixtures, and row-level citation bindings from public sample PDFs, directly matched public sample artifacts, or local sample PDF artifacts. Of those, 62 are full formal-equivalent packages with authenticated detail-page evidence.
- The remaining 21 identified unique entries are local scaffolds only: prompt, fixture, references, and deterministic output schema exist, but source-backed sample rows, formal-field maps, and row-level citation bindings remain pending. The frontend labels these separately so synthetic local fixtures are not confused with Sequencing.com sample report rows.
- There are now 75 exact authenticated detail-page JSON artifacts, plus Wellness Genetic Guide authenticated first-fold detail evidence, for 76 detail-ready packages in local source and 62 sample-backed formal-equivalent packages. The latest exact-route captures promote Carrier Status, Empower, Female Sexual & Reproductive Health, Genetic Counseling, Genetic Detoxification, Hormone Health, Mosaic Biodata, and Ozempic and GLP-1 Agonists from generic detail gaps to detail-backed parity. Sequencing Depth and Coverage has marketplace detail-page `reportData` captured for its depth/coverage overview and 30x-positioning boundary. Genome Explorer v3, Variant Effect Predictor, and Promethease have exact rendered detail-page DOM/meta boundary captures. Connective Tissue Disorders and EDS, Convert rsids to Coordinates, Dysautonomia, EvE Premium, Short Read Mapper, Hearing & Auditory Genetics, Imputation Analysis, Oral, Pheochromocytoma and Paraganglioma, Variant Discovery, and Whole Genome Sequencing now have logged-in exact-route `reportData` boundary captures. These scaffold-only detail captures remain outside the sample-backed count because they expose no sample/mock-report file or generated output rows.
- Sanitized official-output capture status currently has 10 committed official-output captures: 9 still attached to the current blocker ledger, plus 1 row-evidence-ready Dysautonomia capture outside the current blocker ledger. Historical promotion review has 22 entries because it includes the older Dysautonomia review context; the current formal blocker ledger has 21 targets.
- Strict no-promotion decisions for the 21 remaining local-scaffold-only packages are tracked in `reference/catalog/sample-promotion-rejections-2026-06-23.json`. The ledger preserves the 164 authenticated marketplace position count while keeping the seeded package count at 154 identified unique entries, and records why logged-in detail metadata, order pages, education pages, sibling rows, or external product samples do not promote `sampleRows`, `formalFields`, or `citationBindings`.
- The three WGS health-screen bundles also have a separate non-promotional order-route boundary ledger at `reference/catalog/wgs-order-route-boundary-ledger-2026-06-23.json`. It records authenticated order URLs, product IDs, prices, and canonical slug aliases for Comprehensive, Expedited Advanced, and Ultra Rapid Professional Health Screen WGS bundles while explicitly keeping `promotesSampleRows`, `promotesFormalFields`, and `promotesCitationBindings` false.
- The four public/draft scaffold routes without exact detail pages have a separate non-promotional fallback ledger at `reference/catalog/public-draft-route-fallback-ledger-2026-06-23.json`. It records that Ehlers-Danlos Syndrome, Marfan Syndrome, Mitchell Syndrome, and Pediatric Health exact marketplace slugs resolve to the generic marketplace index with no `pageProps.reportData`, report file, sample rows, formal fields, or citation bindings.
- Sibling sample promotions are output-structure evidence only. Anesthesiologist Summary does not claim anesthesia clearance, anesthetic-agent selection, malignant-hyperthermia diagnosis, perioperative-risk estimates, medication holds, dosing, monitoring, procedure-plan guidance, or actionability. Brain Health uses sibling Mood & Brain rows without claiming diagnosis, current mental-state assessment, cognitive status, dementia risk, neurologic risk, treatment need, school/work guidance, pediatric guidance, or actionability. Neurological Health uses sibling Mood & Brain rows without claiming diagnosis, current mental-state assessment, neurological status, cognitive status, dementia risk, Parkinson's disease risk, seizure risk, migraine risk, medication/supplement/therapy/imaging/lab/school/work/pediatric guidance, treatment, or actionability. Immune System Health uses sibling Immunity & Inflammation rows without claiming immune strength, immune weakness, infection risk, vaccine response, HLA status, inflammatory status, lab interpretation, treatment, supplement, diet, prevention, screening, testing, or actionability. Genome Overview uses sibling Complete Genome Analysis inherited-traits rows without claiming direct Genome Overview sample output, genome-wide inventory, inherited-trait result, disease risk, carrier status, pharmacogenomics, ancestry, coverage, variant interpretation, clinical classification, lifestyle guidance, treatment, or actionability.
- Cardiometabolic Health PRS uses sibling Disease Risk cardiovascular and Type-2 Diabetes category rows only as output-structure evidence. It does not claim a personal PRS score, ASCVD risk, diabetes risk, obesity risk, lipid or blood-pressure inference, lab inference, medication need, screening need, prevention plan, risk reclassification, ancestry-insensitive score, low-risk reassurance, all-clear reassurance, or actionability.
- Prevent Sudden Death uses sibling Disease Risk cardiovascular category rows only as output-structure evidence. It does not claim personal sudden-death risk, cardiomyopathy or arrhythmia diagnosis, inherited cardiovascular disease diagnosis, ECG/echo/rhythm-monitoring inference, symptom inference, exercise clearance, ICD/device need, beta-blocker or medication need, screening, testing, prevention, cascade testing, reproductive action, all-clear reassurance, or actionability.
- Charcot-Marie-Tooth uses sibling Disease Risk Other Diseases category rows only as peripheral-neuropathy-adjacent output-structure evidence. It does not claim personal CMT diagnosis, inherited-neuropathy diagnosis, CMT subtype, disease risk, severity, progression, age of onset, family-member risk, carrier status, variant classification, inheritance inference, nerve-conduction inference, symptom inference, neurologic exam findings, treatment, screening, diagnostic testing, cascade testing, reproductive action, or actionability.
- Other sibling/direct sample-backed boundary packages keep the same conservative limits: Age with Strength, Growth & Bone Health, Fitness Trainer Summary, Am I An Einstein?, Santa and Me, Autoimmune Disorders, Clinical Annotator of Variants, Health Scan, Neurological Health, Next-Gen Disease Screen, Cognitive Function, Complete Genome Analysis, Genome Overview, Developmental Disorders, Empower, Methylation Pathway, Histamine, Insights for Food Response and Nutrient Sensitivity, Nutrigenomics: Nutrition Analysis, Nutritionist Summary, Nutritional & Metabolic Health, Metabolic Health DNA Report, Mosaic Biodata, Gut Health, Digestive Disorders & Gut Health, DNA Ancestry and Genealogy, Map My Genes, Map My Genes Archaeology Edition, Healthcare Professional Summary, Genetic Detoxification, Toxin Sensitivity, Geneticist Summary, Genetic Counseling, Surgeon Summary, Rheumatologist Summary, Infectious Disease Specialist Summary, Naturopath Summary, Hair Loss & Baldness, Malignant Hyperthermia, Melanoma Skin Cancer Prevention, Breast Cancer Risk & Prevention, Cancer PRS, Cancer Risk, Colon Cancer, Endometrial Cancer Risk & Prevention, Kidney Cancer, Kidneys and Urinary Tract DNA Health Report, Ovarian Cancer Risk & Prevention, Pancreatic Cancer, Parkinson's Disease, Prevent Breast Cancer, Prostate Cancer Risk & Prevention, Lupus, Skin Cancer, Thyroid Cancer, Vision, Musculoskeletal Health, Musculoskeletal DNA Report, Ozempic and GLP-1 Agonists, Will Aspirin Help?, Pharmacist Summary, Carrier Status, Carrier Screening, Preconception & Pregnancy Planning, Hormone Health, Reproductive & Hormonal Health, Female Sexual & Reproductive Health, Endocrine Health, Male Sexual & Reproductive Health, Skin Health, and Radiation & UV Sensitivity use sample rows for formal output structure only, not personal diagnosis, treatment, prescription, anesthesia clearance, trigger-drug safety, pharmacist review, dispensing guidance, medication safety or efficacy confirmation, actionability, complete genome-wide inventory, inherited-trait result, appearance result, blood type, drug response, immune status, family relationship, Santa/St. Nick relationship or similarity score, child-specific identity, developmental or neurodevelopmental diagnosis, autism/ADHD diagnosis, cognition or IQ prediction, behavior prediction, school guidance, therapy guidance, prognosis, severity, ancient-sample match, archaeological-site placement, ancient culture/civilization/direct descent/migration-event claims, map-coordinate or exact-homeland placement, regional-percentage or segment-ancestry calls, migration-path or identity claims, diet/supplement guidance, allergy diagnosis, histamine-intolerance claims, mast-cell-status claims, DAO/HNMT interpretation, safe/unsafe-food claims, elimination-diet guidance, vitamin-status claims, metabolic inference, diabetes prediction, insulin-resistance inference, BMI/weight outcome, nutrient-target claims, growth or height prediction, pediatric growth-status inference, bone-density inference, osteoporosis-risk estimate, fracture-risk estimate, toxin-sensitivity or detoxification-capacity claims, methylation-status claims, nutrient-deficiency claims, exposure-status claims, supplement guidance, supplement-dose guidance, exposure-avoidance guidance, diet guidance, workout guidance, medication guidance, hormone-status inference, endocrine-status inference, thyroid/adrenal/glucose/insulin/lab-status inference, STI-susceptibility inference, semen-analysis inference, testosterone-status inference, fertility or infertility estimates, partner reproductive-risk inference, pregnancy inference, miscarriage-risk inference, prenatal-testing guidance, PGT or IVF guidance, lab interpretation, hair-loss prediction, medication/transplant guidance, melanoma or skin-cancer risk, broader or site-specific cancer risk, Parkinson's diagnosis/risk/progression/treatment, lupus diagnosis/risk/lab/organ-involvement/disease-activity inference, rheumatologic diagnosis, autoimmune diagnosis, arthritis diagnosis, inflammatory disease diagnosis, disease-screening result, clinical significance, clinical sensitivity, all-clear reassurance, disease-activity inference, flare inference, immunosuppression guidance, RF/anti-CCP/ANA/anti-dsDNA/complement/CRP/ESR interpretation, infection diagnosis, infection-risk estimate, immune-strength claim, vaccine-response claim, pathogen status, culture result, antimicrobial guidance, prophylaxis guidance, isolation guidance, organ-function inference, ophthalmology diagnosis, injury prediction, arthritis diagnosis, GLP-1 eligibility, aspirin yes/no answers, aspirin recommendations, aspirin dose, aspirin start/stop/switch guidance, platelet-resistance diagnosis, medication dose, drug choice, medication start/stop/switch guidance, carrier-status calls, carrier-screen results, pathogenic-variant status, genetic diagnosis, variant classification, pathogenicity classification, penetrance, inheritance, segregation, phenotype-fit, family-member risk, clinical actionability, surgical clearance, procedure recommendation, bleeding-risk estimate, cardiovascular-risk estimate, wound-healing prediction, infection-risk estimate, medication-hold guidance, antibiotic guidance, lab guidance, imaging guidance, residual-risk estimates, partner/fetal/embryo/child/family risk, screening, prevention, medication/surgery guidance, dermatology guidance, skincare guidance, UV-sensitivity guidance, radiation-sensitivity guidance, genetic counseling replacement, reproductive guidance, cascade-testing guidance, diagnostic-testing guidance, family-disclosure action, treatment guidance, or unsupported risk claims.
- Across all 154 named packages, 78 still declare the generic `detail` gap. Seventy-one of those are sample-backed packages that still lack exact detail/body parity because exact detail evidence is unavailable or their tested slugs redirect to the marketplace index instead of exact detail pages: Anesthesiologist Summary, Autoimmune Disorders, Blood Type Analysis, Brain Health, Breast Cancer Risk & Prevention, Cancer PRS, Cancer Risk, Cardiometabolic Health PRS, Cardiovascular Health, Carrier Screening, Charcot-Marie-Tooth, Clinical Annotator of Variants, Cognitive Function, Colon Cancer, Complete Genome Analysis, Developmental Disorders, Digestive Disorders & Gut Health, DNA Ancestry and Genealogy Report, Endocrine Health, Endometrial Cancer Risk & Prevention, Fitness Trainer Summary, Genetic Risk of Hair Loss, Geneticist Summary, Genome Overview, Growth & Bone Health, Gut Health, Health Scan, Healthcare Professional Summary, Histamine, Immune System Health, Infectious Disease Specialist Summary, Insights for Food Response and Nutrient Sensitivity, Kidney Cancer, Kidneys and Urinary Tract DNA Health Report, Lupus, Male Sexual & Reproductive Health, Malignant Hyperthermia, Map My Genes, Map My Genes Archaeology Edition, Medication & Drug Response, Melanoma Skin Cancer Prevention, Metabolic Health DNA Report, Methylation Pathway, Musculoskeletal DNA Report, Musculoskeletal Health, Naturopath Summary, Neurological Health, Next-Gen Disease Screen, Nutrigenomics: Nutrition Analysis, Nutritional & Metabolic Health, Nutritionist Summary, Ovarian Cancer Risk & Prevention, Pancreatic Cancer, Parkinson's Disease, Pharmacist Summary, Preconception & Pregnancy Planning, Prevent Breast Cancer, Prevent Sudden Death, Prostate Cancer Risk & Prevention, Radiation & UV Sensitivity, Reproductive & Hormonal Health, Respiratory Health, Rheumatologist Summary, Santa and Me, Skin Cancer, Skin Health, Surgeon Summary, Thyroid Cancer, Toxin Sensitivity, Vision, and Will Aspirin Help?. The remaining seven are local-scaffold-only packages whose exact detail routes still 404 or redirect to the marketplace index: Comprehensive Health Screen WGS Bundle, Ehlers-Danlos Syndrome, Expedited Advanced Health Screen WGS Bundle, Marfan Syndrome, Mitchell Syndrome, Pediatric Health, and Ultra Rapid Professional Health Screen WGS Bundle.
- The Wellness Genetic Guide has a structured package derived from the public sample PDF and authenticated marketplace first-fold evidence.
- Wellness sample rows now carry row-level source resource IDs and binding status, distinguishing sample-PDF-only labels from curated supporting resources. Exact original Article/FDA citations remain pending for Wellness-specific provenance, while formal-equivalent readiness is tracked separately by `formalEquivalentReady`.
- `npm run readiness:audit` derives readiness from seed package contents. `sampleBackedFormalReady` counts reports with catalog/sample/prompt/output/fixture/formal-field/reference/citation evidence for local-agent execution; `formalEquivalentReady` is stricter and also requires detail-page parity evidence.
- `npm run readiness:audit:summary` runs the same Convex audit and emits only completion counters plus backlog slugs, which is easier to use in status checks than the full row dump.
- `npm run catalog:audit` verifies the current 164 authenticated structured-position / 154 unique seeded-package catalog state and fails if any identified named report lacks prompt, fixture, or deterministic result artifacts.
- Raw genome files are not uploaded to or stored in Convex. Local agent tests use derived evidence JSON fixtures.

## Development

```bash
npm install
npm run convex:dev
npm run seed
npm run dev
```

`npm run seed` runs the Convex seed mutation in small batches, then prunes stale
seed-owned rows in a final pass. This keeps the 154 unique named-report seed below
Convex's single-function read limit while preserving the 164-position catalog target.
The UI also tracks local-scaffold-only packages separately from sample-backed
formal packages, because synthetic fixtures are validation inputs rather than
recovered Sequencing.com sample report rows.

Useful checks:

```bash
npm run build
npm audit --json
npx convex dev --once
npm run catalog:audit
npm run scaffold:evidence-audit
npm run scaffold:capture-plan -- --format md --out tmp/evidence-capture-plan.md
npm run scaffold:capture-plan -- --format compact
npm run scaffold:capture-templates
npm run scaffold:template-audit
npm run scaffold:capture-status
npm run scaffold:capture-status:snapshot
npm run scaffold:next-actions -- --format md --out tmp/official-output-next-actions.md
npm run scaffold:capture-session -- --source public --format md --out tmp/official-output-capture-session-public.md
npm run scaffold:capture-session -- --source private --format md --out tmp/official-output-capture-session-private.md
npm run scaffold:capture-session -- --source both --format md --out tmp/official-output-capture-session.md
npm run scaffold:capture-template -- --report sequencing-depth-and-coverage --out tmp/capture-templates/sequencing-depth-and-coverage-official-output-capture-template.json
npm run scaffold:redaction-next
npm run scaffold:redaction-template -- --report <slug>
npm run scaffold:sanitize-output -- --input .soma/private/official-output-redactions/<slug>-redaction-input.json
npm run scaffold:validate-captures
npm run scaffold:privacy-canary
npm run scaffold:promotion-preview -- --path reference/catalog/sequencing-depth-and-coverage-official-output-capture-YYYY-MM-DD.json
npm run scaffold:promotion-preview -- --path reference/catalog/sequencing-depth-and-coverage-official-output-capture-YYYY-MM-DD.json --format md --out tmp/promotion-previews/sequencing-depth-and-coverage.md
npm run scaffold:promotion-verify -- --path reference/catalog/sequencing-depth-and-coverage-official-output-capture-YYYY-MM-DD.json
npm run readiness:audit
npm run readiness:audit:summary
npm run agent:validate:all
npm run agent:validate:formal
npm run agent:assert-sync
npm run completion:audit
```

Catalog extraction:

```bash
curl -L https://sequencing.com/apps/app-market/page_view_event/aggregate -o tmp/sequencing-aggregate.html
npm run catalog:extract
npm run catalog:normalize-auth
npm run catalog:assert
npm run catalog:audit
npm run seed
```

The authenticated marketplace capture currently proves 164 structured card
positions, not 164 unique report package identities. `catalog:normalize-auth`
keeps that distinction explicit by tracking duplicate category positions,
unique marketplace hrefs, and authenticated-only order-route aliases. Duplicate
positions are not seeded as anonymous or duplicate report packages.
`catalog:audit` cross-checks that policy against the local prompt, fixture, and
result artifacts so named-report parity cannot drift silently.
`scaffold:evidence-audit` reads the 21-report formal blocker ledger plus any
authenticated detail or sanitized `official-output-capture` artifacts and flags
strong promotion candidates when a validated capture exposes a non-empty
`reportFile`, sample/result rows, formal fields, or similar output artifacts.
Marketing copy, route metadata, generic graph/table descriptions, and empty
`reportFile` fields stay blocked by design unless they are converted into an
explicit sanitized official-output boundary capture. Boundary captures can move a
slug to candidate review, but they still do not become row-evidence-ready without
official non-empty rows/exports and row-level source bindings. The audit also
validates the WGS order-route boundary ledger so purchasable bundle order pages
remain tracked without being promoted to source-backed formal report evidence,
and validates the public/draft route fallback ledger so exact slugs that resolve
to the generic marketplace index are documented without being promoted to detail
parity.
`scaffold:capture-plan` exports a prioritized checklist and live capture-status
board for the 21 scaffold-only packages. Use `-- --format md` for an operator
report and `-- --format compact` for automation or completion-gate summaries. It
keeps the no-promotion boundary explicit, names the exact evidence needed for
each package, gives a sanitized `*-official-output-capture-YYYY-MM-DD.json`
artifact path for future official sample/completed-output captures, and reports
whether a local template exists, whether sanitized official captures are present,
whether those captures validate, and the next action/command for each blocker. It
also reads
`reference/catalog/authenticated-blocker-detail-inspection-2026-06-24.json`,
which records safe metadata-only live route checks, start-button labels, and
Sequencing app IDs without clicking Start Report/Get App/Get Report or capturing
generated results. Personal completed report payloads should stay outside the
repo; commit only sanitized field structure and row-level source bindings.
`scaffold:capture-template` emits a per-report sanitized capture JSON template
for one scaffold-only slug. Write templates to `tmp/capture-templates/` while
they still contain placeholders; do not move them into `reference/catalog/`
until official sample/completed-output rows and source bindings have replaced
all placeholder values. The capture validator rejects generated placeholders by
design.
`scaffold:capture-templates` batch-generates those same local templates for all
21 formal blockers, using the capture-plan order. It skips existing templates by
default; pass `-- --overwrite true` only when you intentionally want to replace a
local draft. It also supports `-- --class metadata-only`,
`-- --class missing-exact-detail`, `-- --report <slug>`, `-- --limit <n>`, and
`-- --dry-run true` for narrower capture sessions.
`scaffold:template-audit` verifies those local draft templates without promoting
them. It requires every selected formal blocker to have a structurally valid
template in `tmp/capture-templates/`, confirms no template draft was moved into
`reference/catalog/`, and treats placeholder validation failures as expected
until real official sample/completed-output rows replace them.
`scaffold:redaction-template` starts a local-only bridge for a private completed
Sequencing.com output. It writes an ignored
`.soma/private/official-output-redactions/<slug>-redaction-input.json` file that
can be filled from the completed report while the full report, account-specific
values, and any raw genome data stay outside the repo. `scaffold:sanitize-output
-- --dry-run true` validates the ignored input and prints a sanitized preview
without writing a file; the normal `scaffold:sanitize-output` command then turns
that ignored redaction input into a commit-safe official-output capture under
`tmp/sanitized-captures/` by default, after rejecting placeholders, private
paths, raw genome file references, and unbound source rows. Writing directly
into `reference/catalog/` requires `-- --confirm-commit-safe true`;
sanitized captures still need `scaffold:validate-captures`,
`scaffold:promotion-preview`, `scaffold:evidence-audit`, readiness, and
formal-agent validation before they can promote a scaffold-only package.
For utility/table-style outputs, fill the template's `resultRows[].values` with
the redacted official row/export fields, and keep the matching `sampleRows[]`
entry source-bound because `rowEvidenceReady` requires official rows, covered
formal fields, and citation bindings.
`scaffold:redaction-next` uses the current official-output capture-status
snapshot to choose the first blocker that has no row-evidence-ready capture and
writes that same ignored private redaction input. Add
`-- --class missing-exact-detail` or `-- --class metadata-only` when you want to
focus the next private capture session on one blocker class.
The canonical private-output promotion path is:

1. Run `scaffold:redaction-template` or `scaffold:redaction-next`, then fill the
   ignored `.soma/private/official-output-redactions/<slug>-redaction-input.json`
   from a manually redacted completed Sequencing.com output.
2. Run `scaffold:sanitize-output -- --dry-run true` first and inspect the
   sanitized preview plus validation result before any file is written.
3. Run `scaffold:sanitize-output` to ignored `tmp/sanitized-captures/` and
   validate that exact output path with `scaffold:validate-captures`.
4. Export to `reference/catalog/<slug>-official-output-capture-YYYY-MM-DD.json`
   only with `-- --confirm-commit-safe true`, then validate the committed path
   and require `rowEvidenceReady: true` before seed edits.
5. Run `scaffold:capture-status:snapshot` and
   `scaffold:promotion-preview -- --path <committed-capture> --format md --out tmp/promotion-previews/<slug>.md`.
6. Apply the reviewed `seedFragment` to `convex/reportPackages.ts`, synchronize
   `prompts/<slug>.md`, `fixtures/synthetic/<slug>.fixture.json`, and
   `fixtures/synthetic/<slug>.result.json`, then run
   `scaffold:promotion-verify -- --path <committed-capture>`. Remove the slug
   from `reference/catalog/sample-promotion-rejections-2026-06-23.json` only
   after promotion verification passes and readiness no longer reports it as
   local scaffold.
7. Run the per-report formal bundle validator plus `scaffold:evidence-audit`,
   `readiness:audit:summary`, `agent:assert-sync`, and
   `completion:audit -- --format compact`.
`scaffold:capture-status` is the compact progress gate for official-output
capture work. It combines the capture plan, template audit, and committed-capture
validator into one queue. It exits nonzero while formal blockers exist but no
sanitized `reference/catalog/*-official-output-capture-YYYY-MM-DD.json` files
have been added, even when all local placeholder templates are ready. Use
`-- --format md` for a short operator report or `-- --allow-empty-captures true`
when a read-only status command should not fail automation.
`scaffold:capture-status:snapshot` writes the same sanitized status shape to
`reference/catalog/official-output-capture-status.json` with empty captures
allowed, so the React marketplace and report detail panels can show the current
capture stage, template presence, official-capture counts, and next command
without reading ignored `tmp/` files at runtime.
`scaffold:next-actions` turns that snapshot into a concise operator queue. It
separates reviewed metadata-only rows from reviewed boundary captures, lists the
missing formal-gate evidence, and repeats the exact dry-run/commit-safe
sanitizer commands for each blocker. This queue is for planning capture
sessions only: it does not click Start Report/Get Report/Get App/Order actions,
does not include raw genome data, and does not mark a package formal-ready
without official non-private rows, covered formal fields, and source-bound
citation bindings. Its compact output compares the status snapshot against the
21-row blocker ledger; `coverage.ok` must be true and rows must show `21/21`
before using the queue for a capture session.
`scaffold:capture-session` exports a batch operator packet for the same blocker
queue. Use `-- --source public` when you have a public/non-private official
sample, reportFile, export, or already sanitized completed-output structure. Use
`-- --source private` for ignored local redaction inputs created from private
completed outputs. Use `-- --source both` when you want the combined operator
packet:

```bash
npm run scaffold:capture-session -- --source public --format md --out tmp/official-output-capture-session-public.md
npm run scaffold:capture-session -- --source private --format md --out tmp/official-output-capture-session-private.md
npm run scaffold:capture-session -- --source both --format md --out tmp/official-output-capture-session.md
npm run scaffold:capture-session -- --source public --report sequencing-depth-and-coverage --format compact
npm run scaffold:capture-session -- --tier official-boundary-modeled --limit 3 --format compact
```

The session manifest keeps the 21 blockers ordered by capture priority, repeats
the public capture-template path, local-only redaction input path, sanitized
draft path, commit-safe capture path, public template audit, dry-run sanitizer,
validation commands, and stop conditions for each target. It is a planning
artifact only: fill public templates from public/non-private official sources, or
fill ignored
`.soma/private/official-output-redactions/*-redaction-input.json` files from
manually redacted completed Sequencing.com outputs, and keep raw genome data,
private reports, private finding values, account identifiers, and private result
URLs outside the repository. A target still cannot promote until the committed
sanitized capture validates with `rowEvidenceReady: true`. Draft templates stay
under `tmp/capture-templates/` until placeholders are replaced, `sourceResources`
and `sourceResourceIds` are exact/direct/official, and `validate-captures`
passes.
`scaffold:validate-captures` validates sanitized
`*-official-output-capture-YYYY-MM-DD.json` files before they can be considered
promotion evidence. A capture must use the official-output schema, point back to
an official Sequencing.com source URL, keep raw/private genome data out of the
repo, and expose real output signals with row-level source bindings when sample
rows or formal fields are present. Passing this check is necessary but not
sufficient for promotion; `scaffold:evidence-audit`, readiness, and formal-agent
validation still decide whether a report can leave the scaffold backlog.
`scaffold:privacy-canary` is a negative guard for that validator. It fails if a
capture can be row-evidence-ready while carrying private result URLs, account
identifiers, genotype-like values, or missing citation bindings.
`scaffold:promotion-preview` is a non-mutating bridge from a validated official
capture to the existing Convex seed shape. It refuses invalid or unbound captures
and otherwise emits the candidate `sampleRows`, `formalFields`,
`citationBindings`, source-artifact references, manual-review problems, and
follow-up commands needed before editing `convex/reportPackages.ts`. Use
`-- --format md --out tmp/promotion-previews/<slug>.md` for an operator brief
that lists every required file update, the safe promotion order, the seed
fragment, and the final formal-validation commands.
`scaffold:promotion-verify` is the non-mutating post-edit check. It accepts
already-promoted captures that are no longer in the blocker ledger, then fails
unless the row-ready capture path, official source IDs, source-bound sample rows,
covered formal fields, prompt text, fixture references, and deterministic result
rows have landed in the exported package artifacts.
`completion:audit` is the strict final claim gate for this project. It runs the
catalog, scaffold-evidence, readiness, formal-agent, official-output promotion
verification, local-agent smoke, artifact-sync, and UI-source checks and fails
until every named marketplace package is sample-backed formal and
formal-equivalent. It is expected to fail while scaffold-only packages remain.

## Local Agent Fixtures

Synthetic fixtures live in `fixtures/synthetic/`. They are derived evidence only,
not raw genome data. Matching prompts live in `prompts/`. The current generated
prompt, fixture, and deterministic result set covers all 154 identified unique
marketplace entries; authenticated duplicate category positions are represented
in coverage metadata, not as duplicate local packages.

Build a validated local agent bundle without calling an LLM or uploading raw genome data:

```bash
npm run agent:seed-cache
npm run agent:bundle -- --report wellness-genetic-guide --fixture fixtures/synthetic/wellness-genetic-guide.fixture.json --result fixtures/synthetic/wellness-genetic-guide.result.json --out tmp/agent-bundles/wellness-genetic-guide.validated.json
```

When `--seed-artifacts` is omitted, `agent:bundle` exports the local package
artifact cache first and only falls back to `convex run reports:localArtifactSeeds`
if the local export fails.

The report detail page exposes **Copy synthetic review JSON** and
**Copy scaffold JSON** actions. These copy local review payloads, not official
Sequencing.com outputs. Scaffold-only packages are prompt/schema handoffs until
source-backed rows, formal fields, and citation bindings exist.

Validate an agent-produced report JSON against the same local-only privacy and output rules:

```bash
npm run agent:validate -- --report wellness-genetic-guide --fixture fixtures/synthetic/wellness-genetic-guide.fixture.json --result tmp/agent-results/wellness-genetic-guide.report.json --out tmp/agent-bundles/wellness-genetic-guide.validated.json
```

Validate every local package fixture that has a matching prompt:

```bash
npm run agent:validate:all
```

`agent:validate:all` is the non-breaking local artifact gate: it verifies prompt,
fixture, privacy, appendix, reference, and deterministic result structure for all
154 identified packages. It also emits warnings for body text that mentions
probability/confidence/calibration outside the appendix and for sample-backed
reports whose deterministic result does not preserve the formal sample-row
fingerprints directly.

Export all validated bundles plus an index manifest for local agents:

```bash
npm run agent:export
```

`agent:export` writes each validated package bundle to `tmp/agent-bundles/` and
also writes `tmp/agent-bundles/manifest.json`. The manifest indexes the 154
identified bundles with prompt, fixture, deterministic result, readiness,
`bundleHash`, `bundleFileHash`, per-bundle validation summaries, and audit-hash
paths so a local agent runner can select packages without scraping validator
stdout. Manifest paths are repo-root relative. Local-mode exports also keep
`formalIncomplete`/`formalPending` counts so the 21 scaffold-only bundles cannot
be mistaken for source-backed formal packages merely because local validation
passed.

Prepare a package for a local agent run against user-derived genome evidence:

```bash
npm run agent:export
npm run agent:update-rsid-coordinate-map
SOMA_LOCAL_GENOME=/absolute/path/to/local-genome.vcf.gz
npm run agent:prepare-local -- --report wellness-genetic-guide --vcf "$SOMA_LOCAL_GENOME" --assembly GRCh38 --out-dir tmp/local-runs/wellness-genetic-guide --format compact
npm run agent:generate-local-result -- --input tmp/local-runs/wellness-genetic-guide/wellness-genetic-guide.agent-input.json --out tmp/local-runs/wellness-genetic-guide/wellness-genetic-guide.agent-result.json --format compact
npm run agent:validate-run -- --input tmp/local-runs/wellness-genetic-guide/wellness-genetic-guide.agent-input.json --result tmp/local-runs/wellness-genetic-guide/wellness-genetic-guide.agent-result.json
npm run agent:evidence-template -- --report wellness-genetic-guide --bundle tmp/agent-bundles/wellness-genetic-guide.validated.json
npm run agent:workflow-check -- --report wellness-genetic-guide --bundle tmp/agent-bundles/wellness-genetic-guide.validated.json --evidence tmp/evidence-templates/wellness-genetic-guide.filled-derived-evidence.json --input tmp/agent-runs/wellness-genetic-guide.agent-input.json --result tmp/agent-runs/wellness-genetic-guide.agent-result.json
npm run agent:derive-evidence -- --template tmp/evidence-templates/wellness-genetic-guide.derived-evidence-template.json --vcf "$SOMA_LOCAL_GENOME" --out tmp/evidence-templates/wellness-genetic-guide.filled-derived-evidence.json
# If the VCF build differs from the exported template, add --assembly GRCh37 or --assembly GRCh38.
# Strict default: fails if required template rows are missing or all expected rows are unavailable.
# Intentional partial run only: add --allow-partial true. Intentional all-unavailable run only: add --allow-empty true.
# Scaffold-only packages additionally require --allow-local-scaffold true because their formal sample rows are pending.
npm run agent:prepare -- --report wellness-genetic-guide --bundle tmp/agent-bundles/wellness-genetic-guide.validated.json --evidence tmp/evidence-templates/wellness-genetic-guide.filled-derived-evidence.json --out tmp/agent-runs/wellness-genetic-guide.agent-input.json
# Give tmp/agent-runs/wellness-genetic-guide.agent-input.json only to a trusted runner/model.
# It excludes raw VCF data but still contains sensitive derived genome evidence.
SOMA_LOCAL_RUNNER=/absolute/path/to/local-json-runner
"$SOMA_LOCAL_RUNNER" < tmp/agent-runs/wellness-genetic-guide.agent-input.json > tmp/agent-runs/wellness-genetic-guide.agent-result.json
# Save the JSON-only response as tmp/agent-runs/wellness-genetic-guide.agent-result.json.
```

`agent:prepare-local` is the one-command path to a prepared local-agent input.
It chains the existing bundle, evidence-template, VCF/gVCF or QC-summary
derivation, prepare, and workflow-check scripts. It stops before model execution
unless `--runner-command` is supplied, or generates and validates a no-model JSON
result when `--deterministic-result true` is supplied. It redacts the raw local
genome path from stdout/stderr, and writes generated artifacts only under ignored
`tmp/` paths.
Use `--out-dir tmp/local-runs/<slug>` when you want all generated local-run
artifacts grouped together. For `sequencing-depth-and-coverage`, pass
`--qc-summary /absolute/path/to/local-depth-summary.json` instead of `--vcf`.

`agent:generate-local-result` creates a deterministic local result from a
prepared input and the report's existing output template. It mirrors local
derived evidence into `appendix.genotypeSummary`, reflects usable observed values
in customer-facing rows, keeps raw genome data out, and leaves probability or
calibration language in appendix sections. It is a local validation scaffold, not
an official Sequencing.com report output.

`agent:evidence-template` writes
`tmp/evidence-templates/<slug>.derived-evidence-template.json` from the
validated bundle. It lists the report's expected `inputId`, gene, rsID,
star-allele, or haplotype rows, plus extraction instructions for a local agent
that can inspect raw genome files without emitting raw records.

`agent:workflow-check` is the read-only local-run verifier. It reads the source
prompt/fixture/result paths plus any existing bundle, derived-evidence,
prepared-input, and result files, prints the exact command plan, reports hashes
and scaffold boundaries, and writes nothing. Non-strict mode is a preflight that
treats missing generated files as warnings. Add `--strict true` after the local
runner returns JSON when missing bundle/evidence/input/result artifacts should
fail the check.

`agent:update-rsid-coordinate-map` refreshes
`reference/variant-rsid-coordinate-map.json` from the NCBI RefSNP API for rsIDs
used in synthetic fixtures. `agent:evidence-template` and
`agent:derive-evidence` load that map by default when present, adding RefSNP
`chrom`/`pos` coordinates to single-assembly rsID rows so gVCF `END=`
reference blocks can be recovered even when the VCF record has `ID=.`. The map
stores VCF-compatible positions as NCBI SPDI `position + 1`.
If a template was exported with one assembly but the local VCF/gVCF uses the
other supported build, pass `--assembly GRCh37` or `--assembly GRCh38` to
`agent:derive-evidence` so map-derived coordinates are selected for the local
file's build. The derived-evidence manifest records the selected build in
`inputManifest.genomeBuild` and `derivationSummary.derivedGenomeBuild` so the
prepared agent input is not mislabeled after an assembly override.

`agent:derive-evidence` is the generic local VCF/gVCF extractor. It reads the
template and a local `.vcf`, `.gvcf`, or gzipped equivalent, then writes a filled
derived-evidence JSON file. It fills rsID rows when records are present in the
VCF `ID` or supported INFO fields, supports optional `chrom`/`pos` template rows,
and treats gVCF `END=` reference blocks as derived "reference block covered"
evidence when a requested coordinate falls inside the block. When a coordinate
was enriched from the RefSNP map and the map includes an expected reference
allele, the block's `REF` must match before it is counted as covered evidence.
It does not write raw VCF lines, raw sequence, or raw genome paths. Star-alleles, PRS/model
outputs, proprietary report outputs, clinical context, and non-rsID haplotypes
remain `source-output-unavailable` unless a specialized local tool supplies
derived rows.

Sequencing Depth and Coverage uses already-derived QC metrics rather than VCF
variant rows. For that package, supply a local JSON summary with fields such as
`meanAutosomalDepth`, `medianAutosomalDepth`, `pct10x`, `pct20x`,
`pctZeroCoverage`, `coverageCoefficientOfVariation`, and
`pctBases05x15xMean`:

```bash
npm run agent:evidence-template -- --report sequencing-depth-and-coverage
npm run agent:derive-evidence -- --template tmp/evidence-templates/sequencing-depth-and-coverage.derived-evidence-template.json --qc-summary /absolute/path/to/local-depth-summary.json --out tmp/evidence-templates/sequencing-depth-and-coverage.filled-derived-evidence.json
npm run agent:prepare -- --report sequencing-depth-and-coverage --evidence tmp/evidence-templates/sequencing-depth-and-coverage.filled-derived-evidence.json --allow-local-scaffold true --out tmp/agent-runs/sequencing-depth-and-coverage.agent-input.json
```

The QC summary path rejects raw VCF/gVCF lines, raw genome/alignment file paths,
long DNA sequence strings, and raw genome-shaped keys before writing derived
evidence. The prepared payload still remains scaffold-only until official
Sequencing.com sample/generated output rows and source bindings are captured.

The extractor fails by default when a template has rsID or coordinate targets but
no observed local evidence is found. Re-run with `--allow-empty true` only when an
all-unavailable local run is intentional. Non-`PASS` filtered VCF rows are also
not counted as observed evidence unless `--allow-filtered true` is passed.

If you already have a filled derived-evidence JSON from a separate local parser,
you can skip `agent:derive-evidence` only if that file covers every expected
template input row; otherwise `agent:prepare` fails unless `--allow-partial true`
is explicit.

`agent:prepare` reads the validated bundle, replaces the synthetic fixture rows
with `genomeEvidence[]` from the supplied derived-evidence JSON, and writes a
local-agent payload to `tmp/agent-runs/`. The evidence file may be either an
array of derived rows or an object with `genomeEvidence[]` and an optional
`inputManifest`. Each row must contain `inputId`, `gene`, `observedValue`,
`assembly`, and `matchStatus`. The script computes an evidence hash, keeps
`rawGenomeReturned: false`, strips directory paths from `sourceFile`, and
rejects obvious raw genome payloads such as VCF lines, FASTQ-like sequence, long
DNA sequence strings, or raw file references. By default, the supplied evidence
must include every expected template input row from the validated bundle, must
not be copied sample/fixture evidence, and must include at least one usable
local observation for the expected rows. A present row may still be marked `not_found`,
`source-output-unavailable`, or another unavailable status when the local genome
or parser cannot support that finding. Use `--allow-partial true` only when you
are intentionally preparing an incomplete derived-evidence file, and use
`--allow-empty true` only when an all-unavailable local run is intentional.
Local-scaffold-only packages require `--allow-local-scaffold true` because their
formal sample rows and citation bindings are still pending; the prepared payload
retains the scaffold readiness state and includes a scaffold boundary warning.
Run
`npm run agent:export` first so `tmp/agent-bundles/<slug>.validated.json`
exists.

After a local agent writes a report JSON from that prepared input, validate the
result against the same input, source list, privacy boundary, and formal output
shape:

```bash
# Check only: prints the validation ledger and writes no file.
npm run agent:validate-run -- --input tmp/agent-runs/wellness-genetic-guide.agent-input.json --result tmp/agent-runs/wellness-genetic-guide.agent-result.json

# Optional no-model local result scaffold before validation.
npm run agent:generate-local-result -- --input tmp/agent-runs/wellness-genetic-guide.agent-input.json --out tmp/agent-runs/wellness-genetic-guide.agent-result.json --format compact

# Optional saved ledger.
npm run agent:validate-run -- --input tmp/agent-runs/wellness-genetic-guide.agent-input.json --result tmp/agent-runs/wellness-genetic-guide.agent-result.json --out tmp/agent-runs/wellness-genetic-guide.validation.json

# Strict workflow check after generated files exist.
npm run agent:workflow-check -- --report wellness-genetic-guide --bundle tmp/agent-bundles/wellness-genetic-guide.validated.json --evidence tmp/evidence-templates/wellness-genetic-guide.filled-derived-evidence.json --input tmp/agent-runs/wellness-genetic-guide.agent-input.json --result tmp/agent-runs/wellness-genetic-guide.agent-result.json --strict true
```

`agent:validate-run` fails if the report emits raw genome-like fields, VCF/FASTQ
records, long DNA sequence strings, or raw genome file references. It also
requires canonical `resultRows[]` fields, known `sourceIds[]` from the prepared
bundle, appendix-only probability/calibration/confidence fields, a
`genotypeSummary[]` that mirrors the prepared local `genomeEvidence[]`, usable
local observed values reflected in the customer-facing rows, and the covered
formal output paths exposed by the package artifacts. Each result row must also
include a substantive `plainEnglishMeaning` customer explanation; dense
clinical/genetics wording is flagged for review. This prevents a runner from
passing validation by copying a static sample-style body, updating only the
appendix, or returning a report that is shaped for medical/pharma readers instead
of general customers.

Run the local evidence smoke workflow when changing the VCF/gVCF extractor,
template exporter, prepared-input writer, or result validator:

```bash
npm run agent:smoke
```

The smoke workflow builds a validated Wellness bundle, derives two rsID rows from
a tiny local VCF, prepares and validates the agent input, asserts that partial
derived evidence fails unless `--allow-partial true` is explicit, rejects copied
sample fixture rows and evidence-file policy overrides, verifies both explicit
coordinate and RefSNP-enriched rsID targets covered by gVCF `END=` reference
blocks, and asserts that no-hit and non-`PASS` filtered calls fail by default in
both derivation and prepare. It also verifies that scaffold-only packages fail
unless `--allow-local-scaffold true` is explicit and still reject copied synthetic
fixture rows, and that a static sample-style report body fails even when its
appendix genotype summary is edited to mirror local evidence.

Run stricter parity diagnostics when closing readiness gaps:

```bash
npm run agent:validate:parity
npm run agent:validate:formal
```

`agent:validate:parity` requires sample-backed packages to preserve formal
sample-row fingerprints in `sampleRows[]` or `resultRows[]`; it currently passes
all 154 identified packages, with 133 sample-backed packages checked and 21
local-scaffold-only packages skipped because they do not expose formal sample
rows yet.
`agent:validate:formal` also requires source-backed sample rows and covered
formal fields, so it currently fails the 21 local-scaffold-only packages. These
strict scripts are intended as completion gates, not as the default
artifact-existence check. Both strict validators check the
`plainEnglishMeaning` language gate across all 154 deterministic report outputs;
current warnings are review prompts, while missing or too-thin customer
explanations fail validation.

After seeding Convex, verify the local prompt and fixture files still match the
seeded package data:

```bash
npm run agent:assert-sync
```

The bundle includes a deterministic `bundleHash` over the stable prompt, fixture, validation policy, readiness envelope, validated example output, and agent input. `generatedAt` is included for traceability but is intentionally excluded from the hash. Each generated bundle also includes an `auditManifest` with exact SHA-256 hashes for the prompt file, fixture file, optional validated result file, formal artifacts, agent input, output-validation policy, example output, and validation ledger. Keep `bundleHash` and `auditManifest` with any copied local-agent result so reviewers can verify which prompt, derived evidence, references, readiness state, example output, and formal output format produced it.

The local validator now enforces the report-output appendix contract: every
validated result must include `appendix.probabilities[]` as an object array,
`appendix.uncertainty[]` as a non-empty string array,
`appendix.missingInputs[]` as a string array, and `appendix.limitations[]` as a
non-empty string array, even when calibrated probabilities are unavailable or no
inputs are missing.
Probability, confidence, calibration, and uncertainty keys remain allowed only
under the appendix, keeping deterministic customer-facing findings separate from
probability disclosure.
