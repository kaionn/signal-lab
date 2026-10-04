import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const bridgePath = fileURLToPath(new URL("./notify_bridge.py", import.meta.url));

export function mirrorSlack(payload, { category = "reports", event = "notification", file = null } = {}) {
  if (!["shadow", "slack"].includes(process.env.NOTIFICATION_MODE)) return { status: "disabled" };
  const args = [bridgePath, "--category", category, "--event", event];
  if (file) args.push("--file", file);
  try {
    const output = execFileSync("python3", args, { input: JSON.stringify(payload), encoding: "utf8", stdio: ["pipe", "pipe", "inherit"], timeout: 120000 });
    return JSON.parse(output);
  } catch {
    if (process.env.NOTIFICATION_MODE === "slack") {
      try { execFileSync("python3", [bridgePath, "--flag-primary-error"], { stdio: "ignore", timeout: 5000 }); } catch {}
    }
    console.error("Notification adapter unconfirmed; inspect durable receipt/outbox.");
    return { status: "adapter_failed" };
  }
}

export function shouldSendDiscord(result) {
  if (process.env.NOTIFICATION_MODE !== "slack") return true;
  try {
    execFileSync("python3", [bridgePath, "--discord-gate", "--discord-result", JSON.stringify(result ?? { status: "adapter_failed" })], { stdio: ["ignore", "ignore", "inherit"], timeout: 60000 });
    return true;
  } catch { return false; }
}

export function acknowledgeDiscord(status, result) {
  if (process.env.NOTIFICATION_MODE !== "slack") return;
  try {
    execFileSync("python3", [bridgePath, "--discord-ack-status", String(status), "--discord-result", JSON.stringify(result ?? { status: "adapter_failed" })], { stdio: ["ignore", "ignore", "inherit"], timeout: 60000 });
  } catch { console.error("Discord fallback receipt unconfirmed; reconcile manually."); }
}
