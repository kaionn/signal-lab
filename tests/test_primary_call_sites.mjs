import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
process.env.DISCORD_WEBHOOK_URL = "https://discord.invalid/synthetic-only";
function compile(file, start, end, params) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const section = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
  const body = section.slice(section.indexOf("{") + 1, section.lastIndexOf("}"));
  return new AsyncFunction(...params, "mirrorSlack", "shouldSendDiscord", "acknowledgeDiscord", "fetch", "fs", "path", "setTimeout", body);
}
const draft = compile("../scripts/post-draft.mjs", "async function sendDiscord(", "\nasync function main()", ["meta", "slug", "body", "reply", "screenshotPath"]);
const weekly = compile("../scripts/weekly-digest.mjs", "async function sendToDiscord(", "\nfunction graduateIssueExists(", ["embed"]);
for (const allow of [false, true]) {
  let fetches=0, acknowledgements=0, mirrored=0;
  await draft({title:"synthetic"}, "test", "body", "reply", null, () => mirrored++, () => allow, status => {assert.equal(status,204);acknowledgements++;}, async () => {fetches++;return {ok:true,status:204};}, fs, path, callback => callback());
  assert.equal(mirrored,1);assert.equal(fetches,allow ? 3 : 0);assert.equal(acknowledgements,allow ? 1 : 0);
  fetches=0;acknowledgements=0;mirrored=0;
  await weekly({title:"synthetic"}, () => mirrored++, () => allow, status => {assert.equal(status,204);acknowledgements++;}, async () => {fetches++;return {ok:true,status:204};}, fs, path, callback => callback());
  assert.equal(mirrored,1);assert.equal(fetches,allow ? 1 : 0);assert.equal(acknowledgements,allow ? 1 : 0);
}
let fetches=0, acknowledgements=0;
await assert.rejects(draft({title:"synthetic"}, "test", "body", "reply", null, () => {}, () => true, () => acknowledgements++, async () => {fetches++;return {ok:fetches===1,status:fetches===1?204:503};}, fs, path, callback => callback()));
assert.equal(fetches,2);assert.equal(acknowledgements,0);
console.log("Primary Node call-site checks: success suppression, full fallback acknowledgement, partial fallback unconfirmed passed");

process.env.NOTIFICATION_MODE = "slack";
delete process.env.DISCORD_WEBHOOK_URL;
const { shouldSendDiscord: realGate } = await import("../scripts/notify-slack.mjs");
for (const status of ["sent", "known_rejected", "needs_reconciliation"]) {
  let fetches=0, mirrored=0;
  const mirror = () => {mirrored++;return {status};};
  const forbiddenFetch = async () => {fetches++;throw new Error("Discord forbidden");};
  await draft({title:"synthetic"}, "test", "body", "reply", null, mirror, realGate, () => {throw new Error("Discord acknowledgement forbidden");}, forbiddenFetch, fs, path, callback => callback());
  await weekly({title:"synthetic"}, mirror, realGate, () => {throw new Error("Discord acknowledgement forbidden");}, forbiddenFetch, fs, path, callback => callback());
  assert.equal(mirrored,2);assert.equal(fetches,0);
}
console.log("Slack-only actual Node gate: success/rejection/unknown all suppress Discord without its secret.");
