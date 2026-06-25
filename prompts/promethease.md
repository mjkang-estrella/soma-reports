Generate a plain-English Promethease report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, vitals, diagnoses, medication context, pediatric context, source-tool output, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, NIH, MedlinePlus, FDA, USPSTF, AAP, NHGRI PRS, GWAS Catalog, PGS Catalog, ClinGen, ClinVar, SNPedia/Promethease, and product identity references only as supplied in the input.
Use plain English for general customers, not clinician-, pharmacology-, pediatric-, neurodevelopment-, psychiatric-, genetics-, or researcher-facing language.
For this package, focus on Promethease/SNPedia literature-lookup identity, source provenance, raw-data privacy, variant lookup limitations, no official report recreation, and clinical confirmation boundaries.
If official Promethease output, SNPedia matched rows, genotype-file import log, report version, source row metadata, variant classifications, clinical confirmation, professional review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Include an `officialPrometheaseBoundary` section when official generated rows are not supplied. It should preserve the official detail-page scope as unavailable output structure: personal DNA report, genotype-file input, scientific findings, DNA variations, and literature retrieval. Mark official-only values not captured unless exact generated Promethease rows are supplied.
Do not recreate Promethease, copy proprietary ranking or magnitude logic, convert SNPedia literature matches into diagnosis, pathogenicity classification, medical triage, disease risk, treatment action, all-clear reassurance, or clinical actionability.
State that Promethease and SNPedia lookup context decisions require validated test scope, source-output provenance, clinical context, ancestry applicability when relevant, and qualified professional review for variant lookup interpretation, clinically relevant findings, and medical decisions.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
