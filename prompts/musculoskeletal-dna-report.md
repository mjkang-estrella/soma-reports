# musculoskeletal-dna-report local-agent prompt

Generate a plain-English Musculoskeletal DNA Report report from local genome-derived fitness evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, studies, scores, training plans, diet plans, supplements, sport recommendations, injury-risk claims, recovery claims, VO2 max estimates, longevity claims, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus athletic-performance framing as the primary complex-trait safety reference.
Use NHGRI polygenic-risk framing and GWAS Catalog background only to explain why calibrated models and ancestry applicability matter.
Use plain English for general customers, not clinician-, coach-, trainer-, dietitian-, pharma-, or researcher-facing language.
If ACTN3, ACE, calibrated musculoskeletal DNA model, diagnostic evidence, treatment evidence, injury-risk model, pain model, arthritis model, EDS model, osteoporosis model, bone-density evidence, imaging evidence, lab evidence, exercise-clearance context, ancestry applicability, or authenticated sample evidence is missing, mark that section unavailable instead of inferring it.
State that fitness and strength traits are influenced by genetics, training history, health, sleep, nutrition, environment, opportunity, age, and many other factors.
Do not diagnose musculoskeletal disease, recommend treatment, estimate injury risk, explain pain, infer arthritis, infer EDS, infer osteoporosis, infer bone density, interpret imaging, interpret labs, prescribe exercise, or provide exercise clearance from genotype.
For this package, focus on educational ACTN3/ACE marker context and explicitly unavailable musculoskeletal diagnosis, treatment, injury-risk, pain-cause, arthritis, EDS, osteoporosis, bone-density, imaging, lab, exercise-clearance, and authenticated report sections.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the public Gene-In-Form sample PDF only as sibling output-format evidence for muscle-fiber, tendon/ACL injury, and osteoarthritis row structure. It is not a direct musculoskeletal sample report.
Do not turn sample ACTN3, HIF1A, GDF5, COL5A1, muscle-fiber, ATP knee injury, ACL knee injury, or osteoarthritis rows into personal musculoskeletal diagnosis, injury-risk, pain-cause, arthritis, EDS, osteoporosis, bone-density, imaging, lab, treatment, exercise prescription, exercise clearance, or actionability claims.
State plainly that this local run cannot diagnose musculoskeletal disease, explain pain, estimate injury risk, infer arthritis, EDS, osteoporosis, bone density, imaging findings, lab findings, treatment need, or exercise clearance because no calibrated model, clinical context, imaging, labs, or professional review was supplied.
