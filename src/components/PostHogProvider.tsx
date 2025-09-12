'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

// Initialize PostHog (only once)
let isInitialized = false

export default function PHProvider({ children }: Props) {
  useEffect(() => {
    if (!isInitialized && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: '/ingest',
        ui_host: 'https://us.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll handle this manually for better control
        capture_pageleave: true,
        debug: process.env.NODE_ENV === 'development'
      })
      isInitialized = true
    }
  }, [])

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>
  }

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
