# Age with Strength local-agent prompt

Generate a plain-English Age with Strength report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, longevity claims, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, pharma-, or researcher-facing language.
If ACTN3, ACE, calibrated strength or aging model, frailty model, recovery model, injury-risk model, training-response model, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and strength traits are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, age, and many other factors.
Do not predict longevity, biological age, frailty, muscle loss, strength capacity, training response, injury risk, recovery, sport suitability, or medical outcomes from genotype.
For this package, focus on educational strength-related marker context and explicitly unavailable longevity, biological-age, frailty, muscle-loss, injury-risk, recovery, and training-response sections.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
