import { useEffect, useState } from 'react'

import { getSessionContext } from '../services/loyaltyBackend'
import type { AuthUser } from '../types/auth'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'No pudimos validar el acceso a esta aplicacion.'
}

export function useSessionContext() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadSession = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const sessionUser = await getSessionContext()

        if (isMounted) {
          setUser(sessionUser)
        }
      } catch (sessionError) {
        if (isMounted) {
          setError(getErrorMessage(sessionError))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadSession()

    return () => {
      isMounted = false
    }
  }, [])

  return {
    error,
    isAuthenticated: Boolean(user),
    isLoading,
    user,
  }
}
