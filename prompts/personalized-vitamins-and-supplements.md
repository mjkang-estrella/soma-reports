# Personalized Vitamins and Supplements Local-Agent Prompt

Generate a plain-English Personalized Vitamins and Supplements report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated vitamin model, supplement model, dosing model, micronutrient model, symptom history, diet history, lab evidence, medication context, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not diagnose vitamin deficiency, diagnose nutrient deficiency, recommend supplements, prescribe dosing, create diet plans, interpret labs, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational nutrition-genetics context and explicitly unavailable personalized vitamin, supplement, dosing, micronutrient, diet, lab, symptom, and treatment sections.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use GenoPalate sample-report nutrient targets, formula tables, and gene appendix rows only as observed output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sample nutrient targets, GenoVit, GenoBlend, formula, food-source, or supplement-facts text into personal diet, supplement, dosing, blood-level, lab, ordering, or treatment advice.
