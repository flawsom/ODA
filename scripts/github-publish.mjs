// Publish the ENTIRE local tree to flawsom/ODA in one step.
//
// How it works:
//   1. Walk the local filesystem (excluding .git, node_modules, build output).
//   2. Upload every file as a git blob, build nested trees via the Git Data API.
//   3. Commit on top of the current main head.
//   4. Fast-forward main over the git smart-HTTP protocol (git-receive-pack).
//
// Requirements: a PAT with `workflow` + `repo` (or fine-grained: Contents and
// Workflows write) — needed because the repo carries .github/workflows files.
//
// Usage:  TOKEN=<pat> bun scripts/github-publish.mjs   (or PAT in /tmp/gh-token)
// Safe to re-run: builds from the current main head and current local files.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OWNER = "flawsom";
const REPO = "ODA";
const BRANCH = "main";

const TOKEN = (process.env.TOKEN || readFileSync("/tmp/gh-token", "utf8")).trim();
const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}`;

const call = async (method, path, body) => {
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "oda-publish",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
};

const EXCLUDE = new Set([".git", "node_modules", "dist", "forge-reports", "outbox"]);
const SKIP_NAMES = new Set([".env", ".env.local", ".env.example", "package-lock.json", "sst-env.d.ts", "bun.lockb"]);

function walk(dir, base = process.cwd()) {
  const out = [];
  for (const name of readdirSync(join(base, dir))) {
    if (EXCLUDE.has(name) || SKIP_NAMES.has(name)) continue;
    const full = join(base, dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(relative(process.cwd(), full)));
    } else {
      out.push(relative(process.cwd(), full).split(sep).join("/"));
    }
  }
  return out;
}

async function createBlob(content) {
  const { sha } = await call("POST", "/git/blobs", {
    content: Buffer.from(content).toString("base64"),
    encoding: "base64",
  });
  return sha;
}

// Recursively build git trees from flat entries ({path, content}).
async function buildTree(entries) {
  const tree = [];
  const dirs = new Map();
  for (const e of entries) {
    const idx = e.path.indexOf("/");
    if (idx === -1) {
      const sha = await createBlob(e.content);
      tree.push({ path: e.path, mode: "100644", type: "blob", sha });
    } else {
      const top = e.path.slice(0, idx);
      if (!dirs.has(top)) dirs.set(top, []);
      dirs.get(top).push({ path: e.path.slice(idx + 1), content: e.content });
    }
  }
  for (const [dir, sub] of dirs) {
    const { sha } = await buildTree(sub);
    tree.push({ path: dir, mode: "040000", type: "tree", sha });
  }
  const { sha } = await call("POST", "/git/trees", { tree });
  return { sha };
}

// 1. Local files.
const paths = walk(".").sort();
const entries = paths.map((p) => ({ path: p, content: readFileSync(p) }));
console.log(`local files: ${entries.length}`);

// 2. Root tree.
const { sha: rootSha } = await buildTree(entries);

// 3. Current head + commit on top.
const headRes = await call("GET", `/commits/${BRANCH}`);
const head = headRes.sha;
const { sha: commitSha } = await call("POST", "/git/commits", {
  message:
    "feat(glossary): block custom entries that would shadow another custom row\n\n- The Glossary save handlers now reject a new or edited custom entry whose\n  source collides with a DIFFERENT stored custom row: sentences on the\n  source template, tokens on table + key, case- and whitespace-insensitive\n  exactly like the engine's matchers (the overlay can't tell two identical\n  rows apart, so the newest would silently win). The block names the\n  existing entry and points the user at editing it instead; editing a row\n  without changing its source is unaffected (self excluded by id).\n- The canonical collision key lives in glossaryIO.ts (glossaryRowKey) and\n  is shared with the import planner, so page saves, in-file imports and\n  re-imports all use the same identity rule.\n- t-glossary-io.ts gains 8 collision checks (case, whitespace, cross-\n  table, sentence-vs-token, in-file duplicate via the shared key). UI\n  verified in the dev-server preview: a colliding save is blocked with an\n  explanatory toast and the form stays open, while editing the same row\n  reaches the mutation.\n- Regression green: e2e-regression 4/4, io round-trip, en-key guard, hits\n  test, overlay growth, precision suites, tsc clean.",
  tree: rootSha,
  parents: [head],
  author: { name: "ODA Forge", email: "forge@users.noreply.github.com" },
  committer: { name: "ODA Forge", email: "forge@users.noreply.github.com" },
});
console.log(`commit: ${commitSha} (parent ${head.slice(0, 10)}, tree ${rootSha.slice(0, 10)})`);

// 4. Push via git smart HTTP (fast-forward; zero objects — all exist server-side).
const pkt = (payload) => (payload.length + 4).toString(16).padStart(4, "0") + payload;
const cmd = pkt(`${head} ${commitSha} refs/heads/${BRANCH}\0 report-status side-band-64k agent=oda-publish/1.0\n`);
const header = Buffer.concat([Buffer.from("PACK"), Buffer.from([0, 0, 0, 2]), Buffer.from([0, 0, 0, 0])]);
const pack = Buffer.concat([header, createHash("sha1").update(header).digest()]);
const auth = `Basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`;

const push = await fetch(`https://github.com/${OWNER}/${REPO}.git/git-receive-pack`, {
  method: "POST",
  headers: {
    Authorization: auth,
    "Content-Type": "application/x-git-receive-pack-request",
    Accept: "application/x-git-receive-pack-result",
    "User-Agent": "git/2.40.0",
  },
  body: Buffer.concat([Buffer.from(cmd + "0000"), pack]),
});
const text = await push.text();
console.log("push response:", text.replace(/\u0000/g, "").replace(/\u0001/g, "|").replace(/\u0002/g, "|").slice(0, 900));

if (!text.includes("unpack ok") || text.includes("ng refs")) {
  console.error("\nPush refused — check the token has the `workflow` scope (see header comment).");
  process.exit(1);
}

// 5. Verify the new head.
const head2 = await call("GET", `/commits/${BRANCH}`);
const tree2 = await call("GET", `/git/trees/${head2.commit.tree.sha}?recursive=1`);
const wf = tree2.tree.filter((t) => t.path.startsWith(".github/workflows/") && t.type === "blob");
const hasNewEngine = tree2.tree.some((t) => t.path === "src/lib/oda/adaptive.ts");
const hasInboxDoc = tree2.tree.some((t) => t.path.startsWith("inbox/") && t.path !== "inbox/README.md");
console.log(`\nVerified: workflows=${wf.map((t) => t.path.split("/").pop()).sort().join(",")} · adaptive.ts=${hasNewEngine} · inbox-doc=${hasInboxDoc}`);
console.log(`Published: ${OWNER}/${REPO}@${BRANCH} → ${head2.sha}`);
