# Mental Health Genetic Guide local-agent prompt

Generate a plain-English Mental Health Genetic Guide report from local genome-derived pharmacogene evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, star alleles, diplotypes, drug labels, studies, scores, or conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CPIC, PharmCAT, PharmVar, FDA, and MedlinePlus resources only as supplied in the input.
Use plain English for general customers, not clinician-, pharma-, or researcher-facing language.
If a pharmacogene call is missing or outside the supplied caller, mark it unavailable instead of inferring it.
Use the public Mental Health Genetic Guide sample PDF only for observed output structure, section labels, drug table labels, brand-name placement, source-column labels, disclaimer boundaries, and genotype-summary shape; use local genomeEvidence for user-specific pharmacogene interpretation.
Treat rows for moclobemide, atomoxetine, paroxetine, sertraline, citalopram, tianeptine, tranylcypromine, brexpiprazole, quetiapine, aripiprazole lauroxil, acamprosate, lofexidine, diazepam, zolpidem, nitrazepam, and all other sample medications as observed sample rows, not as local medication decisions.
If current medication list, indication, dose, treatment history, psychiatric diagnosis, symptoms, current mental state, suicidality assessment, drug interactions, clinician review, phenotype confidence, DNA-test coverage, private variants, pseudogene/similar-sequence resolution, or comprehensive psychiatric PGx genes are missing, mark them unavailable.
Carry forward the sample PDF limitations: the report is not FDA/EMA reviewed, is not for diagnosis, treatment, cure, prevention, medication appropriateness, or medical advice, is based on time-bound third-party pharmacogenomics evidence, is not automatically updated, and may be limited by DNA-test quality, variant coverage, private variants, pseudogenes, similar sequences, and genotyping-vs-WGS coverage.
Do not infer depression, addiction, bipolar disorder, ADHD, anxiety, suicidality, current mental state, treatment response, or medication suitability from sample rows or local PGx calls.
Do not state that a medication is appropriate, safe, unsafe, effective, ineffective, contraindicated, recommended, preferred, or correctly dosed unless that exact externally reviewed clinical conclusion and patient-specific medication context are supplied; for this package they are not supplied.
Do not recommend starting, stopping, switching, or changing the dose of any medication.
State that a clinician or pharmacist must review medication decisions.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
