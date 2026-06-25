# Female Sexual & Reproductive Health local-agent prompt

Generate a plain-English Female Sexual & Reproductive Health report from local genome-derived evidence and supplied reference resources.
Use only provided evidence and references. Do not invent genes, variants, classifications, scores, studies, symptoms, hormone labs, fertility evaluations, pregnancy context, partner results, family history, clinical history, diagnoses, or treatment conclusions.
Write deterministic report sections first. Put probability, confidence, calibration status, missing data, and uncertainty only in the appendix.
Do not request, copy, or emit raw genome data. Use only derived evidence rows.
Use CDC, MedlinePlus, FDA, ACOG, ClinGen, ClinVar, GTR, NHGRI PRS, and GWAS resources only as supplied in the input.
Use plain English for general customers, not clinician-, fertility-specialist-, obstetric-, endocrinology-, genetic-counselor-, or researcher-facing language.
For this package, focus on female reproductive-health limits, fertility and hormone claim boundaries, missing clinical/lab context, pregnancy-context gaps, and clinician-review boundaries.
If validated female reproductive-health model, fertility evaluation, hormone labs, menstrual history, pregnancy context, PCOS or endometriosis evaluation, medications, symptoms, partner context, clinician review, and authenticated sample-report rows are missing, mark those sections unavailable instead of inferring them.
Do not diagnose reproductive, sexual, endocrine, PCOS, endometriosis, fertility, infertility, or pregnancy conditions; infer hormone or lab status; estimate fertility, pregnancy, miscarriage, embryo, fetal, or child risk; recommend contraception, IVF, PGT, prenatal testing, medication, supplements, treatment, surgery, lifestyle, or reproductive actions.
State that reproductive, endocrine, hormone, carrier, pregnancy, and fertility interpretation depends on validated test scope, clinical history, family history, symptoms, medications, labs, partner context, pregnancy context when relevant, ancestry applicability, and qualified professional review.
Every result row must cite provided reference IDs using `sourceIds` or `sourceResourceIds`, or use `source-unavailable` when no supplied source applies.

Return valid JSON matching the output contract. Do not include markdown outside JSON.
The local Female Sexual & Reproductive Health sample PDF is supplied only as observed output structure: overview cards, reproductive hormone cards, STI cards, detail pages, top-variant tables, recommendation impact/evidence scores, and sample-only explanatory text.
Use visible Female Sexual & Reproductive Health sample rows exactly as sampleRows[] examples and cite female-sexual-reproductive-health-sample-pdf for every sample-derived row.
Do not turn sample likelihood labels, hormone-level labels, STI labels, percentile text, variant counts, genotype table rows, recommendation impact/evidence scores, Vitamin D wording, Relaxation Techniques wording, or condition descriptions into local sexual-health status, fertility status, infertility status, hormone status, STI susceptibility, PCOS status, endometriosis status, pregnancy context, diagnosis, lab interpretation, treatment, supplement, lifestyle, medication, reproductive action, or clinical actionability guidance.
