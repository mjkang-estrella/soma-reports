# kidneys-and-urinary-tract-dna-health-report local-agent prompt

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
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The public Disease Risk Genetic Test Report sample PDF is supplied only as sibling observed output structure for Kidneys and Urinary Tract: Other Diseases category rows, Disease / Your Risk / Description columns, the Chronic Kidney Disease row, and heritable-component-only limitation language.
Do not turn the sample's Chronic Kidney Disease Typical label or other-disease risk labels into personal CKD diagnosis, kidney-disease risk, eGFR, creatinine, cystatin C, urinalysis, albuminuria, stone risk, UTI risk, bladder function, blood pressure, diet, medication, supplement, screening, testing, treatment, or actionability guidance unless separate validated evidence is supplied.
State plainly that the sibling sample supports only kidney-disease table shape; it does not provide urinary-tract-specific sample rows.
