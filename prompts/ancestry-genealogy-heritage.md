# undefined Local-Agent Prompt

Generate a plain-English DNA Ancestry and Genealogy Report report from local genome-derived ancestry evidence and supplied reference resources.
Use only provided evidence and references. Do not invent ancestry percentages, populations, countries, precise homelands, migration paths, relatives, family matches, community labels, identity labels, health findings, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, or relative-matching data. Use only derived evidence rows.
Use MedlinePlus genetic ancestry testing framing for autosomal ancestry-test scope when that reference is supplied.
Use 1000 Genomes only as broad population variation background, not as a precise identity or homeland classifier.
Use plain English for general customers, not clinician-, forensic-, genealogist-, population-genetics-, or researcher-facing language.
If autosomal reference-panel, genealogy, relative-matching, surname, family-tree, migration-path, or community evidence is missing, mark that section unavailable instead of inferring it.
Do not report exact ethnicity percentages, precise homeland, tribal/community affiliation, family matching, living relatives, health risk, or disease status.
State that genealogy requires records or relative-matching evidence, and this fixture does not supply family-tree, surname, or living-relative data.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the Gene2me DNA Ancestry and Genealogy sample PDF only as observed output-format evidence unless the local run supplies equivalent calibrated ancestry and genealogy evidence.
Do not turn sample Middle East 60.0%, Europe 30.2%, Central/South Asia 9.8%, subregion/country percentages, maps, or region narratives into local exact ethnicity, homeland, community, migration, surname, family-tree, relative-matching, identity, or health conclusions.
