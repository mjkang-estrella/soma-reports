# Cognitive Function local-agent prompt

Generate a plain-English Cognitive Function report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, cognitive testing, mental-state findings, neurologic exam findings, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use NIMH mental-health genetics, MedlinePlus genetics, MedlinePlus complex-trait or intelligence genetics, FDA direct-to-consumer test limitations, NHGRI PRS, and GWAS Catalog resources only as supplied in the input.
Use plain English for general customers, not clinician-, psychiatry-, neurology-, pharma-, school-, genetic-counselor-, or researcher-facing language.
For this package, focus on cognitive function and intelligence education, complex-trait limits, mental-health or cognitive prediction limits, unavailable-model disclosure, and professional-review boundaries.
If validated neurobehavioral model, calibrated PRS, ancestry applicability metadata, age, sex, family history, symptoms, current mental state, cognitive testing, neurologic exam, biomarkers, imaging, labs, medication context, pediatric context, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose mental, neurologic, cognitive, developmental, or neurodegenerative conditions; assess current mental state; predict IQ, aptitude, mood, dementia, Parkinson's disease, seizure, migraine, ADHD, autism, depression, anxiety, treatment response, or brain health status; provide all-clear reassurance; recommend medication, supplements, nootropics, therapy, imaging, labs, school or work decisions, pediatric actions, or treatment changes.
State that neurobehavioral interpretation depends on validated test scope, clinical and family history, symptoms, age, ancestry applicability, environment, and qualified professional review.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
