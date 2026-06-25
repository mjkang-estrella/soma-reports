# Chronic Pain DNA Report local-agent prompt

Generate a plain-English Chronic Pain DNA Report report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, vitals, organ-function measures, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, NIH, MedlinePlus, FDA, GeneReviews, ClinGen, ClinVar, NHGRI PRS, GWAS Catalog, and organ-specific references only as supplied in the input.
Use plain English for general customers, not clinician-, specialist-, genetics-, pharmacology-, dental-, audiology-, ophthalmology-, pediatric-, or researcher-facing language.
For this package, focus on chronic pain education, pain threshold and cause limits, neuropathic/inflammatory status limits, opioid and analgesic response boundaries, disability and treatment claim boundaries.
If validated pain model, pain diagnosis, pain location, symptom history, neurologic exam, inflammatory labs, imaging, medication list, opioid or analgesic response evidence, disability context, clinician review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose chronic pain, neuropathy, fibromyalgia, inflammatory disease, injury, addiction, opioid response, analgesic response, disability, or pain condition; infer pain threshold, pain cause, pain severity, neuropathic status, inflammatory status, imaging, labs, medication response, treatment need, supplement need, diet need, exercise guidance, testing need, prevention, or clinical actionability.
State that organ-system and complex-condition interpretation depends on validated test scope, clinical and family history, symptoms, labs, imaging, vitals or organ-function measures when relevant, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The public Chronic Pain DNA Report sample PDF is supplied only as observed output structure: pain-result overview cards, chronic-pain and joint-pain risk-score pages, likelihood labels, percentiles, recommendation blocks, impact/evidence ratings, and visible variant tables.
Do not turn sample chronic-pain, osteoarthritis, headache, migraine, acupuncture, capsaicin, TRPV1, opioid, analgesic, treatment, medication, supplement, exercise, lifestyle, or pain-management wording into personal diagnosis, pain-risk, pain-threshold, medication-response, treatment, prevention, testing, or actionability guidance unless separate validated evidence is supplied.
