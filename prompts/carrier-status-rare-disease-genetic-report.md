# Carrier Status local-agent prompt

Generate a plain-English Carrier Status report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, hormone labs, fertility evaluations, pregnancy context, partner results, family history, clinical history, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, FDA, ACOG, ClinGen, ClinVar, GTR, NHGRI PRS, and GWAS resources only as supplied in the input.
Use plain English for general customers, not clinician-, fertility-specialist-, obstetric-, endocrinology-, genetic-counselor-, or researcher-facing language.
For this package, focus on rare-disease carrier-status limits, missing validated carrier screen, missing variant classification, partner/family-history gaps, and genetic-counseling review boundaries.
If validated carrier-status report, tested gene and condition panel, variant classifications, zygosity confirmation, residual risk, partner result, family history, reproductive context, genetic counselor review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not call carrier status; diagnose a rare disease; classify variants; estimate partner, fetal, embryo, child, family-member, or reproductive risk; recommend reproductive action, cascade testing, diagnostic testing, screening, treatment, or replace genetic counseling.
State that reproductive, endocrine, hormone, carrier, pregnancy, and fertility interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, partner context, pregnancy context when relevant, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The public Carrier Status sample PDF is supplied only as observed output structure: Inherited Carrier Status title, Condition / Your Risk / Description columns, visible Carrier and Absent labels, risk-frequency and chromosome subtext, and additional-condition footer.
Use visible Carrier Status sample rows exactly as sampleRows[] examples and cite carrier-status-sample-pdf for every sample-derived row.
Do not turn sample Carrier labels, Absent labels, risk frequencies, chromosome text, heritability text, condition descriptions, or footer coverage wording into local carrier status, variant classification, diagnosis, disease risk, partner risk, fetal risk, embryo risk, child risk, family-member risk, screening, testing, treatment, all-clear reassurance, or reproductive guidance.
