import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function mirrorSlack(payload, { category = "reports", event = "notification", file = null } = {}) {
  if (!["shadow", "slack"].includes(process.env.NOTIFICATION_MODE)) return;
  const args = [fileURLToPath(new URL("./notify_bridge.py", import.meta.url)), "--category", category, "--event", event];
  if (file) args.push("--file", file);
  try {
    execFileSync("python3", args, { input: JSON.stringify(payload), stdio: ["pipe", "ignore", "inherit"], timeout: 120000 });
  } catch {
    console.error("Slack shadow adapter failed; Discord retained.");
  }
}

export function shouldSendDiscord() {
  if (process.env.NOTIFICATION_MODE !== "slack") return true;
  try {
    execFileSync("python3", [fileURLToPath(new URL("./notify_bridge.py", import.meta.url)), "--discord-gate"], { stdio: ["ignore", "ignore", "inherit"], timeout: 60000 });
    return true;
  } catch { return false; }
}

export function acknowledgeDiscord(status) {
  if (process.env.NOTIFICATION_MODE !== "slack") return;
  try {
    execFileSync("python3", [fileURLToPath(new URL("./notify_bridge.py", import.meta.url)), "--discord-ack-status", String(status)], { stdio: ["ignore", "ignore", "inherit"], timeout: 60000 });
  } catch { console.error("Discord fallback receipt unconfirmed; reconcile manually."); }
}
