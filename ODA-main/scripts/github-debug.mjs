// Diagnostic — walk exclusions + .github subtree test.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const TOKEN = readFileSync("/tmp/gh-token", "utf8").trim();
const OWNER = "flawsom";
const REPO = "ODA";
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
console.log("walk count:", files.length);
console.log("has .env.local:", files.includes(".env.local"));
console.log("has node_modules:", files.some((f) => f.startsWith("node_modules")));
console.log("has _generated:", files.some((f) => f.includes("_generated")));
console.log("first 6:", files.slice(0, 6).join(", "));

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
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

// Test 1: one-entry tree with ".gitignore" (leading-dot FILE path).
const gitignore = readFileSync(".gitignore").toString("base64");
const { json: b1 } = await api("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
  content: gitignore,
  encoding: "base64",
});
const t1 = await api("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  tree: [{ path: ".gitignore", mode: "100644", type: "blob", sha: b1.sha }],
});
console.log("tree with .gitignore:", t1.status);

// Test 2: subtree for .github (relative paths inside) referenced from root.
const wf = readFileSync(".github/workflows/ci.yml").toString("base64");
const { json: b2 } = await api("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
  content: wf,
  encoding: "base64",
});
const sub = await api("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
  tree: [{ path: "ci.yml", mode: "100644", type: "blob", sha: b2.sha }],
});
console.log("workflows subtree:", sub.status);
if (sub.status === 201) {
  const root = await api("POST", `/repos/${OWNER}/${REPO}/git/trees`, {
    tree: [
      {
        path: ".github",
        mode: "040000",
        type: "tree",
        sha: sub.json.sha,
      },
    ],
  });
  console.log("root tree with .github subtree:", root.status);
}

// Test 3: Contents API with %2E-encoded .github path.
const enc = "%2Egithub/workflows/ci.yml";
const c1 = await api(
  "PUT",
  `/repos/${OWNER}/${REPO}/contents/${enc}`,
  { message: "test", content: Buffer.from("hi").toString("base64"), branch: "main" },
);
console.log("contents PUT %2E.github:", c1.status);
