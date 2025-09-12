'use client'

import { useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePostHog } from 'posthog-js/react'

export function PostHogIdentifier() {
  const { user, isLoaded } = useUser()
  const posthog = usePostHog()

  useEffect(() => {
    if (!isLoaded || !posthog) return

    if (user) {
      // User is signed in - identify them
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        imageUrl: user.imageUrl,
      })
      
      // Set user properties
      posthog.setPersonProperties({
        email: user.primaryEmailAddress?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        avatar: user.imageUrl,
      })

    } else {
      // User is signed out - reset PostHog
      posthog.reset()
    }
  }, [user, isLoaded, posthog])

  return null // This component only handles side effects
}
