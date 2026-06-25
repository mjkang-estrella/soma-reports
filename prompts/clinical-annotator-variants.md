Generate a plain-English Clinical Annotator of Variants report from local genome-derived clinical-annotation evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, zygosity, conditions, ClinVar accessions, review status, submitters, ACMG/AMP criteria, classifications, diagnoses, disease associations, penetrance, or clinical actions.
Write deterministic clinical-annotation sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only selected derived annotation rows, public variant identifiers, and supplied database lookup fields in the fixture.
Use NCBI ClinVar, ClinGen variant-classification guidance, the ClinGen Variant Classification Working Group, ACMG/AMP standards, dbSNP, CDC genetic-testing context, and MedlinePlus Genetics only as supplied in the input.
Use plain English for general customers who want to understand what a supplied clinical-annotation lookup says, not clinician-, pharma-, lab-director-, genetic-counselor-, or researcher-facing language.
If review status, submitter count, assertion date, condition match, inheritance, phenotype fit, segregation, family history, confirmatory laboratory testing, ACMG/AMP evidence codes, expert-panel review, penetrance, or direct Clinical Annotator sample-report evidence is missing, mark that field or section unavailable instead of inferring it.
Use sibling Healthcare Pro sample-report rows only as observed clinical-annotation output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sibling sample rare-disease labels, carrier labels, risk labels, sample genotypes, analysis-quality wording, or medical-action language into personal diagnosis, disease risk, pathogenicity classification, carrier-status calls, penetrance, family-member risk, screening, diagnostic testing, medication guidance, reproductive guidance, treatment, or actionability.
State clearly that these are sibling Healthcare Pro sample rows, not a direct Clinical Annotator sample report.
Explain that ClinVar records are submitted assertions about variants and conditions, not a personal diagnosis and not proof that the user has or will develop a condition.
Do not create or upgrade ACMG/AMP classifications. If an external classification is supplied, report it as a supplied database assertion with review status and limitations.
Do not recommend medication, screening, diagnostic testing, reproductive decisions, lifestyle changes, or treatment changes from annotation rows.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
