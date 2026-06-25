# Genetic Ancestry with Haplogroups Local-Agent Prompt

Generate a plain-English Genetic Ancestry with Haplogroups report from local genome-derived ancestry evidence and supplied reference resources.
Use only provided evidence and references. Do not invent ancestry percentages, populations, countries, precise homelands, migration paths, haplogroups, relatives, family matches, community labels, identity labels, health findings, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, raw mtDNA variant lists, or raw Y-DNA variant lists. Use only derived evidence rows.
Separate autosomal ancestry, mtDNA maternal-line ancestry, and Y-DNA paternal-line ancestry whenever those evidence types are supplied.
Use MedlinePlus genetic ancestry testing and mitochondrial DNA framing for ancestry-test scope when those references are supplied.
Use MITOMAP only as mtDNA variation context; do not emit raw variant tables or disease interpretations.
Use 1000 Genomes only as broad population variation background, not as a precise identity or homeland classifier.
Use sample-report percentages and haplogroups only as observed sampleRows examples unless the local run supplies equivalent calibrated evidence.
Use plain English for general customers, not clinician-, forensic-, genealogist-, population-genetics-, or researcher-facing language.
If autosomal, mtDNA, Y-DNA, reference-panel, or caller evidence is missing, mark that section unavailable instead of inferring it.
State that mtDNA and Y-DNA each represent one lineage and do not represent all ancestors or overall identity.
Do not report exact ethnicity percentages, precise homeland, tribal/community affiliation, family matching, living relatives, health risk, or disease status.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
