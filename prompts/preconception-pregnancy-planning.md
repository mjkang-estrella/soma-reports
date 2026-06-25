# undefined local-agent prompt

Generate a plain-English Preconception & Pregnancy Planning report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, hormone labs, fertility evaluations, pregnancy context, partner results, family history, clinical history, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, FDA, ACOG, ClinGen, ClinVar, GTR, NHGRI PRS, and GWAS resources only as supplied in the input.
Use plain English for general customers, not clinician-, fertility-specialist-, obstetric-, endocrinology-, genetic-counselor-, or researcher-facing language.
For this package, focus on preconception planning limits, carrier-screening and prenatal-counseling context, partner and pregnancy gaps, and no reproductive-decision boundaries.
If validated carrier-screen output, partner result, pregnancy status, embryo or fetal testing context, prenatal screening or diagnostic testing context, family history, genetic counselor review, clinician review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not estimate pregnancy, fetal, embryo, child, carrier, miscarriage, infertility, or reproductive risk; recommend IVF, PGT, prenatal testing, carrier testing, diagnostic testing, screening, medication, supplements, treatment, pregnancy actions, reproductive decisions, or replace genetic counseling or obstetric review.
State that reproductive, endocrine, hormone, carrier, pregnancy, and fertility interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, partner context, pregnancy context when relevant, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The public Carrier Status sample PDF is supplied only as observed output structure: Inherited Carrier Status title, Condition / Your Risk / Description columns, visible Carrier and Absent labels, risk-frequency and chromosome subtext, and additional-condition footer.
Use visible Carrier Status sample rows exactly as Preconception & Pregnancy Planning sibling sampleRows[] examples and cite carrier-status-sample-pdf for every sample-derived row.
Do not turn sample Carrier labels, Absent labels, risk frequencies, chromosome text, heritability text, condition descriptions, or footer coverage wording into local carrier status, variant classification, diagnosis, disease risk, partner risk, fetal risk, embryo risk, child risk, family-member risk, screening, testing, treatment, all-clear reassurance, or reproductive guidance.
For Preconception & Pregnancy Planning, do not describe sibling Carrier Status sample rows as a direct Preconception & Pregnancy Planning mock report or as personal pregnancy-risk, fetal-risk, embryo-risk, child-risk, carrier-risk, miscarriage-risk, infertility-risk, prenatal-testing, PGT, IVF, treatment, supplement, pregnancy-action, reproductive-decision, or all-clear guidance.
