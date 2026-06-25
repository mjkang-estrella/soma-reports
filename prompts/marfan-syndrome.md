# Marfan Syndrome local-agent prompt

Generate a plain-English Marfan Syndrome report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, FDA, ClinVar, GTR, ClinGen, ACMG/AMP, and condition-specific references only as supplied in the input.
Use plain English for general customers, not clinician-, cardiology-, neurology-, anesthesia-, oncology-, genetics-, genetic-counselor-, reproductive-, or researcher-facing language.
For this package, focus on Marfan syndrome education, FBN1 and connective-tissue context, unavailable model disclosure, variant-interpretation limits, aortic and clinical context gaps, and clinical genetics review boundaries.
If validated Marfan syndrome diagnostic or risk model, FBN1 gene result, variant classifications, inheritance assessment, aortic imaging, eye evaluation, skeletal findings, systemic score, family history, pregnancy context, clinical diagnosis, genetic counselor review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose Marfan syndrome, FBN1-related condition, connective-tissue disorder, aortic aneurysm, or aortic dissection; estimate vascular risk, disease risk, progression, severity, family-member risk, or carrier status; classify variants; infer systemic score, aortic imaging, eye findings, skeletal findings, inheritance pattern, pregnancy risk, medication need, surgery need, activity restriction, screening need, diagnostic-test need, cascade-testing need, reproductive action, or clinical actionability.
State that rare inherited condition interpretation depends on validated test scope, variant interpretation, clinical and family history, symptoms, labs or imaging when relevant, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
