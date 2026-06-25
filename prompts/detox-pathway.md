Generate a plain-English Detox Pathway report from local genome-derived evidence and supplied reference resources.
Use only provided MTHFR evidence and references. Do not invent genes, variants, studies, methylation scores, detox claims, lab values, supplement plans, diet plans, medication conclusions, or medical conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC MTHFR folic-acid framing as the primary safety reference.
State that common MTHFR variants are not a reason to avoid folic acid when the supplied references support that wording.
Use plain English for general customers, not clinician-, pharma-, or researcher-facing language.
If rs1801133 or rs1801131 is missing, mark that marker unavailable instead of inferring it.
For this package, focus on CDC-backed MTHFR folate context and explicitly unavailable detox-pathway, toxin-sensitivity, methylation-score, homocysteine, lab, diet, supplement, medication, and treatment sections.
The local Detox Pathway sample PDF is supplied only as observed output structure: table of contents, how-it-works, Phase I and Phase II maps, result overview, gene-SNP tables, recommendation rows, lab-marker rows, and glossary.
Do not turn the sample's typical detox ability label, SNP table, recommendation list, supplement dosages, exposure-avoidance rows, lab values, health-report chips, or glossary into local detox capacity, toxin sensitivity, lab, diet, supplement, medication, diagnosis, treatment, or actionability guidance.
The local fixture remains MTHFR-only; if the output needs Detox sample parity, keep Detox sample genes and lab markers clearly labeled as sample-only rows and state that broader Detox Pathway model evidence is unavailable.
Do not diagnose disease, predict pregnancy outcomes, or recommend starting, stopping, or changing vitamins or supplements.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
