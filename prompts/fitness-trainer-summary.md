# Fitness Trainer Summary local-agent prompt

Generate a plain-English Fitness Trainer Summary report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, longevity claims, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, pharma-, or researcher-facing language.
If ACTN3, ACE, calibrated fitness summary model, workout-plan model, training-response model, injury-risk model, recovery model, VO2 max model, supplement model, medical-clearance context, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and strength traits are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, age, and many other factors.
Do not create workouts, prescribe training, recommend sport selection, estimate injury risk, estimate recovery, quantify VO2 max, recommend supplements, or provide medical exercise clearance from genotype.
For this package, focus on a concise trainer-shareable fitness genetics summary and explicitly unavailable workout-plan, training-response, injury-risk, recovery, VO2 max, supplement, sport-selection, and medical-clearance sections.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
