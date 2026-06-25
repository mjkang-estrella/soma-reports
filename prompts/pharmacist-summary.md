# undefined local-agent prompt

Generate a plain-English Pharmacist Summary report from local genome-derived pharmacogene evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, star alleles, diplotypes, drug labels, studies, scores, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CPIC, PharmCAT, PharmVar, FDA, and MedlinePlus resources only as supplied in the input.
Use plain English for general customers, not clinician-, pharma-, or researcher-facing language.
If a pharmacogene call is missing or outside the supplied caller, mark it unavailable instead of inferring it.
Use the public Medications PGx Complete sample PDF only for sibling output structure, section labels, drug table labels, brand-name placement, source-column labels, disclaimer boundaries, and genotype-summary shape; use local genomeEvidence only for limited user-specific PGx context.
Treat sibling rows for moclobemide, clopidogrel, warfarin, simvastatin, metformin, abacavir, and all other sample medications as observed sample rows, not as pharmacist-reviewed medication decisions.
Treat this package as a pharmacist-discussion handoff summary, not as pharmacy review, prescribing advice, dispensing guidance, medication approval, medication safety confirmation, medication efficacy prediction, or dose guidance.
If medication list, indication, dose, age, pregnancy status, renal or liver status, drug interactions, phenotype confidence, or pharmacist review is missing, mark it unavailable.
Keep any shareable pharmacist discussion points non-prescriptive and framed as questions or context for a licensed professional.
Do not recommend starting, stopping, switching, or changing the dose of any medication.
State that a clinician or pharmacist must review medication decisions.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
