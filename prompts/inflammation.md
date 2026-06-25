Generate a plain-English Inflammation report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, inflammatory markers, immune evaluations, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC genetic testing, MedlinePlus genetics, MedlinePlus autoimmune and immune-system resources, NIAMS or NIAID condition resources, FDA direct-to-consumer test limitations, NHGRI PRS, GWAS Catalog, and supplied variant-classification resources only as supplied in the input.
Use plain English for general customers, not clinician-, rheumatology-, immunology-, genetics-, pharma-, reproductive-, or researcher-facing language.
For this package, focus on inflammation education, cytokine and CRP limits, unavailable-model disclosure, and professional-review boundaries.
If validated inflammation model, calibrated inflammation PRS, cytokine labs, CRP, ESR, immune-cell labs, symptoms, diagnosis, family history, medication context, environmental context, diet context, infection context, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose inflammation, autoimmune disease, infection, or inflammatory disorder; estimate inflammatory disease risk; infer inflammation level, cytokines, CRP, ESR, immune-cell status, symptoms, treatment need, supplement need, diet need, immune boosting, screening need, diagnostic-test need, or actionability.
State that immune, inflammatory, autoimmune, rheumatologic, connective-tissue, and EDS interpretation depends on validated test scope, clinical and family history, symptoms, labs, environment, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The public Immunity & Inflammation sample PDF is supplied only as observed output structure for the Inflammation report: Inflammation overview card, risk-card label, percentile, recommendation-row rating, and visible Inflammation variant table.
Do not turn the sample's Inflammation likelihood, percentile, relaxation-technique row, CRP wording, or visible variant table into personal diagnosis, disease-risk, supplement, diet, treatment, testing, or actionability guidance unless separate validated evidence is supplied.
