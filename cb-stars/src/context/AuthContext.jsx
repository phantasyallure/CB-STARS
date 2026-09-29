import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { can as canDo } from '../lib/permissions.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still checking
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null) // keep this synchronous; load the profile in the effect below
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id
  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return null
    }
    setProfileLoading(true)
    const { data } = await supabase.from('admin_profiles').select('*').eq('user_id', userId).maybeSingle()
    const active = data && data.active ? data : null
    setProfile(active)
    setProfileLoading(false)
    return active
  }, [userId])

  useEffect(() => {
    if (session === undefined) return
    loadProfile()
  }, [session, loadProfile])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'invalid' }
    const { data: p } = await supabase.from('admin_profiles').select('*').eq('user_id', data.user.id).maybeSingle()
    if (!p || !p.active) {
      await supabase.auth.signOut()
      return { error: 'no_access' }
    }
    return { error: null }
  }, [])

  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const value = useMemo(
    () => ({
      session,
      profile,
      loading: session === undefined || profileLoading,
      signIn,
      signOut,
      can: (perm) => canDo(profile, perm),
    }),
    [session, profile, profileLoading, signIn, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
