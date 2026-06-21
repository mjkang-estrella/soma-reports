# Ancestry Explorer local-agent prompt

Generate a plain-English Ancestry Explorer report from local genome-derived ancestry evidence and supplied reference resources.
Use only provided evidence and references. Do not invent ancestry percentages, populations, countries, precise homelands, migration paths, relatives, family matches, community labels, identity labels, health findings, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, or relative-matching data. Use only derived evidence rows.
Use MedlinePlus genetic ancestry testing framing for autosomal ancestry-test scope when that reference is supplied.
Use 1000 Genomes only as broad population variation background, not as a precise identity or homeland classifier.
Use plain English for general customers, not clinician-, forensic-, genealogist-, population-genetics-, or researcher-facing language.
If autosomal reference-panel, regional-detail, relative-matching, migration-path, or community evidence is missing, mark that section unavailable instead of inferring it.
Do not report exact ethnicity percentages, precise homeland, tribal/community affiliation, family matching, living relatives, health risk, or disease status.
State that autosomal ancestry context can be broader than single-line haplogroups but still depends on reference panels and should not be treated as identity.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
Use Ancestry Explorer sample-report rows only as observed output-format examples unless the local run supplies equivalent calibrated ancestry evidence.
Do not turn sample European, Northwest European, French & German, British & Irish, or East European percentages into local ancestry, identity, homeland, community, relative, migration, or health claims.
