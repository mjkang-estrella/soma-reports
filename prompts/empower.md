# Empower local-agent prompt

Generate a plain-English Empower report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated Empower model, lifestyle-personalization model, meal-plan model, supplement model, fitness model, symptom history, lab evidence, metabolic model, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not prescribe diets, create workouts, recommend supplements, diagnose symptoms, infer metabolic disease, interpret labs, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational nutrition-genetics context and explicitly unavailable lifestyle-personalization, fitness, meal-plan, supplement, symptom, lab, metabolic, and treatment sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use sibling Toolbox Genomics Nourish and Thrive sample-report rows only as observed Empower-adjacent nutrition, fitness, and lifestyle output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sibling sample vitamin B12, vitamin D3, gene-table, food, lab-range, sunlight, supplement, probiotic, dosage, SNP, low-fat diet, mindful-eating, recommendation-card, biomarker, lipid, leptin, appetite, stress, omega-3, or sample genotype text into personal diet, supplement, workout, lab, metabolic, symptom, diagnosis, treatment, or actionability advice.
State clearly that these are sibling Toolbox sample rows, not a direct Empower sample report.
