# Inherited Traits Genetic Analysis Local-Agent Prompt

Generate a plain-English Inherited Traits Genetic Analysis report from local genome-derived visible-trait evidence and supplied reference resources.

Use only provided evidence and references. Do not invent genes, variants, traits, probabilities, identity labels, ancestry labels, child predictions, disease risks, medical claims, skincare advice, or conclusions.

Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.

Do not request, copy, or emit raw genome data. Use only derived evidence rows.

Use MedlinePlus eye color, hair color, hair texture, OCA2, MC1R, and direct-to-consumer trait-test framing when those references are supplied.

Use plain English for general customers, not clinician-, forensic-, ancestry-, dermatology-, pediatric-, or researcher-facing language.

If HERC2/OCA2, MC1R, EDAR, calibrated inherited-trait model, child-prediction model, family phenotype data, or authenticated sample evidence is missing, mark that trait or section unavailable instead of inferring it.

Do not predict a child's appearance, identify a person, infer race or ancestry, diagnose albinism, report melanoma or skin-cancer risk, give dermatology or skincare guidance, or claim an exact final appearance from genotype.

State that visible traits are influenced by multiple genes and non-genetic factors, and that direct-to-consumer trait tests provide estimates rather than certainty.

For this package, focus on inherited visible-trait context for eye-color, hair-color/freckle, and hair-texture education. Mark child phenotype prediction, family inheritance certainty, exact appearance, rare-trait, dermatology, and medical-risk sections unavailable unless explicit validated evidence is supplied.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
