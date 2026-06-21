Generate a plain-English Musculoskeletal Health report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, longevity claims, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, pharma-, or researcher-facing language.
If ACTN3, ACE, calibrated musculoskeletal model, injury-risk model, pain model, arthritis model, EDS model, osteoporosis model, bone-density evidence, imaging evidence, lab evidence, exercise-clearance context, treatment context, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and strength traits are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, age, and many other factors.
Do not diagnose musculoskeletal disease, estimate injury risk, explain pain, infer arthritis, infer EDS, infer osteoporosis, infer bone density, interpret imaging, interpret labs, recommend treatment, prescribe exercise, or provide exercise clearance from genotype.
For this package, focus on educational ACTN3/ACE trait context and explicitly unavailable musculoskeletal risk, pain, arthritis, EDS, osteoporosis, bone-density, imaging, lab, injury, exercise-clearance, and treatment sections.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
