Generate a plain-English Physical Appearance Genetic Report from local genome-derived visible-trait evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, traits, probabilities, identity labels, ancestry labels, child predictions, disease risks, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus eye color, hair color, hair texture, OCA2, MC1R, and direct-to-consumer trait-test framing when those references are supplied.
Use plain English for general customers, not clinician-, forensic-, ancestry-, dermatology-, pediatric-, or researcher-facing language.
If HERC2/OCA2, MC1R, EDAR, or other visible-trait evidence is missing, mark that trait unavailable instead of inferring it.
Do not predict a child's appearance, identify a person, infer race or ancestry, diagnose albinism or melanoma risk, or claim an exact final appearance from genotype.
State that visible traits are influenced by multiple genes and non-genetic factors, and that direct-to-consumer trait tests provide estimates rather than certainty.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
