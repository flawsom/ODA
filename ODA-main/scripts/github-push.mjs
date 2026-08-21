// Final: push ODA to GitHub as ONE clean root commit via the Git Data API.
// Works around the create-tree 404 for ".github/**" paths by building a
// nested subtree. Token read from /tmp/gh-token. Deleted after use.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TOKEN = readFileSync("/tmp/gh-token", "utf8").trim();
const OWNER = "flawsom";
const REPO = "ODA";
const BRANCH = "main";
const MSG =
  "feat: ODA — Omniscient Document Architect — free forever, open source";

const EXCLUDE = new Set([
  "node_modules",
  ".git",
  "dist",
  "_generated",
  ".env.local",
  "package-lock.json",
  "main.ts",
  "integrations.md",
  "sst-env.d.ts",
  "github-push.mjs",
  "github-debug.mjs",
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(".", p).replace(/\\/g, "/");
    const segs = rel.split("/");
    if (segs.some((s) => EXCLUDE.has(s))) continue;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(rel);
  }
  return out;
}

const files = walk(".").sort();

// Safety: never push secrets or cruft.
for (const f of files) {
  if (
    f.includes(".env.local") ||
    f.startsWith("node_modules") ||
    f.includes("/_generated/") ||
    f === "package-lock.json" ||
    f === "main.ts" ||
    f === "integrations.md" ||
    f === "sst-env.d.ts"
  ) {
    throw new Error(`forbidden path in manifest: ${f}`);
  }
}
console.log(`manifest: ${files.length} files`);

const api = async (method, path, body) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "oda-push",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
};

// Blobs.
const blobOf = new Map();
for (const f of files) {
  const { sha } = await api("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: readFileSync(f).toString("base64"),
    encoding: "base64",
  });
  blobOf.set(f, sha);
}
console.log(`blobs: ${blobOf.size}`);

// .github subtree (relative paths, then referenced from root as 040000 tree).
const wf = files.filter((f) => f.startsWith(".github/workflows/"));
const { sha: subSha } = await api(
  "POST",
  `/repos/${OWNER}/${REPO}/git/trees`,
  {
    tree: wf.map((f) => ({
      // Relative to .github — keep the workflows/ nesting so GitHub Actions
      // actually finds the workflows at .github/workflows/*.yml.
      path: f.replace(".github/", ""),
      mode: "100644",
      type: "blob",
      sha: blobOf.get(f),
    })),
  },
);
console.log(`github subtree: ${wf.length} workflow files`);

// Root tree: everything else as full paths + the .github subtree entry.
const others = files
  .filter((f) => !f.startsWith(".github/"))
  .map((f) => ({
    path: f,
    mode: "100644",
    type: "blob",
    sha: blobOf.get(f),
  }));
const rootRes = await api("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  tree: [...others, { path: ".github", mode: "040000", type: "tree", sha: subSha }],
});
console.log(`root tree: ${rootRes.sha}`);

// Commit (root, no parents).
const me = await api("GET", "/user");
const login = me.login ?? "ODA";
const email =
  typeof me.email === "string" && me.email.length > 0
    ? me.email
    : `${login}@users.noreply.github.com`;
const { sha: commitSha } = await api(
  "POST",
  `/repos/${OWNER}/${REPO}/git/commits`,
  {
    message: MSG,
    tree: rootRes.sha,
    parents: [],
    author: { name: login, email },
    committer: { name: "ODA Forge", email: "forge@users.noreply.github.com" },
  },
);
console.log(`commit: ${commitSha}`);

// Force the branch ref to the clean root commit.
await api("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
  sha: commitSha,
  force: true,
});

// Description.
await api("PATCH", `/repos/${OWNER}/${REPO}`, {
  description:
    "Every document. Understood. Answered. — ODA, the Omniscient Document Architect: free-forever, open-source document intelligence with an on-device neural forge.",
});

console.log(`\nDone: ${files.length} files, one commit, on ${OWNER}/${REPO}@${BRANCH}`);
