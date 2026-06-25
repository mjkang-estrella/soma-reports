Generate a plain-English RunDNA report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, longevity claims, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, pharma-, or researcher-facing language.
If ACTN3, ACE, calibrated running performance model, training-response model, injury-risk model, recovery model, VO2 max model, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and strength traits are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, age, and many other factors.
Do not predict running ability, estimate race time, prescribe training, recommend sport selection, estimate injury risk, estimate recovery, quantify VO2 max, recommend supplements, or provide medical exercise clearance from genotype.
For this package, focus on educational running-fitness marker context and explicitly unavailable race-performance, VO2 max, training-response, injury-risk, and recovery sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the public RunDNA sample PDF only for observed report structure, preview-boundary language, endurance-performance marker-table shape, recommendation-block structure, and response-to-endurance-training pages.
Do not turn sample ADRB2, COL5A1, ACE, PPARA, CKMM, NRF2, PPARGC1A, AMPD1 genotypes, endurance-performance labels, carbohydrate text, fluid text, running-efficiency text, HIIT text, sleep text, stress text, or recommendation blocks into personal running ability, training, injury-risk, recovery, VO2 max, diet, supplement, race, medical-clearance, or performance advice.
