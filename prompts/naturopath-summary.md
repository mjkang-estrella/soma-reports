# Naturopath Summary local-agent prompt

Generate a plain-English Naturopath Summary handoff report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, medications, labs, diagnoses, procedures, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, NHGRI, ClinGen/ClinVar, PGx, immune, supplement, or condition references only as supplied in the input.
Use plain English for general customers preparing a discussion with a professional; do not write a specialist note, prescription, clearance letter, referral order, or medical plan.
For this package, focus on supplement and wellness discussion context, dietary-supplement and PGx limits, detox/methylation/lab gaps, and no treatment or supplement-prescribing boundaries.
If naturopath review, diet history, supplement list, medication list, symptoms, labs, methylation or homocysteine testing, detoxification model, nutrient status, pregnancy context, diagnosis, treatment plan, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose conditions; infer detoxification capacity, methylation status, nutrient deficiency, supplement need, diet need, medication response, lab status, treatment need, pregnancy action, or replace licensed professional review.
State that professional interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, procedures, environment, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use visible Detox Pathway sample table of contents, Phase I/II maps, SNP summaries, recommendations, lab markers, and glossary rows as sibling sampleRows[] and appendix examples only, and cite detox-pathway-sample-pdf for every sample-derived row.
The Detox Pathway sample PDF is adjacent supplement/wellness structure, not a direct Naturopath Summary mock report; label sample-derived rows as sibling structure.
Do not turn sample typical detox ability labels, SNP tables, recommendation lists, supplement dosages, exposure-avoidance rows, health-report chips, lab values, glossary text, or personalized-to-your-genes wording into local detoxification-capacity, toxin-sensitivity, methylation, nutrient-deficiency, lab, supplement, diet, medication, pregnancy, diagnosis, treatment, prevention, or actionability guidance.
If validated local Naturopath Summary output, diet history, supplement list, medication list, symptoms, labs, methylation or homocysteine testing, detoxification model, nutrient status, pregnancy context, diagnosis, treatment plan, and naturopath review are missing, mark those sections unavailable instead of inferring them from sibling sample rows.
