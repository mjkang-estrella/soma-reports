# Insights for Food Response and Nutrient Sensitivity local-agent prompt

Generate a plain-English Insights for Food Response and Nutrient Sensitivity report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated food-response model, nutrient-sensitivity model, micronutrient model, supplement model, symptom history, diet history, lab evidence, metabolic model, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not diagnose food allergy, diagnose food sensitivity, diagnose celiac disease, diagnose lactose intolerance, diagnose nutrient deficiency, prescribe diets, recommend supplements, interpret labs, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational lactose-related marker context and explicitly unavailable food-response, nutrient-sensitivity, micronutrient, supplement, symptom, diet, lab, and metabolic sections.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
