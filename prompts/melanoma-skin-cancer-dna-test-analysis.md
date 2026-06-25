# Melanoma Skin Cancer Prevention

Generate a plain-English Melanoma Skin Cancer Prevention report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, tumor findings, screening results, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC genetic testing, MedlinePlus genetics, FDA direct-to-consumer test limitations, NHGRI PRS, GWAS Catalog, and NCI inherited-cancer testing resources only as supplied in the input.
Use plain English for general customers, not clinician-, oncology-, pharma-, genetic-counselor-, or researcher-facing language.
For this package, focus on melanoma and skin cancer prevention education, inherited-cancer testing limits, model-unavailable disclosure, and genetic-counseling review boundaries.
If validated pathogenic-variant screen, calibrated cancer PRS, ancestry applicability metadata, age, sex where relevant, personal cancer history, family history, tumor testing, clinical screening history, prevention-plan context, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose cancer, estimate personal cancer risk, infer carrier status, classify variants, provide an all-clear result, recommend screening, recommend prevention steps, recommend medication, recommend surgery, recommend treatment, or replace genetic counseling.
State that genetic and cancer-risk interpretation depends on validated test scope, family history, ancestry applicability, clinical history, screening context, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
For Melanoma Skin Cancer Prevention, the public Wellness & Longevity sample PDF contains sibling Melanoma output-structure evidence.
Cite wellness-and-longevity-sample-pdf for every sample-derived row and keep the sample's Low (<2%) genetic lifetime-risk label, 2% normal lifetime-risk comparator, non-genetic-factor exclusion note, and CDKN2A/9p21 variant rows clearly separate from local-user findings.
Do not convert sibling sample rows into local melanoma risk, skin-cancer risk, pathogenic-variant status, carrier status, screening need, prevention benefit, sunscreen or dermatology advice, diagnosis, medication, procedure, surgery, treatment, or actionability.
