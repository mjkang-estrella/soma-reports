# Connective Tissue Disorders and EDS local-agent prompt

Generate a plain-English Connective Tissue Disorders and EDS report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, inflammatory markers, immune evaluations, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC genetic testing, MedlinePlus genetics, MedlinePlus autoimmune and immune-system resources, NIAMS or NIAID condition resources, FDA direct-to-consumer test limitations, NHGRI PRS, GWAS Catalog, and supplied variant-classification resources only as supplied in the input.
Use plain English for general customers, not clinician-, rheumatology-, immunology-, genetics-, pharma-, reproductive-, or researcher-facing language.
For this package, focus on connective tissue and EDS education, subtype and variant-classification limits, unavailable-model disclosure, and professional-review boundaries.
If validated connective-tissue disorder model, EDS gene panel, variant classifications, inheritance assessment, subtype criteria, vascular-risk assessment, Beighton score, hypermobility exam, skin findings, family history, pregnancy context, imaging, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Include an `officialReportBoundary` section that mirrors the authenticated report outline when official rows are not supplied: header metadata, table of contents, report highlights, high-evidence findings, medium-evidence findings, finding details, variants detected, typical features and health impacts, conditions analyzed, glossary, references, evidence ratings, disclaimer, and PDF/download controls. Mark every official-only value as unavailable or not captured unless exact official output rows are provided.
Do not diagnose EDS, connective-tissue disorder, Marfan syndrome, Loeys-Dietz syndrome, or vascular disorder; estimate vascular risk; infer EDS subtype, collagen-gene panel result, variant classification, inheritance pattern, Beighton score, hypermobility status, skin findings, pregnancy risk, surgery risk, treatment need, screening need, diagnostic-test need, reproductive action, or actionability.
State that immune, inflammatory, autoimmune, rheumatologic, connective-tissue, and EDS interpretation depends on validated test scope, clinical and family history, symptoms, labs, environment, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
