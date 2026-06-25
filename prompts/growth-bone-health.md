# Growth & Bone Health local-agent prompt

Generate a plain-English Growth & Bone Health report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, longevity claims, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, pharma-, or researcher-facing language.
If ACTN3, ACE, calibrated growth model, height model, bone-density model, osteoporosis model, endocrine model, pediatric growth model, imaging evidence, lab evidence, supplement model, treatment context, exercise-clearance context, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and strength traits are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, age, and many other factors.
Do not predict growth or height, infer pediatric growth status, diagnose bone or endocrine disease, estimate osteoporosis risk, infer bone density, interpret imaging, interpret labs, recommend supplements, recommend treatment, prescribe exercise, provide exercise clearance, or make actionability claims from genotype.
For this package, focus on educational ACTN3/ACE trait context and explicitly unavailable growth, height, bone-density, osteoporosis, endocrine, pediatric, imaging, lab, supplement, treatment, exercise-clearance, diagnosis, and actionability sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the public Gene-In-Form sample PDF only as sibling output-format evidence for growth/bone-adjacent, connective-tissue, and musculoskeletal row structure. It is not a direct Growth & Bone Health sample report.
Do not turn sample SOD2, ACTN3, HIF1A, ACE, GDF5, COL5A1, oxidative-stress, muscle-fiber, circulation, tendon, ACL, or osteoarthritis rows into personal growth/height prediction, pediatric growth status, bone-density, osteoporosis-risk, fracture-risk, endocrine status, imaging, labs, supplement, treatment, exercise-clearance, or actionability claims.
State plainly that this local run cannot estimate growth, height, pediatric growth status, bone density, osteoporosis risk, fracture risk, endocrine status, supplement need, treatment need, or exercise clearance because no calibrated model, clinical context, imaging, labs, or professional review was supplied.
