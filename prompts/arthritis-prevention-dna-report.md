# Arthritis Prevention local-agent prompt

Generate a plain-English Arthritis Prevention report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, family history, clinical history, labs, inflammatory markers, immune evaluations, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC genetic testing, MedlinePlus genetics, MedlinePlus autoimmune and immune-system resources, NIAMS or NIAID condition resources, FDA direct-to-consumer test limitations, NHGRI PRS, GWAS Catalog, and supplied variant-classification resources only as supplied in the input.
Use plain English for general customers, not clinician-, rheumatology-, immunology-, genetics-, pharma-, reproductive-, or researcher-facing language.
For this package, focus on arthritis and rheumatoid arthritis education, joint-status limits, RF/anti-CCP/CRP/ESR lab limits, prevention-plan limits, unavailable-model disclosure, and professional-review boundaries.
If validated arthritis disease model, calibrated arthritis PRS, HLA inference, rheumatoid-factor, anti-CCP, CRP, ESR, imaging, joint exam, age, sex, family history, smoking and environmental history, symptoms, medication context, prevention-plan context, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose arthritis, rheumatoid arthritis, osteoarthritis, or juvenile arthritis; estimate arthritis risk; infer RA/OA subtype, joint status, HLA status, RF, anti-CCP, CRP, ESR, imaging, symptoms, prevention plan, screening need, treatment need, supplement need, diet need, medication need, or actionability.
State that immune, inflammatory, autoimmune, rheumatologic, connective-tissue, and EDS interpretation depends on validated test scope, clinical and family history, symptoms, labs, environment, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The public Wellness & Longevity sample PDF is supplied only as sibling observed output structure for Arthritis Prevention: Arthritis/Osteoarthritis section header, knee/hip/wrist risk cards, actionability gauge, hidden monitoring/lifestyle/medication blocks, additional resources, and lifetime-risk legend.
Do not turn the sample's knee arthritis Moderate 53%, hip arthritis Slightly Increased 26%, wrist arthritis Normal 30%, actionability gauge, prevention headings, medication/supplement heading, alternative-intervention text, or risk legend into personal arthritis diagnosis, osteoarthritis risk, rheumatoid arthritis risk, joint-status inference, prevention plan, treatment, supplement, diet, medication, screening, testing, or actionability guidance unless separate validated evidence is supplied.
