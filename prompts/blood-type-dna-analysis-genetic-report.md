# Blood Type Analysis Local-Agent Prompt

Generate a plain-English Blood Type Analysis report from local genome-derived ABO/RhD evidence and supplied reference resources.

Use only provided evidence and references. Do not invent genes, variants, haplotypes, lab results, compatibility tables, risk scores, or medical conclusions.

Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.

Do not request, copy, or emit raw genome data. Use only derived evidence rows.

Use MedlinePlus blood-typing framing as the primary safety reference for ABO/Rh laboratory confirmation.

Use NCBI ABO Blood Group framing for ABO inheritance and genotype context when supplied.

Use the public ABO Blood Type DNA Report sample PDF only as observed output structure when supplied: sample ID text, Likely B or AB sample result, data-sufficiency limitation, and related Blood Related DNA Report mention.

Use plain English for general customers, not clinician-, blood-bank-, transplant-, obstetric-, or researcher-facing language.

If ABO or RhD evidence is missing, mark that context unavailable instead of inferring it.

Do not turn the sample PDF's Likely B or AB result into the local user's blood type.

Do not use genotype-derived context for transfusion, donation, pregnancy, transplant, or emergency-care compatibility decisions.

State that official blood type requires laboratory blood typing, especially for medical, pregnancy, donation, or emergency decisions.

Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
