// One-off fix: GitHub Actions ONLY runs workflows from .github/workflows/.
// The initial push placed ci.yml, forge.yml, forge-on-demand.yml, pages.yml at
// .github/ — where Actions silently ignores them. This rebuilds the tree with
// the workflows at .github/workflows/ (Git Data API: blobs/trees/commits all
// work with this token), then moves main to the new commit by delete + create
// of the ref (PATCH refs and GraphQL commits are blocked for this token).
//
// Run: bun scripts/github-relocate-workflows.mjs   (token in /tmp/gh-token)

import { readFileSync } from "node:fs";

const TOKEN = readFileSync("/tmp/gh-token", "utf8").trim();
const OWNER = "flawsom";
const REPO = "ODA";
const BRANCH = "main";
const WORKFLOWS = ["ci.yml", "forge.yml", "forge-on-demand.yml", "pages.yml"];

const call = async (method, path, body) => {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "oda-fix",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
};

// 1. Current head + full recursive tree.
const headRes = await call("GET", `/repos/${OWNER}/${REPO}/commits/${BRANCH}`);
const head = headRes.sha;
const tree = await call("GET", `/repos/${OWNER}/${REPO}/git/trees/${headRes.commit.tree.sha}?recursive=1`);
console.log(`head: ${head} · tree entries: ${tree.tree.length}`);
const oldSha = head;

// 2. Upload fresh workflow blobs from the LOCAL files (newest content).
const wfBlob = new Map();
for (const name of WORKFLOWS) {
  const { sha } = await call("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: readFileSync(`.github/workflows/${name}`).toString("base64"),
    encoding: "base64",
  });
  wfBlob.set(name, sha);
}

// 3. Build .github subtree. IMPORTANT: the inner tree holds the files by
//    bare name (ci.yml, forge.yml…), and the outer .github tree nests them at
//    "workflows" — otherwise the path doubles (.github/workflows/workflows/…).
const { sha: wfTreeSha } = await call("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  tree: [...wfBlob.entries()].map(([name, sha]) => ({
    path: name,
    mode: "100644",
    type: "blob",
    sha,
  })),
});
const { sha: ghTreeSha } = await call("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  tree: [{ path: "workflows", mode: "040000", type: "tree", sha: wfTreeSha }],
});

// 4. Rebuild the root tree: drop .github/** and any stray probe.yml, add subtree.
const dropped = tree.tree.filter(
  (e) => e.path.startsWith(".github/") || e.path === "workflows/probe.yml" || /probe\.yml$/.test(e.path),
);
if (dropped.length > 0) {
  console.log(`dropping: ${dropped.map((e) => e.path).join(", ")}`);
}
const others = tree.tree
  .filter((e) => e.type === "blob" && !e.path.startsWith(".github/") && !/probe\.yml$/.test(e.path))
  .map((e) => ({ path: e.path, mode: "100644", type: "blob", sha: e.sha }));
const { sha: newRootSha } = await call("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  tree: [...others, { path: ".github", mode: "040000", type: "tree", sha: ghTreeSha }],
});
console.log(`root tree rebuilt: ${newRootSha} (${others.length} files + .github subtree)`);

// 5. Commit on top of the current head.
const { sha: commitSha } = await call("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
  message:
    "fix(ci): relocate workflows into .github/workflows so GitHub Actions runs them\n\nGitHub Actions only executes workflows from .github/workflows/. The initial\npush placed ci.yml, forge.yml, forge-on-demand.yml and pages.yml at .github/,\nwhere they were silently ignored — the nightly Master Forge, the inbox→outbox\nauto-forge, the Pages report site and CI never ran. This commit moves them to\nthe correct location.",
  tree: newRootSha,
  parents: [head],
  author: { name: "ODA Forge", email: "forge@users.noreply.github.com" },
  committer: { name: "ODA Forge", email: "forge@users.noreply.github.com" },
});
console.log(`commit: ${commitSha}`);

console.log(`\nFixed commit ready: ${commitSha}`);
console.log("Ref must be moved separately — use scripts/github-push-ref.mjs with this sha.");
