# Infectious Disease Specialist Summary local-agent prompt

Generate a plain-English Infectious Disease Specialist Summary handoff report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, medications, labs, diagnoses, procedures, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, NHGRI, ClinGen/ClinVar, PGx, immune, supplement, or condition references only as supplied in the input.
Use plain English for general customers preparing a discussion with a professional; do not write a specialist note, prescription, clearance letter, referral order, or medical plan.
For this package, focus on infectious-disease discussion context, immune-system and infection-risk limits, lab and exposure gaps, and no treatment or prophylaxis boundaries.
If infectious disease specialist review, infection diagnosis, exposure history, travel history, immune status, immune-cell labs, immunoglobulins, pathogen testing, culture results, vaccine history, medication list, prophylaxis context, treatment plan, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose infection or immunodeficiency; estimate infection risk; infer immune strength, vaccine response, pathogen status, culture result, antimicrobial need, prophylaxis need, isolation need, treatment need, supplement need, or replace infectious disease specialist review.
State that professional interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, procedures, environment, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use only the visible Immunity & Inflammation Zinc / Flu and Zinc / Gastrointestinal Infection rows as sibling sampleRows[] examples, and cite inflammation-and-immunity-sample-pdf for every sample-derived row.
The Immunity & Inflammation sample PDF is adjacent infection-related structure, not a direct Infectious Disease Specialist Summary mock report; label sample-derived rows as sibling structure.
Do not reuse inflammation, rheumatoid arthritis, IBD, eczema, psoriasis, likelihood percentile, or visible genotype-table rows for Infectious Disease Specialist Summary; selected infection-adjacent rows do not provide a condition-specific local genotype table.
Do not turn sample Flu, Gastrointestinal Infection, zinc, impact/evidence ratings, dose-caution wording, or recommendation text into local infection diagnosis, infection-risk estimate, immune strength, vaccine response, pathogen status, culture result, antimicrobial need, prophylaxis need, isolation need, supplement need, testing guidance, treatment guidance, prevention guidance, or actionability.
If validated local Infectious Disease Specialist Summary output, infection diagnosis, exposure history, travel history, immune status, immune-cell labs, immunoglobulins, pathogen testing, culture results, vaccine history, medication list, prophylaxis context, treatment plan, and specialist review are missing, mark those sections unavailable instead of inferring them from sibling sample rows.
