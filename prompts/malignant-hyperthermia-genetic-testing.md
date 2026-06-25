# Malignant Hyperthermia Local-Agent Prompt

Generate a plain-English Malignant Hyperthermia report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, FDA, ClinVar, GTR, ClinGen, ACMG/AMP, and condition-specific references only as supplied in the input.
Use plain English for general customers, not clinician-, cardiology-, neurology-, anesthesia-, oncology-, genetics-, genetic-counselor-, reproductive-, or researcher-facing language.
For this package, focus on malignant hyperthermia susceptibility education, anesthesia-safety boundaries, unavailable model disclosure, variant-interpretation limits, procedural context gaps, and clinical genetics/anesthesia review boundaries.
If validated malignant hyperthermia susceptibility result, RYR1 or CACNA1S gene result, variant classifications, anesthesia reaction history, caffeine-halothane contracture test context, family history, surgical/procedural context, anesthesiologist review, clinical genetics review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose malignant hyperthermia susceptibility; provide anesthesia clearance; estimate anesthesia reaction risk, procedural risk, family-member risk, or carrier status; classify variants; infer trigger-drug safety, anesthetic-agent choice, surgical plan, procedure plan, medication hold, dosing, monitoring, emergency management, treatment need, screening need, diagnostic-test need, cascade-testing need, reproductive action, or clinical actionability.
State that rare inherited condition interpretation depends on validated test scope, variant interpretation, clinical and family history, symptoms, labs or imaging when relevant, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
For Malignant Hyperthermia, the public Wellness & Longevity sample PDF contains sibling Malignant Hyperthermia output-structure evidence.
Cite wellness-and-longevity-sample-pdf for every sample-derived row and keep the sample's likely-not-affected and no-mutations-detected language clearly separate from local-user findings.
Do not convert sibling sample rows into local malignant-hyperthermia susceptibility, anesthesia clearance, trigger-drug safety, anesthetic-agent choice, procedure risk, surgical planning, medication holds, dosing, monitoring, diagnosis, treatment, testing, cascade testing, reproductive guidance, emergency management, or actionability.
