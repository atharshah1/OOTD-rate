import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAuthSession() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session)
        setLoading(false)
      }
    )

    return () => subscription?.unsubscribe()
  }, [supabase.auth])

  return { session, loading }
}
