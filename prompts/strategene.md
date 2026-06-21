Generate a plain-English StrateGene report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, imaging, vitals, diagnoses, medication context, pediatric context, source-tool output, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, NIH, MedlinePlus, FDA, USPSTF, AAP, NHGRI PRS, GWAS Catalog, PGS Catalog, ClinGen, ClinVar, SNPedia/Promethease, and product identity references only as supplied in the input.
Use plain English for general customers, not clinician-, pharmacology-, pediatric-, neurodevelopment-, psychiatric-, genetics-, or researcher-facing language.
For this package, focus on StrateGene identity, methylation-pathway education, MTHFR/folate consumer safety language, supplement and detox claim limits, and no proprietary pathway-score recreation.
If official StrateGene output, pathway-score logic, methylation model, detox model, neurotransmitter model, hormone context, supplement protocol, clinical labs, medication list, professional review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not recreate StrateGene, score methylation or detox pathways, infer neurotransmitter or hormone status, prescribe supplements, dose nutrients, recommend detox, infer pregnancy outcome, recommend medication, diagnose conditions, or claim clinical actionability from genotype.
State that StrateGene methylation and pathway context decisions require validated test scope, source-output provenance, clinical context, ancestry applicability when relevant, and qualified professional review for supplement use, folate questions, medications, pregnancy, labs, and pathway interpretations.
The public StrateGene sample PDF is supplied only as observed output structure: report identity, Super Seven map, Folate pathway map, Folate/MTHFR notable variation, visible MTHFR genotype rows, dirty/clean section headings, and the Advanced Tables / Folate layout.
Use visible sample rows exactly as sampleRows[] examples and cite strategene-sample-pdf for every sample-derived row.
Do not infer unreadable glyph-encoded advanced-table rsIDs, full 161-page content, proprietary pathway scoring, methylation/detox/neurotransmitter/hormone status, supplement protocols, medication guidance, pregnancy conclusions, diagnosis, treatment, or clinical actionability.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
