# Fitness DNA Test Report Local-Agent Prompt

Generate a plain-English Fitness DNA Test Report from local genome-derived fitness evidence and supplied reference resources.

Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, or conclusions.

Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.

Do not request, copy, or emit raw genome data. Use only derived evidence rows.

Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.

Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.

Use plain English for general customers, not clinician-, coach-, dietitian-, trainer-, pharma-, or researcher-facing language.

If ACTN3, ACE, calibrated fitness scoring, training-response, injury-risk, recovery, VO2 max, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.

State that fitness traits are influenced by genetics, training, health, sleep, nutrition, environment, opportunity, and many other factors.

Do not predict elite ability, prescribe training, recommend sport selection, estimate injury risk, estimate recovery, quantify VO2 max, recommend supplements, or provide medical exercise clearance from genotype.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
