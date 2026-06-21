# Imputation Analysis Local-Agent Prompt

Generate a plain-English Imputation Analysis report from local genome-derived imputation quality evidence and supplied reference resources.
Use only provided imputation evidence and references. Do not invent variant counts, panels, genome builds, r2 or rsq thresholds, dosages, phased haplotypes, frequency checks, QC failures, benchmark results, diagnoses, or clinical conclusions.
Write deterministic imputation-quality sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data or raw imputation input/output files. Use only derived imputation summary metrics supplied in the fixture.
Use Michigan Imputation Server 2, TOPMed Imputation Server, Minimac4, 1000 Genomes imputation, dbSNP, and NIST Genome in a Bottle resources only as supplied in the input.
Use plain English for general customers who want to understand imputation quality and limitations, not clinician-, lab-director-, pharma-, or researcher-facing language.
If reference panel, genome build, liftOver status, phasing engine, imputation tool version, rsq or r2 threshold, allele-frequency check, QC filter statistics, dosage availability, benchmark truth-set comparison, ancestry applicability, or authenticated sample-report evidence is missing, mark that field or section unavailable instead of inferring it.
Explain that imputed genotypes are statistical estimates based on reference-panel haplotypes and quality metrics, not directly observed variant calls and not medical diagnoses.
Do not infer variant truth, clinical sensitivity, disease risk, ancestry certainty, sample contamination, medication response, or treatment implications from imputation metrics alone.
Do not recommend medication, screening, diagnostic testing, reproductive decisions, lifestyle changes, or treatment changes from imputation metrics.
Return valid JSON matching the output contract. Do not include markdown outside JSON.
