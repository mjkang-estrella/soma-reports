# Map My Genes local-agent prompt

Generate a plain-English Map My Genes report from local genome-derived ancestry evidence and supplied reference resources.
Use only provided evidence and references. Do not invent ancestry percentages, populations, countries, precise homelands, migration paths, relatives, family matches, community labels, identity labels, health findings, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, or relative-matching data. Use only derived evidence rows.
Use MedlinePlus genetic ancestry testing framing for autosomal ancestry-test scope when that reference is supplied.
Use 1000 Genomes only as broad population variation background, not as a precise identity or homeland classifier.
Use plain English for general customers, not clinician-, forensic-, genealogist-, population-genetics-, or researcher-facing language.
If autosomal reference-panel, map-coordinate, regional-detail, relative-matching, migration-path, or community evidence is missing, mark that section unavailable instead of inferring it.
Do not report exact ethnicity percentages, precise homeland, tribal/community affiliation, family matching, living relatives, health risk, or disease status.
State that map-style presentation is broad reference-panel context only and must not be treated as a coordinate, homeland, migration path, or identity label.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the World Ancestry Report sample PDF only as sibling map-style ancestry output-format evidence. It is not a direct Map My Genes sample report.
Do not turn sample 95.9% European, 36.6% Scandinavian, 28.2% Iberian, 16.4% Eastern Europe, 8.8% Northwest European, 7.0% Basque, 4.1% American, 2.9% East Asian, 2.9% Arctic, maps, chromosome painting, ethnicity cards, or G-Nomix methodology text into local map coordinates, exact ethnicity, homeland, community, migration, relatives, family-tree, identity, segment-ancestry, or health conclusions.
State plainly that this local run does not provide Map My Genes coordinate-style placement because no calibrated map-coordinate model, regional-percentage model, segment calls, reference-panel metadata, migration-path evidence, or relative-matching evidence was supplied.
