# My Personality Traits local-agent prompt

Generate a plain-English My Personality Traits report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, vitals, diagnoses, medication context, pediatric context, source-tool output, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, NIH, MedlinePlus, FDA, USPSTF, AAP, NHGRI PRS, GWAS Catalog, PGS Catalog, ClinGen, ClinVar, SNPedia/Promethease, and product identity references only as supplied in the input.
Use plain English for general customers, not clinician-, pharmacology-, pediatric-, neurodevelopment-, psychiatric-, genetics-, or researcher-facing language.
For this package, focus on temperament and personality as complex traits, genetic/environmental context, model-unavailable disclosure, no personality score, identity, psychiatric, work/school/relationship, or behavioral prediction claims.
If validated personality trait model, score scale, calibration distribution, ancestry applicability metadata, environment context, mental health context, psychometric instrument, professional interpretation, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not assign personality type, Big Five score, temperament score, psychiatric diagnosis, mood state, identity, relationship prediction, work decision, school decision, behavioral prediction, treatment need, medication need, supplement need, or clinical actionability from genotype.
State that personality and temperament trait context decisions require validated test scope, source-output provenance, clinical context, ancestry applicability when relevant, and qualified professional review for mental health, behavior, school, work, relationships, and psychometric interpretation.
The public Personality sample PDF is supplied only as observed output structure: report identity, general trait-report explanation, 11 genetic result overview cards, Big Five section layout, Extravert or Introvert gauge and top-variant table, and Neuroticism gauge page.
Use visible sample rows exactly as sampleRows[] examples and cite personality-traits-sample-pdf for every sample-derived row.
The PDF source filename and body indicate Personality Traits even though the final page says sample Fitness DNA Report; preserve this caveat and do not use this PDF as a Fitness DNA Test Report source.
Do not turn sample Big Five labels, feelings/behavior labels, Extravert or Introvert variants, Neuroticism text, mindfulness, talk therapy, exercise, or personality wording into local personality scores, identity claims, mental-health status, therapy advice, work/school/relationship decisions, treatment, medication, supplement, or actionability guidance.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
