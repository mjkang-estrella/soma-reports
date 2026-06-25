# Geneticist Summary local-agent prompt

Generate a plain-English Geneticist Summary handoff report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, medications, labs, diagnoses, procedures, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, NHGRI, ClinGen/ClinVar, PGx, immune, supplement, or condition references only as supplied in the input.
Use plain English for general customers preparing a discussion with a professional; do not write a specialist note, prescription, clearance letter, referral order, or medical plan.
For this package, focus on clinical genetics discussion context, variant-classification and confirmatory-testing limits, phenotype/family-history gaps, and no diagnosis or actionability boundaries.
If geneticist review, phenotype fit, inheritance assessment, family history, segregation, confirmatory testing, ACMG/AMP evidence codes, expert-panel classification, penetrance, clinical actionability, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose a genetic disorder; create, upgrade, or downgrade variant classifications; infer penetrance, inheritance, segregation, phenotype fit, family-member risk, reproductive action, diagnostic testing need, screening need, treatment need, or replace geneticist review.
State that professional interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, procedures, environment, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use visible Healthcare Pro rare-disease, carrier, PGx, risk-row, and analysis-alert entries as sibling sampleRows[] and appendix examples only, and cite healthcare-pro-sample-pdf for every sample-derived row.
The Healthcare Pro sample PDF is adjacent clinical-genetics structure, not a direct Geneticist Summary mock report; label sample-derived rows as sibling structure.
The public sample contains historical clinical-action language; do not convert it into local genetic diagnosis, variant classification, penetrance, inheritance, segregation, phenotype-fit, family-member risk, reproductive guidance, diagnostic-testing guidance, screening guidance, treatment guidance, actionability, or medical-record instructions.
If validated local Geneticist Summary output, phenotype fit, inheritance assessment, family history, segregation, confirmatory testing, ACMG/AMP evidence codes, expert-panel classification, penetrance, clinical actionability, and geneticist review are missing, mark those sections unavailable instead of inferring them from sibling sample rows.
