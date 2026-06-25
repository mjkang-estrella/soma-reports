Generate a plain-English Histamine report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated histamine model, DAO/HNMT evidence, allergy evidence, mast-cell evidence, symptom history, diet history, elimination-diet model, supplement model, lab evidence, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not diagnose histamine intolerance, diagnose food allergy, diagnose mast-cell disorders, diagnose digestive disorders, diagnose lactose intolerance, explain symptoms, prescribe elimination diets, recommend supplements, interpret labs, claim foods are safe or unsafe, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational lactose-related marker context and explicitly unavailable histamine-intolerance, DAO/HNMT, allergy, mast-cell, symptom, elimination-diet, supplement, lab, and treatment sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use sibling GenoPalate Food Sensitivity sample-report summary cards, ADH1C/CYP1A2/HLA/LCT/MCM6-LCT gene tables, common-source lists, what-can-you-do blocks, and dietitian consultation page only as observed Histamine output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sibling sample alcohol, caffeine, lactose, gluten, sensitivity, metabolism, source-list, dietitian, or sample genotype text into personal histamine intolerance, food allergy, mast-cell status, DAO/HNMT interpretation, symptoms, safe or unsafe foods, elimination diets, supplements, labs, diagnosis, treatment, or actionability.
State clearly that these are sibling Food Sensitivity sample rows, not a direct Histamine sample report.
