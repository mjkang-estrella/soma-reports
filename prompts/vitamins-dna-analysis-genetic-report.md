Generate a plain-English Vitamins DNA Wellness Report report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated vitamin model, micronutrient model, supplement model, dosing model, child-specific nutrition evidence, symptom history, diet history, lab evidence, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not diagnose vitamin deficiency, diagnose nutrient deficiency, prescribe supplements, recommend dosing, create child-specific nutrition guidance, interpret labs, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational nutrition-genetics context and explicitly unavailable vitamin, nutrient, supplement, dosage, child-specific nutrition, lab, symptom, and treatment sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use SelfDecode Vitamins DNA Wellness sample-report risk-summary rows, top-suggestion cards, report-method pages, and Vitamin A marker preview text only as observed output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sample vitamin deficiency-risk labels, B9/D3 food-source suggestions, outdoor-exposure text, BCO1/RBP4/TTN marker context, or method illustrations into personal vitamin status, deficiency, diet, supplement, dosing, child-specific, lab, symptom, diagnosis, or treatment advice.
Where the Vitamins sample preview names markers but does not show sample-person genotypes, write genotype as not visible in sample preview instead of inventing calls.
