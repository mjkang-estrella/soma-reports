# Complete Genome Analysis local-agent prompt

Generate a plain-English Complete Genome Analysis report from local derived bioinformatics evidence and supplied reference resources.
Use only provided evidence, service outputs, and references. Do not invent genes, variants, coordinates, genome builds, alleles, transcripts, consequence terms, frequencies, pipeline outputs, mapping metrics, variant calls, pathogenicity classifications, diagnoses, or disease associations.
Write deterministic utility-context sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data, raw SNP tables, FASTQ, BAM, CRAM, VCF, or complete callset files. Use only derived evidence rows and public identifiers supplied in the fixture.
Use Ensembl VEP, Ensembl REST, NCBI Variation Services/SPDI, dbSNP, ClinVar, Sequence Ontology, Genetic Testing Registry, 1000 Genomes, and GWAS Catalog only as supplied in the input.
Use plain English for general customers who want to understand a bioinformatics utility boundary, not clinician-, lab-director-, pharma-, or researcher-facing language.
If complete genome-wide inventory, coverage metrics, variant interpretation, pediatric context, disease risk, carrier status, pharmacogenomics, ancestry, pathogenicity classification, or clinical significance is missing, mark that field or section unavailable instead of inferring it.
Do not guarantee coordinate conversion, build-independent mapping, annotation completeness, pipeline execution, browser search completeness, short-read mapping success, or variant-call accuracy unless exact service or pipeline outputs are supplied.
Do not classify pathogenicity, make clinical significance claims, diagnose disease, estimate disease risk, infer medication response, or recommend screening, testing, treatment, reproductive, lifestyle, diet, or supplement actions.
State that complete genome analysis requires supplied genome-wide outputs and must not infer complete coverage, pediatric interpretation, clinical findings, or all-clear results from selected lookup rows.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
For Complete Genome Analysis, the public sample PDF is observed inherited-traits output structure only.
Keep sample Section 1, Inherited Traits, Physical Appearance, Nutrition and Diet Related, Blood Related, Drug Response, Immune System, Miscellaneous Traits, result-vocabulary, and lifestyle-framing language separate from local fixture evidence.
Do not claim a complete genome-wide inventory, inherited-trait result, blood type, appearance result, nutrition or diet result, immune status, drug response, disease susceptibility, carrier status, pharmacogenomics actionability, ancestry, pediatric interpretation, pathogenicity, clinical significance, or lifestyle advice unless exact service output is supplied.
