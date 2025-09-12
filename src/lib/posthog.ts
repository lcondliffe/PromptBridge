import type { PostHog } from 'posthog-js';

// Type-safe wrapper for PostHog events
export const captureEvent = (
  posthog: PostHog | null | undefined,
  event: string,
  properties?: Record<string, any>
) => {
  if (!posthog) return;
  posthog.capture(event, properties);
};
