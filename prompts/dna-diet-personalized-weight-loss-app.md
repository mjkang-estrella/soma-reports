# DNA Diet local-agent prompt

Generate a plain-English DNA Diet report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated diet model, weight-loss response model, obesity-risk model, meal-plan model, supplement model, metabolic model, diet history, activity history, lab evidence, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not predict weight loss, diagnose obesity or metabolic disease, prescribe a diet, create meal plans, recommend supplements, interpret labs, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational nutrition-genetics context and explicitly unavailable diet, weight-loss, meal-plan, supplement, metabolic, lab, and treatment sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use GeneInformed DNA Diet sample-report action points, results summary rows, trait pages, satiety appendix, emotional-eating appendix, exercise appendix, and disclaimer only as observed output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sample high-protein, low-fat, high-carb, trans-fat, calorie, satiety, food-addiction, fat-sensing, exercise, MET, or sample genotype-like result text into personal weight-loss, diet, supplement, activity, metabolic, lab, diagnosis, or treatment advice.
