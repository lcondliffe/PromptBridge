// Type-safe wrapper for PostHog events
export const captureEvent = (posthog: { capture: (event: string, properties?: Record<string, unknown>) => void } | null, event: string, properties?: Record<string, unknown>) => {
  if (posthog) {
    posthog.capture(event, properties)
  }
}
