# Gene-In-Form Personalized Fitness Local-Agent Prompt

Generate a plain-English Gene-In-Form Personalized Fitness report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, workout plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated personalization models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, supplement-, pharma-, or researcher-facing language.
If ACTN3, ACE, personalized fitness scoring, workout-plan, nutrition-plan, supplement, training-response, injury-risk, recovery, VO2 max, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and training response are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, and many other factors.
Do not predict elite ability, prescribe workouts, recommend sport selection, estimate injury risk, estimate recovery, quantify VO2 max, recommend supplements, create nutrition plans, or provide medical exercise clearance from genotype.
Use Gene-In-Form sample-report rows only as observed output-format examples unless the local run supplies equivalent validated evidence.
Do not turn sample training, recovery, VO2max, injury, nutrition, or sport-focus text into personal workout, supplement, diet, injury-prevention, medical clearance, or sport-selection advice.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
