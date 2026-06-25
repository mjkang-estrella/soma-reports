# Digestive Disorders & Gut Health local-agent prompt

Generate a plain-English Digestive Disorders & Gut Health report from local genome-derived nutrition evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, symptoms, foods, supplements, meal plans, micronutrient targets, food-sensitivity results, metabolic diagnoses, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus lactose intolerance and MCM6 framing for lactose-related context when those references are supplied.
Use the nutritional genomics review and GWAS Catalog background only to explain evidence limits, candidate associations, and why calibrated models matter.
Use direct-to-consumer result, dietary supplement, blood glucose, A1C, diabetes-risk, and BMI references only to explain limits and missing evidence when those references are supplied.
Use plain English for general customers, not clinician-, dietitian-, pharma-, researcher-, or food-allergy specialist-facing language.
If MCM6/LCT evidence, calibrated digestive-disorders and gut-health model, celiac model, IBS model, IBD model, microbiome evidence, symptom history, diet history, elimination-diet model, supplement model, lab evidence, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
Do not diagnose lactose intolerance, food allergy, food sensitivity, celiac disease, diabetes, metabolic syndrome, vitamin deficiency, or nutrient deficiency from genotype alone.
Do not diagnose digestive disorders, infer microbiome status, diagnose lactose intolerance, diagnose celiac disease, infer IBS or IBD status, explain symptoms, prescribe diets or elimination diets, recommend supplements, interpret labs, or provide treatment guidance from genotype.
State that symptoms, ancestry, diet history, environment, labs, medications, medical history, and clinician or dietitian guidance matter for nutrition decisions.
For this package, focus on educational lactose-related marker context and explicitly unavailable digestive-disorder diagnosis, microbiome, celiac, IBS, IBD, symptom, diet, elimination-diet, supplement, lab, and treatment sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use sibling SelfDecode Gut Health sample-report method pages, digestive issue cards, infection and inflammation cards, food-intolerance cards, gut microbiome card, IBS and peptic-ulcer detail pages, probiotic recommendation pages, curcumin recommendation pages, impact/evidence scores, and sample variant tables only as observed digestive-disorders and gut-health output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sibling sample IBS, peptic-ulcer, indigestion, acid-reflux, constipation, gallstone, pancreas-inflammation, IBD, appendicitis, C. difficile, H. pylori, EBV, gastrointestinal-infection, gluten-sensitivity, lactose-tolerance, microbiome-diversity, probiotic, curcumin, dose, lab, symptom, medication, supplement, or sample genotype text into personal digestive diagnosis, microbiome status, diet, elimination-diet, probiotic, curcumin, supplement, lab, medication, or treatment advice.
State clearly that these are sibling Gut Health sample rows, not a direct Digestive Disorders & Gut Health sample report.
