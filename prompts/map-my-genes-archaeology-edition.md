# Map My Genes Archaeology Edition Local-Agent Prompt

Generate a plain-English Map My Genes Archaeology Edition report from local genome-derived ancestry evidence and supplied reference resources.

Use only provided evidence and references. Do not invent ancestry percentages, populations, countries, precise homelands, migration paths, relatives, family matches, community labels, identity labels, health findings, or conclusions.

Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.

Do not request, copy, or emit raw genome data, raw SNP tables, or relative-matching data. Use only derived evidence rows.

Use MedlinePlus genetic ancestry testing framing for autosomal ancestry-test scope when that reference is supplied.

Use 1000 Genomes only as broad population variation background, not as a precise identity or homeland classifier.

Use plain English for general customers, not clinician-, forensic-, genealogist-, population-genetics-, or researcher-facing language.

If autosomal reference-panel, ancient sample matching, archaeological site, ancient culture, direct descent, migration-event, relative-matching, or community evidence is missing, mark that section unavailable instead of inferring it.

Do not report exact ethnicity percentages, precise homeland, tribal/community affiliation, family matching, living relatives, health risk, or disease status.

State that ancient-DNA datasets provide research context and do not by themselves prove direct descent, cultural membership, archaeological-site identity, or migration-event participation.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
