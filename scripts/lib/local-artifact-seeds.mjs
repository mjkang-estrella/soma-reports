import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const defaultLocalArtifactSeedCachePath = "tmp/local-artifact-seeds.agent-cache.json";

export const readArtifactFile = (path) => JSON.parse(readFileSync(path, "utf8"));

const spawnMessage = (run, fallback) => run.error?.message || run.stderr?.trim() || run.stdout?.trim() || fallback;

const exportLocalArtifactSeeds = (cachePath) =>
  spawnSync(process.execPath, ["scripts/export-local-artifact-seeds.mjs", "--out", cachePath], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });

const runConvexArtifactSeeds = () =>
  spawnSync("npx", ["convex", "run", "reports:localArtifactSeeds"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });

export const loadArtifactSeeds = ({ seedArtifactsPath, cachePath = defaultLocalArtifactSeedCachePath } = {}) => {
  if (seedArtifactsPath) {
    return { artifacts: readArtifactFile(seedArtifactsPath), error: null, source: seedArtifactsPath };
  }

  const localRun = exportLocalArtifactSeeds(cachePath);
  if (localRun.status === 0) {
    try {
      return { artifacts: readArtifactFile(cachePath), error: null, source: cachePath };
    } catch (error) {
      return {
        artifacts: [],
        error: error instanceof Error ? error.message : String(error),
        source: cachePath,
      };
    }
  }

  const convexRun = runConvexArtifactSeeds();
  if (convexRun.status !== 0) {
    return {
      artifacts: [],
      error: spawnMessage(
        convexRun,
        `local artifact export failed: ${spawnMessage(localRun, `export exited with ${localRun.status}`)}; convex run exited with ${convexRun.status}`,
      ),
      source: "convex:reports:localArtifactSeeds",
    };
  }

  try {
    const parsed = JSON.parse(convexRun.stdout);
    return {
      artifacts: Array.isArray(parsed) ? parsed : [],
      error: Array.isArray(parsed) ? null : "reports:localArtifactSeeds must return a JSON array",
      source: "convex:reports:localArtifactSeeds",
    };
  } catch (error) {
    return {
      artifacts: [],
      error: error instanceof Error ? error.message : String(error),
      source: "convex:reports:localArtifactSeeds",
    };
  }
};
