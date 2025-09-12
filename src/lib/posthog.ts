// Type-safe wrapper for PostHog events
export const captureEvent = (posthog: any, event: string, properties?: any) => {
  if (posthog) {
    posthog.capture(event, properties)
  }
}
