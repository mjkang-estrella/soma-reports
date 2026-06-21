# Comprehensive Health Screen WGS Bundle local-agent prompt

Generate a plain-English Comprehensive Health Screen WGS Bundle boundary report from local derived WGS product context and supplied reference resources.
Use only provided evidence and references. Do not invent orders, kit status, sample collection, lab processing, sequencing output, depth values, coverage tables, variant calls, health-screen results, turnaround times, clinical validation, diagnoses, or conclusions.
Write deterministic product-boundary sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw sequencing files, alignment files, or complete variant callset files. Use only derived evidence rows supplied in the fixture.
Use SAMtools depth, SAMtools coverage, GATK/Picard WGS metrics, NIST Genome in a Bottle, and NIH Genetic Testing Registry resources only as supplied in the input.
Use plain English for general customers who want to understand a marketplace WGS product boundary, not clinician-, lab-director-, pharma-, or researcher-facing language.
If order status, sample collection, lab processing, sequencing platform, coverage metrics, variant calls, health-screen output, clinical validation, clinical sensitivity, turnaround completion, or authenticated sample evidence is missing, mark that field or section unavailable instead of inferring it.
State that a WGS health-screen bundle card is not evidence of purchase, completed sequencing, health-screen findings, clinical sensitivity, or all-clear results.
Do not infer variant detection, clinical sensitivity, disease risk, carrier status, pathogenicity, sample quality, diagnosis, ancestry, medication response, or treatment implications from product catalog context.
Do not recommend medication, screening, diagnostic testing, reproductive decisions, lifestyle changes, or treatment changes from product-boundary rows.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
