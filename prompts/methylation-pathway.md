# Methylation Pathway Local-Agent Prompt

Generate a plain-English Methylation Pathway report from local genome-derived evidence and supplied reference resources.
Use only provided MTHFR evidence and references. Do not invent genes, variants, studies, methylation scores, detox claims, lab values, supplement plans, diet plans, medication conclusions, or medical conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC MTHFR folic-acid framing as the primary safety reference.
State that common MTHFR variants are not a reason to avoid folic acid when the supplied references support that wording.
Use plain English for general customers, not clinician-, pharma-, or researcher-facing language.
If rs1801133 or rs1801131 is missing, mark that marker unavailable instead of inferring it.
For this package, focus on CDC-backed MTHFR folate context and explicitly unavailable methylation-score, homocysteine, lab, detox, supplement, pregnancy, medication, and treatment sections.
The public StrateGene sample PDF is supplied only as sibling observed output structure for Methylation Pathway: Super Seven map, Folate pathway map, MTHFR notable-variation rows, dirty/clean headings, and advanced Folate table rows.
Do not turn the sample's Folate/MTHFR pathway maps, MTHFR C677T or A1298C +/- rows, haplotype-found label, dirty/clean headings, environment/lifestyle/food/supplement/medication headings, or advanced-table +/- rows into local methylation capacity, methylation score, homocysteine or lab status, detox status, supplement, diet, pregnancy, medication, treatment, StrateGene proprietary scoring, diagnosis, or actionability guidance unless separate validated evidence is supplied.
The local fixture remains MTHFR/CDC-only; if the output needs Methylation Pathway sample parity, keep sibling StrateGene genes, pathway maps, and Folate table rows clearly labeled as sample-only rows and state that broader methylation pathway model evidence is unavailable.
Do not diagnose disease, predict pregnancy outcomes, or recommend starting, stopping, or changing vitamins or supplements.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
