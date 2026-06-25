Generate a plain-English Pediatric Health report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, vitals, diagnoses, medication context, pediatric context, source-tool output, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, NIH, MedlinePlus, FDA, USPSTF, AAP, NHGRI PRS, GWAS Catalog, PGS Catalog, ClinGen, ClinVar, SNPedia/Promethease, and product identity references only as supplied in the input.
Use plain English for general customers, not clinician-, pharmacology-, pediatric-, neurodevelopment-, psychiatric-, genetics-, or researcher-facing language.
For this package, focus on pediatric health and genetic testing education, child-development context, consent/best-interest limitations, growth/behavior/safety/medical action limits, and professional-review boundaries.
If validated pediatric health model, age, growth history, developmental history, symptoms, family history, vaccination context, medications, labs, clinical diagnosis, pediatrician review, guardian consent context, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose pediatric conditions, predict child development, growth, behavior, learning, safety risk, disease risk, medication response, supplement need, diet need, school need, therapy need, vaccine action, testing need, screening need, treatment need, parenting action, or clinical actionability from genotype.
State that pediatric health genetics context decisions require validated test scope, source-output provenance, clinical context, ancestry applicability when relevant, and qualified professional review for pediatric health, child development, genetic testing of children, symptoms, medications, and family decisions.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
