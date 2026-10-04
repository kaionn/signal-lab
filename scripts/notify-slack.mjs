import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function mirrorSlack(payload, { category = "reports", event = "notification", file = null } = {}) {
  if (process.env.NOTIFICATION_MODE !== "shadow") return;
  const args = [fileURLToPath(new URL("./notify_bridge.py", import.meta.url)), "--category", category, "--event", event];
  if (file) args.push("--file", file);
  try {
    execFileSync("python3", args, { input: JSON.stringify(payload), stdio: ["pipe", "ignore", "inherit"], timeout: 120000 });
  } catch {
    console.error("Slack shadow adapter failed; Discord retained.");
  }
}
