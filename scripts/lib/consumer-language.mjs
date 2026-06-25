const wordPattern = /[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)?/g;

const jargonTerms = [
  "adverse event",
  "allele",
  "analytical performance",
  "biomarker",
  "clinical actionability",
  "clinical classification",
  "clinical sensitivity",
  "contraindication",
  "diagnosis",
  "genotype",
  "hazard ratio",
  "heterozygous",
  "homozygous",
  "metabolizer",
  "odds ratio",
  "pathogenic",
  "penetrance",
  "pharmacodynamic",
  "pharmacogenomic",
  "pharmacogenomics",
  "pharmacokinetic",
  "phenotype",
  "polygenic",
  "sensitivity",
  "specificity",
  "therapeutic",
  "variant classification",
  "zygosity",
];

const simpleBoundaryPattern =
  /\b(this|it|you|your|means|says|tells|does not|do not|cannot|only|because|not enough|unavailable|missing|without)\b/i;

const wordsFrom = (value) => (typeof value === "string" ? value.match(wordPattern) ?? [] : []);

const countJargonTerms = (text) => {
  const normalized = text.toLowerCase();
  return jargonTerms.reduce((count, term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    return count + (normalized.match(new RegExp(`\\b${escaped}\\b`, "g")) ?? []).length;
  }, 0);
};

const longestSentenceWordCount = (text) =>
  Math.max(
    0,
    ...String(text)
      .split(/[.!?;]+/)
      .map((sentence) => wordsFrom(sentence).length),
  );

export const evaluateConsumerLanguageRows = (rows, { basePath = "$.resultRows" } = {}) =>
  rows.map((row, index) => {
    const path = `${basePath}[${index}].plainEnglishMeaning`;
    const text = typeof row?.plainEnglishMeaning === "string" ? row.plainEnglishMeaning.trim() : "";
    const wordCount = wordsFrom(text).length;
    const jargonCount = countJargonTerms(text);
    const jargonDensity = wordCount === 0 ? 0 : jargonCount / wordCount;
    const longestSentenceWords = longestSentenceWordCount(text);
    const failures = [];
    const warnings = [];

    if (text.length === 0) {
      failures.push("plainEnglishMeaning must be a non-empty customer explanation");
    } else if (wordCount < 8) {
      failures.push("plainEnglishMeaning must contain at least 8 words so it is more than a label");
    }

    if (text.length > 0 && !simpleBoundaryPattern.test(text) && jargonCount > 0 && wordCount < 18) {
      warnings.push("plainEnglishMeaning may not include enough plain-language context for a general customer");
    }
    if (jargonCount >= 3 && jargonDensity > 0.08) {
      warnings.push("plainEnglishMeaning has dense clinical/genetics terminology; confirm it explains the terms plainly");
    }
    if (longestSentenceWords > 44) {
      warnings.push("plainEnglishMeaning has a long sentence; consider splitting it for general customers");
    }

    return {
      index,
      path,
      text,
      wordCount,
      jargonCount,
      jargonDensity,
      longestSentenceWords,
      failures,
      warnings,
    };
  });
