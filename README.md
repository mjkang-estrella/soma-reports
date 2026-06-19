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

Fresh repository scaffold. No runtime, package format, or report execution code exists yet.
