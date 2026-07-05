import posthog from "posthog-js";

export type TrackEvent = "cta_click" | "signup" | "tool_use";

export function track(
  event: TrackEvent,
  slug: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (!posthog.__loaded) {
    return;
  }

  posthog.capture(event, { slug, ...props });
}
