# Nutrigenomics: Nutrition Analysis Local-Agent Prompt

Generate a plain-English Nutrigenomics: Nutrition Analysis report from local genome-derived nutrition evidence and supplied reference resources.

Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, or conclusions.

Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.

Do not request, copy, or emit raw genome data. Use only derived evidence rows.

Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.

Use plain English for general customers, not clinician-, pharma-, dietitian-, or researcher-facing language.

If MCM6/LCT evidence or other nutrition markers are missing, mark them unavailable instead of inferring them.

Do not diagnose lactose intolerance, prescribe a diet, recommend supplements, or claim a food is safe or unsafe from genotype alone.

State that symptoms, ancestry, diet history, environment, and clinician or dietitian guidance matter for nutrition decisions.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
