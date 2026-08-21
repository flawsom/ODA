// Fast-forward a branch ref to an already-created commit via the git smart
// HTTP protocol (git-receive-pack) — no git CLI, no REST ref-update needed.
// All objects (blobs/trees/commit) already exist on the server, so this is a
// zero-object push: a ref-update command plus an empty packfile.
//
// Run: bun scripts/github-push-ref.mjs <old-sha> <new-sha> <ref>
//      (token in /tmp/gh-token)

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const TOKEN = readFileSync("/tmp/gh-token", "utf8").trim();
const [, , OLD_SHA, NEW_SHA, REF] = process.argv;
if (!OLD_SHA || !NEW_SHA || !REF) {
  console.error("usage: bun scripts/github-push-ref.mjs <old-sha> <new-sha> <ref>");
  process.exit(1);
}

// Advertise first so we see the repo's capabilities (e.g. object-format).
const advert = await fetch(
  `https://github.com/flawsom/ODA.git/info/refs?service=git-receive-pack`,
  {
    headers: {
      Authorization: `Basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`,
      "User-Agent": "git/2.40.0",
      Accept: "*/*",
    },
  },
);
const advertText = await advert.text();
console.log("advert status:", advert.status);
const objectFormat = advertText.includes("object-format=sha256") ? "sha256" : "sha1";
console.log("object format:", objectFormat);

const pkt = (payload) => (payload.length + 4).toString(16).padStart(4, "0") + payload;

// Ref-update command with capabilities.
const cmd = pkt(`${OLD_SHA} ${NEW_SHA} ${REF}\0 report-status side-band-64k agent=oda-push/1.0\n`);
const flush = "0000";

// Empty packfile: "PACK" + version 2 + 0 objects + digest trailer.
const header = Buffer.concat([
  Buffer.from("PACK"),
  Buffer.from([0, 0, 0, 2]),
  Buffer.from([0, 0, 0, 0]),
]);
const hash = createHash(objectFormat === "sha256" ? "sha256" : "sha1")
  .update(header)
  .digest();
const pack = Buffer.concat([header, hash]);

const body = Buffer.concat([Buffer.from(cmd + flush), pack]);

const res = await fetch("https://github.com/flawsom/ODA.git/git-receive-pack", {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`,
    "Content-Type": "application/x-git-receive-pack-request",
    Accept: "application/x-git-receive-pack-result",
    "User-Agent": "git/2.40.0",
  },
  body,
});
const text = await res.text();
console.log("receive-pack status:", res.status);
console.log("response:", text.slice(0, 1500));
if (text.includes("ok ") && !text.includes("ng ")) {
  console.log(`\nOK: ${REF} ${OLD_SHA.slice(0, 10)} → ${NEW_SHA.slice(0, 10)}`);
} else {
  console.error("\nPush was not accepted cleanly.");
  process.exit(1);
}
