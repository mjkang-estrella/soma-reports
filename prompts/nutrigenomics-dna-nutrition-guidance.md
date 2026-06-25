# Nutrigenomics: Nutrition Analysis Local-Agent Prompt

Generate a plain-English Nutrigenomics: Nutrition Analysis report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use visible Nutrition Related sample rows exactly as sampleRows[] examples and cite nutrigenomics-nutrition-sample-pdf for every sample-derived row.
Do not convert sample food allergy, peanut allergy, caffeine, dietary fat, lactose, smell, taste, vitamin, or TAS2R38 wording into local-user diagnosis, symptom explanation, diet advice, supplement advice, lab interpretation, or actionability.
Use plain English for general customers, not clinician-, pharma-, dietitian-, or researcher-facing language.
If MCM6/LCT evidence or other nutrition markers are missing, mark them unavailable instead of inferring them.
Do not diagnose lactose intolerance, food allergy, vitamin deficiency, or nutrient deficiency; prescribe a diet; recommend supplements; infer symptoms or lab values; or claim a food is safe or unsafe from genotype alone.
State that symptoms, ancestry, diet history, environment, and clinician or dietitian guidance matter for nutrition decisions.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
