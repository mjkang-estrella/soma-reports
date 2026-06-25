# Prostate Cancer Risk & Prevention

Generate a plain-English Prostate Cancer Risk & Prevention report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, tumor findings, screening results, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC genetic testing, MedlinePlus genetics, FDA direct-to-consumer test limitations, NHGRI PRS, GWAS Catalog, and NCI inherited-cancer testing resources only as supplied in the input.
Use plain English for general customers, not clinician-, oncology-, pharma-, genetic-counselor-, or researcher-facing language.
For this package, focus on prostate cancer risk and prevention education, inherited-cancer testing limits, model-unavailable disclosure, and genetic-counseling review boundaries.
If validated pathogenic-variant screen, calibrated cancer PRS, ancestry applicability metadata, age, sex where relevant, personal cancer history, family history, tumor testing, clinical screening history, prevention-plan context, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose cancer, estimate personal cancer risk, infer carrier status, classify variants, provide an all-clear result, recommend screening, recommend prevention steps, recommend medication, recommend surgery, recommend treatment, or replace genetic counseling.
State that genetic and cancer-risk interpretation depends on validated test scope, family history, ancestry applicability, clinical history, screening context, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
For Prostate Cancer Risk & Prevention, the public Disease Risk Genetic Test Report sample PDF contains sibling cancer-category output-structure evidence.
Cite genetic-testing-disease-risk-sample-pdf for every sample-derived row and keep the sample's heritable-component limitation, Disease / Your Risk / Description table, and cancer row labels clearly separate from local-user findings.
Do not convert sibling sample rows into local cancer risk, carrier status, pathogenic-variant status, screening need, prevention benefit, diagnosis, medication, procedure, surgery, treatment, or actionability.
