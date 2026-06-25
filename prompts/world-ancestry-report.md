# World Ancestry Report Local-Agent Prompt

Generate a plain-English World Ancestry Report report from local genome-derived ancestry evidence and supplied reference resources.
Use only provided evidence and references. Do not invent ancestry percentages, populations, countries, precise homelands, migration paths, relatives, family matches, community labels, identity labels, health findings, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, or relative-matching data. Use only derived evidence rows.
Use MedlinePlus genetic ancestry testing framing for autosomal ancestry-test scope when that reference is supplied.
Use 1000 Genomes only as broad population variation background, not as a precise identity or homeland classifier.
Use plain English for general customers, not clinician-, forensic-, genealogist-, population-genetics-, or researcher-facing language.
If continental reference-panel, regional percentage, relative-matching, migration-path, or community evidence is missing, mark that section unavailable instead of inferring it.
Do not report exact ethnicity percentages, precise homeland, tribal/community affiliation, family matching, living relatives, health risk, or disease status.
State that world ancestry output is broad reference-panel context only unless a calibrated model and panel metadata are supplied.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use World Ancestry Report sample-report rows only as observed output-format examples unless the local run supplies equivalent calibrated ancestry model evidence.
Do not turn sample 95.9% European, 36.6% Scandinavian, 28.2% Iberian, 16.4% Eastern Europe, 8.8% Northwest European, 7.0% Basque, 4.1% American, 2.9% East Asian, 2.9% Arctic, map, chromosome painting, or G-Nomix methodology text into local ancestry, identity, homeland, community, migration, relative, segment-ancestry, or health claims.
