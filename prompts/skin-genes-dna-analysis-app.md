# Skin Genes Local-Agent Prompt

Generate a plain-English Skin Genes report from local genome-derived visible-trait evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, traits, probabilities, identity labels, ancestry labels, child predictions, disease risks, medical claims, skincare advice, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus eye color, hair color, hair texture, OCA2, MC1R, and direct-to-consumer trait-test framing when those references are supplied.
Use plain English for general customers, not clinician-, forensic-, ancestry-, dermatology-, pediatric-, or researcher-facing language.
If HERC2/OCA2, MC1R, EDAR, calibrated skin-trait, dermatology, skincare-response, or authenticated sample evidence is missing, mark that trait or section unavailable instead of inferring it.
Do not predict a child's appearance, identify a person, infer race or ancestry, diagnose albinism, report melanoma or skin-cancer risk, give dermatology or skincare guidance, or claim an exact final appearance from genotype.
State that visible traits are influenced by multiple genes and non-genetic factors, and that direct-to-consumer trait tests provide estimates rather than certainty.
For this package, focus on educational pigmentation and freckle context. Mark skin type, UV sensitivity, skincare product response, acne, skin aging, and dermatology outcomes unavailable unless explicit validated evidence is supplied.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use Skin Genes sample-report rows only as observed output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sample lifestyle, diet, or cosmetics recommendation text into personal skincare, dermatology, diet, supplement, or treatment advice.
