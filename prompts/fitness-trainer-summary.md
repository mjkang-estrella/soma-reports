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
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the public Gene-In-Form sample PDF only as sibling output-format evidence for a trainer-shareable fitness summary. It is not a direct Fitness Trainer Summary sample report.
Do not turn sample SOD2, NRF2, PPARGC1A, SLC2A4, MCT1/SLC16A1, HIF1A, ACTN3, ACE, COL5A1, GDF5, oxidative-stress, respiratory-capacity, glucose-transport, lactate, glycolysis, muscle-fiber, circulation, running-economy, tendon, ACL, or osteoarthritis rows into workouts, trainer instructions, sport selection, injury-risk, recovery, VO2 max, supplement, medical-clearance, or training-action claims.
State plainly that this local run cannot create a workout plan, prescribe training, choose sports, estimate injury risk, estimate recovery, quantify VO2 max, recommend supplements, or provide exercise clearance because no calibrated model, trainer plan, clinical context, or professional review was supplied.
