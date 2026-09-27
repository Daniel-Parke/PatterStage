// Fail before a hidden-inclusive Pages upload if the generated tree has an
// unexpected hidden path or a link that the uploader would dereference.
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";

function requiredStat(path, missingMessage) {
  try {
    return lstatSync(path);
  } catch {
    throw new Error(missingMessage);
  }
}

export function checkPublishArtifact(root) {
  const rootStat = requiredStat(root, "site directory is missing or unreadable");
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("site root must be a real directory");
  }

  let hasIndex = false;
  let hasNoJekyll = false;
  const walk = (directory, depth) => {
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      throw new Error("site directory is unreadable");
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const stat = requiredStat(path, "site entry disappeared during inspection");
      if (stat.isSymbolicLink()) throw new Error("site contains a symbolic link");
      const isNoJekyll = depth === 0 && entry.name === ".nojekyll";
      if (entry.name.startsWith(".") && !isNoJekyll) {
        throw new Error("site contains an unexpected hidden path");
      }
      if (stat.isDirectory()) {
        walk(path, depth + 1);
      } else if (stat.isFile()) {
        if (isNoJekyll) {
          if (stat.size !== 0) throw new Error(".nojekyll must be empty");
          hasNoJekyll = true;
        }
        if (depth === 0 && entry.name === "index.html") {
          if (stat.size === 0) throw new Error("index.html must not be empty");
          hasIndex = true;
        }
      } else {
        throw new Error("site contains an unsupported filesystem entry");
      }
    }
  };
  walk(root, 0);
  if (!hasIndex) throw new Error("site is missing a nonempty index.html");
  if (!hasNoJekyll) throw new Error("site is missing an empty .nojekyll");
}

if (process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("/check-publish-artifact.mjs")) {
  try {
    if (process.argv.length !== 3) throw new Error("provide exactly one site directory");
    checkPublishArtifact(process.argv[2]);
    console.log("publish-artifact: site contents are safe to upload");
  } catch (error) {
    console.error(`publish-artifact: ${error.message}`);
    process.exitCode = 1;
  }
}
