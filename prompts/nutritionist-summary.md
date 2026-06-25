# Nutritionist Summary Local-Agent Prompt

Generate a plain-English Nutritionist Summary report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated nutrition summary model, diet history, symptom history, lab evidence, supplement model, metabolic model, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not create a nutritionist plan, prescribe diet changes, recommend supplements, diagnose symptoms, infer metabolic disease, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on a concise consumer-shareable nutrition-genetics summary and explicitly unavailable meal-plan, supplement, symptom, lab, and metabolic sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use sibling GenoPalate Food Sensitivity and GeneInformed Healthy Nutrition sample-report rows only as observed nutrition-summary output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sibling sample alcohol, caffeine, lactose, gluten, food-reaction, vitamin, mineral, omega-3, genetic-risk, population-share, personalized-advice, source-list, what-can-you-do, or sample genotype-like result text into a personal nutritionist plan, diet prescription, supplement recommendation, symptom diagnosis, metabolic inference, lab interpretation, or treatment guidance.
State clearly that these are sibling sample rows, not a direct Nutritionist Summary sample report.
