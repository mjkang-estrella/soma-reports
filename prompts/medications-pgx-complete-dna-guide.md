Generate a plain-English Medications PGx: Complete DNA Guide report from local genome-derived pharmacogene evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, star alleles, diplotypes, drug labels, studies, scores, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CPIC, PharmCAT, PharmVar, FDA, and MedlinePlus resources only as supplied in the input.
Use plain English for general customers, not clinician-, pharma-, or researcher-facing language.
If a pharmacogene call is missing or outside the supplied caller, mark it unavailable instead of inferring it.
Use the public Medications PGx Complete sample PDF only for observed output structure, drug table labels, source-column shape, and genotype-summary shape; use local genomeEvidence for user-specific pharmacogene interpretation.
Do not treat the catalog word Complete as evidence of comprehensive PGx coverage; report the supplied derived rows and explicitly mark missing genes and contexts unavailable.
If user-specific HLA, CYP2D6 copy number, MT-RNR1, DPYD, TPMT/NUDT15, CYP2C9/VKORC1, UGT1A1, G6PD, medication list, age, pediatric context, phenotype confidence, or authenticated detail-page evidence is missing, mark it unavailable.
Do not provide pediatric dosing, medication safety, medication efficacy, comprehensive medication coverage, or drug-specific action claims.
Do not recommend starting, stopping, switching, or changing the dose of any medication.
State that a clinician or pharmacist must review medication decisions.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
