import { existsSync, readFileSync } from "node:fs";

export const officialOutputPromotionReviewSchema = "soma-reports.official-output-promotion-review.v1";
export const defaultOfficialOutputPromotionReviewPath =
  "reference/catalog/official-output-promotion-review-2026-06-24.json";

const allowedDecisions = new Set(["no-promote", "keep-boundary-only"]);

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;

const asArray = (value) => (Array.isArray(value) ? value : []);

export const loadOfficialOutputPromotionReview = (path = defaultOfficialOutputPromotionReviewPath) => {
  const problems = [];
  const entries = [];

  if (!existsSync(path)) {
    return {
      path,
      present: false,
      artifact: null,
      entries,
      entriesBySlug: new Map(),
      entriesByPath: new Map(),
      problems,
    };
  }

  let artifact;
  try {
    artifact = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      path,
      present: true,
      artifact: null,
      entries,
      entriesBySlug: new Map(),
      entriesByPath: new Map(),
      problems: [`${path}: ${error instanceof Error ? error.message : String(error)}`],
    };
  }

  if (!isPlainObject(artifact)) {
    problems.push(`${path}: review artifact must be a JSON object`);
  } else if (artifact.schemaVersion !== officialOutputPromotionReviewSchema) {
    problems.push(`${path}: schemaVersion must equal ${officialOutputPromotionReviewSchema}`);
  }

  const boundary = isPlainObject(artifact?.promotionBoundary) ? artifact.promotionBoundary : {};
  for (const key of [
    "promotesSampleBackedFormalReadiness",
    "promotesSampleRows",
    "promotesResultRows",
    "promotesCitationBindings",
  ]) {
    if (boundary[key] !== false) {
      problems.push(`${path}: promotionBoundary.${key} must be false`);
    }
  }

  const rawEntries = [
    ...asArray(artifact?.reviewedPromotionCandidates).map((entry) => ({
      reviewClass: "reviewed-promotion-candidate",
      ...entry,
    })),
    ...asArray(artifact?.reviewedBoundaryOnlyCaptures).map((entry) => ({
      reviewClass: "reviewed-boundary-only",
      ...entry,
    })),
    ...asArray(artifact?.reviewedMetadataOnlyTargets).map((entry) => ({
      reviewClass: "reviewed-metadata-only",
      ...entry,
    })),
  ];

  const entriesBySlug = new Map();
  const entriesByPath = new Map();
  for (const [index, entry] of rawEntries.entries()) {
    const label = `${path}: reviewed entry ${index + 1}`;
    if (!isPlainObject(entry)) {
      problems.push(`${label} must be an object`);
      continue;
    }
    if (!isNonEmptyString(entry.slug)) {
      problems.push(`${label} must include slug`);
      continue;
    }
    const isMetadataOnlyReview = entry.reviewClass === "reviewed-metadata-only";
    const hasOfficialCapturePath = isNonEmptyString(entry.officialCapturePath);
    if (!isMetadataOnlyReview && !hasOfficialCapturePath) {
      problems.push(`${label} must include officialCapturePath`);
      continue;
    }
    if (isMetadataOnlyReview && hasOfficialCapturePath) {
      problems.push(`${label} must not include officialCapturePath for metadata-only review`);
    }
    if (!allowedDecisions.has(entry.decision)) {
      problems.push(`${label} decision must be one of ${Array.from(allowedDecisions).join(", ")}`);
      continue;
    }
    if (hasOfficialCapturePath && !existsSync(entry.officialCapturePath)) {
      problems.push(`${label} officialCapturePath is missing: ${entry.officialCapturePath}`);
    }
    if (entriesBySlug.has(entry.slug)) {
      problems.push(`${label} duplicates review slug ${entry.slug}`);
    }
    if (hasOfficialCapturePath && entriesByPath.has(entry.officialCapturePath)) {
      problems.push(`${label} duplicates review path ${entry.officialCapturePath}`);
    }
    const sourcePaths = asArray(entry.sourcePaths);
    const sourceUrls = asArray(entry.sourceUrls);
    if (isMetadataOnlyReview && sourcePaths.length === 0 && sourceUrls.length === 0) {
      problems.push(`${label} metadata-only review needs sourcePaths or sourceUrls`);
    }
    for (const sourcePath of sourcePaths) {
      if (!isNonEmptyString(sourcePath)) {
        problems.push(`${label} sourcePaths entries must be non-empty strings`);
      } else if (!/^https?:\/\//i.test(sourcePath) && !existsSync(sourcePath)) {
        problems.push(`${label} sourcePath is missing: ${sourcePath}`);
      }
    }
    for (const sourceUrl of sourceUrls) {
      if (!isNonEmptyString(sourceUrl) || !/^https?:\/\//i.test(sourceUrl)) {
        problems.push(`${label} sourceUrls entries must be http(s) URLs`);
      }
    }

    const normalizedEntry = {
      slug: entry.slug,
      title: entry.title ?? null,
      decision: entry.decision,
      reviewClass: entry.reviewClass,
      officialCapturePath: hasOfficialCapturePath ? entry.officialCapturePath : null,
      sourcePaths,
      sourceUrls,
      promotionPreviewExit: entry.promotionPreviewExit ?? null,
      outputSignals: entry.outputSignals ?? {},
      evidencePresent: asArray(entry.evidencePresent),
      evidenceMissing: asArray(entry.evidenceMissing),
      nextEvidenceNeeded: asArray(entry.nextEvidenceNeeded),
      boundaryUse: entry.boundaryUse ?? null,
    };
    entries.push(normalizedEntry);
    entriesBySlug.set(normalizedEntry.slug, normalizedEntry);
    if (normalizedEntry.officialCapturePath) {
      entriesByPath.set(normalizedEntry.officialCapturePath, normalizedEntry);
    }
  }

  return {
    path,
    present: true,
    artifact,
    entries,
    entriesBySlug,
    entriesByPath,
    problems,
  };
};

export const officialOutputPromotionReviewFor = (review, slug, paths = []) => {
  for (const path of paths) {
    const entry = review.entriesByPath.get(path);
    if (entry) {
      return entry;
    }
  }
  const slugEntry = review.entriesBySlug.get(slug) ?? null;
  if (paths.length > 0) {
    return slugEntry?.officialCapturePath ? null : slugEntry;
  }
  return slugEntry;
};
