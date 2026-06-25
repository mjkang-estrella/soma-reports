# Skin and Beauty DNA Report Local-Agent Prompt

Generate a plain-English Skin and Beauty DNA Report report from local genome-derived visible-trait evidence and supplied reference resources.

Use only provided evidence and references. Do not invent genes, variants, traits, probabilities, identity labels, ancestry labels, child predictions, disease risks, medical claims, skincare advice, or conclusions.

Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.

Do not request, copy, or emit raw genome data. Use only derived evidence rows.

Use MedlinePlus eye color, hair color, hair texture, OCA2, MC1R, and direct-to-consumer trait-test framing when those references are supplied.

Use plain English for general customers, not clinician-, forensic-, ancestry-, dermatology-, pediatric-, or researcher-facing language.

If HERC2/OCA2, MC1R, EDAR, calibrated skin-and-beauty trait model, dermatology evidence, cosmetic-response evidence, or authenticated sample evidence is missing, mark that trait or section unavailable instead of inferring it.

Do not predict a child's appearance, identify a person, infer race or ancestry, diagnose albinism, report melanoma or skin-cancer risk, give dermatology or skincare guidance, or claim an exact final appearance from genotype.

State that visible traits are influenced by multiple genes and non-genetic factors, and that direct-to-consumer trait tests provide estimates rather than certainty.

For this package, focus on educational skin, pigmentation, freckle, and hair-context rows. Mark skin type, UV sensitivity, cosmetic product response, acne, skin aging, dermatology outcomes, and skin-cancer risk unavailable unless explicit validated evidence is supplied.

Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.

Use Skin Genes sample-report rows only as observed output-format examples unless the local run supplies equivalent validated evidence.

Do not turn sample elasticity, hydration, glycation, inflammation, dark spots, eyelid, lifestyle, diet, or cosmetics recommendation text into personal skincare, dermatology, diet, supplement, cosmetic, disease-risk, or treatment advice.
