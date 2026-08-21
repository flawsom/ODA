// Fix commit via GraphQL createCommitOnBranch: relocate workflows from
// .github/*.yml (wrong — Actions won't run them) to .github/workflows/*.yml.
import { readFileSync } from "node:fs";

const TOKEN = readFileSync("/tmp/gh-token", "utf8").trim();

const WF = [
  "ci.yml",
  "forge-on-demand.yml",
  "forge.yml",
  "pages.yml",
];

const additions = WF.map(
  (f) =>
    `{ path: ".github/workflows/${f}", contents: "${readFileSync(`.github/workflows/${f}`).toString("base64")}" }`,
).join("\n");
const deletions = WF.map((f) => `{ path: ".github/${f}" }`).join("\n");

const mutation = `
mutation {
  createCommitOnBranch(
    input: {
      branch: { repositoryNameWithOwner: "flawsom/ODA", branchName: "main" }
      message: { headline: "fix: relocate GitHub workflows into .github/workflows", body: "GitHub Actions only runs workflows from .github/workflows — the initial push placed them one level up." }
      expectedHeadOid: "6a35d91a820e0601d023cb0ff68d27105d5a794d"
      fileChanges: {
        additions: [
${additions}
        ]
        deletions: [
${deletions}
        ]
      }
    }
  ) {
    commit { oid }
    ref { name }
  }
}
`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
    "User-Agent": "oda-push",
  },
  body: JSON.stringify({ query: mutation }),
});

const json = await res.json();
if (json.errors) {
  console.error("GraphQL errors:", JSON.stringify(json.errors, null, 2));
  process.exit(1);
}
console.log("Created commit:", json.data?.createCommitOnBranch?.commit?.oid);
console.log("Branch:", json.data?.createCommitOnBranch?.ref?.name);
