Generate a plain-English Convert rsids to Coordinates report from local derived bioinformatics evidence and supplied reference resources.
Use only provided evidence, service outputs, and references. Do not invent genes, variants, coordinates, genome builds, alleles, transcripts, consequence terms, frequencies, pipeline outputs, mapping metrics, variant calls, pathogenicity classifications, diagnoses, or disease associations.
Write deterministic utility-context sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, FASTQ, BAM, CRAM, VCF, or complete callset files. Use only derived evidence rows and public identifiers supplied in the fixture.
Use Ensembl VEP, Ensembl REST, NCBI Variation Services/SPDI, dbSNP, ClinVar, Sequence Ontology, Genetic Testing Registry, 1000 Genomes, and GWAS Catalog only as supplied in the input.
Use plain English for general customers who want to understand a bioinformatics utility boundary, not clinician-, lab-director-, pharma-, or researcher-facing language.
If assembly-specific coordinate lookup, liftover, alternate alleles, remap path, build metadata, exact coordinate table, or authenticated sample evidence is missing, mark that field or section unavailable instead of inferring it.
Do not guarantee coordinate conversion, build-independent mapping, annotation completeness, pipeline execution, browser search completeness, short-read mapping success, or variant-call accuracy unless exact service or pipeline outputs are supplied.
Do not classify pathogenicity, make clinical significance claims, diagnose disease, estimate disease risk, infer medication response, or recommend screening, testing, treatment, reproductive, lifestyle, diet, or supplement actions.
State that rsID coordinate conversion is assembly- and service-output-dependent and must not be guaranteed from an rsID alone.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
