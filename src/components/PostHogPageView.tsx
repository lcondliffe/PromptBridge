'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { usePostHog } from 'posthog-js/react'

export default function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  useEffect(() => {
    if (posthog) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url += `?${searchParams.toString()}`
      }
      
      posthog.capture('$pageview', {
        '$current_url': url,
      })
    }
  }, [pathname, searchParams, posthog])

  return null
}
