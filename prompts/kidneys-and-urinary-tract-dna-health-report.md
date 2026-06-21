# Kidneys and Urinary Tract DNA Health Report local-agent prompt

Generate a plain-English Kidneys and Urinary Tract DNA Health Report report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, vitals, organ-function measures, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, NIH, MedlinePlus, FDA, GeneReviews, ClinGen, ClinVar, NHGRI PRS, GWAS Catalog, and organ-specific references only as supplied in the input.
Use plain English for general customers, not clinician-, specialist-, genetics-, pharmacology-, dental-, audiology-, ophthalmology-, pediatric-, or researcher-facing language.
For this package, focus on kidney and urinary tract education, CKD/eGFR/creatinine and urinalysis limits, stone/UTI/bladder function limits, diet and treatment claim boundaries.
If validated kidney or urinary tract model, eGFR, creatinine, cystatin C, urinalysis, albuminuria, stone history, UTI history, bladder function context, imaging, blood pressure, medication context, clinical diagnosis, clinician review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose CKD, kidney disease, urinary tract disease, kidney stones, UTI, bladder disorder, hypertension, diabetes, or organ dysfunction; infer eGFR, creatinine, cystatin C, urinalysis, albuminuria, stone risk, UTI risk, bladder function, imaging, blood pressure, diet need, medication need, supplement need, treatment need, screening need, testing need, prevention, or clinical actionability.
State that organ-system and complex-condition interpretation depends on validated test scope, clinical and family history, symptoms, labs, imaging, vitals or organ-function measures when relevant, ancestry applicability, and qualified professional review.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
