# undefined local-agent prompt

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
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use the World Ancestry Report sample PDF only as sibling map-style ancestry output-format evidence. It is not a direct Map My Genes Archaeology Edition sample report.
Do not turn sample 95.9% European, 36.6% Scandinavian, 28.2% Iberian, 16.4% Eastern Europe, 8.8% Northwest European, 7.0% Basque, 4.1% American, 2.9% East Asian, 2.9% Arctic, maps, chromosome painting, ethnicity cards, or G-Nomix methodology text into local ancient-sample matches, direct descent, archaeological-site placement, ancient culture, civilization, tribe, migration-event proof, exact ethnicity, homeland, community, relatives, family-tree, identity, segment-ancestry, or health conclusions.
State plainly that ancient-DNA resources are background research context only in this local run because no calibrated ancient-sample matching model, site/culture label, direct-descent evidence, migration-event evidence, reference-panel metadata, relative-matching evidence, or family-tree evidence was supplied.
