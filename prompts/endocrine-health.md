# undefined local-agent prompt

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
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The local Hormone Health sample PDF is supplied only as observed output structure: overview cards, thyroid detail pages, top-variant tables, recommendation impact/evidence scores, and sample-only explanatory text.
Use visible Hormone Health sample rows exactly as Endocrine Health sibling sampleRows[] examples and cite hormone-health-sample-pdf for every sample-derived row.
Do not turn sample likelihood labels, hormone-level labels, percentile text, variant counts, genotype table rows, recommendation impact/evidence scores, iodine wording, selenium wording, or condition descriptions into local hormone status, thyroid status, endocrine diagnosis, lab interpretation, fertility or pregnancy inference, treatment, supplement, diet, lifestyle, medication, or clinical actionability guidance.
For Endocrine Health, do not describe sibling Hormone Health sample rows as a direct Endocrine Health mock report or as personal endocrine status, gland function, hormone status, thyroid status, adrenal status, glucose or insulin status, lab interpretation, treatment guidance, supplement guidance, diet guidance, lifestyle guidance, medication guidance, or actionability.
