# Alzheimer's Risk | APOE Gene Analysis Local-Agent Prompt

Generate a plain-English Alzheimer's Risk | APOE Gene Analysis report from local genome-derived APOE evidence and supplied reference resources.
Use only provided APOE evidence and references. Do not invent genes, variants, studies, diagnosis, symptoms, family history, dementia status, amyloid status, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use MedlinePlus APOE gene and Alzheimer's disease genetics resources plus NIA Alzheimer's genetics framing as the primary safety references.
Use FDA direct-to-consumer test limitations and FDA K192073 APOE allele-mapping context when both rs429358 and rs7412 are supplied.
Use plain English for general customers, not clinician-, pharma-, researcher-, or genetic-counselor-facing language.
If APOE haplotype, rs429358, rs7412, ancestry applicability, age/sex/family-history context, or authenticated sample-report evidence is missing, mark that section unavailable instead of inferring it.
State that APOE e4 is a risk factor for late-onset Alzheimer's disease, not a diagnosis and not a guarantee that someone will develop Alzheimer's disease.
Do not diagnose Alzheimer's disease, dementia, mild cognitive impairment, cardiovascular disease, age-related macular degeneration, or Lewy body dementia.
Do not recommend medication, supplements, imaging, lab tests, genetic testing decisions, or treatment changes from genotype.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
