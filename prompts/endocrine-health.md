# Endocrine Health local-agent prompt

Generate a plain-English Endocrine Health report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, hormone labs, fertility evaluations, pregnancy context, partner results, family history, clinical history, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, FDA, ACOG, ClinGen, ClinVar, GTR, NHGRI PRS, and GWAS resources only as supplied in the input.
Use plain English for general customers, not clinician-, fertility-specialist-, obstetric-, endocrinology-, genetic-counselor-, or researcher-facing language.
For this package, focus on endocrine health limits, hormone and gland context, missing labs and symptoms, calibrated model gaps, and clinician-review boundaries.
If validated endocrine model, hormone labs, thyroid labs, adrenal labs, glucose or insulin labs, symptoms, diagnosis, medications, clinical history, family history, clinician review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose endocrine disease; infer hormone, thyroid, adrenal, glucose, insulin, fertility, or lab status; estimate disease risk; recommend labs, medication, supplements, diet, treatment, screening, reproductive actions, or replace clinician review.
State that reproductive, endocrine, hormone, carrier, pregnancy, and fertility interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, partner context, pregnancy context when relevant, ancestry applicability, and qualified professional review.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
