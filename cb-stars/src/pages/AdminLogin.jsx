import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { IconLock } from '../components/AdminIcons.jsx'
import './admin.css'

export default function AdminLogin() {
  const auth = useAuth()
  const { tx } = useLanguage()
  const [needsSetup, setNeedsSetup] = useState(null) // null = checking
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.rpc('needs_setup').then(({ data, error: rpcError }) => {
      setNeedsSetup(rpcError ? false : !!data)
    })
  }, [])

  if (!auth.loading && auth.session && auth.profile) {
    return <Navigate to="/admin/home" replace />
  }

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError('') }

  const signIn = async (email, password) => {
    const { error: err } = await auth.signIn(email.trim(), password)
    if (err === 'no_access') setError(tx("Ce compte n'a pas accès à l'administration.", 'This account has no admin access.'))
    else if (err) setError(tx('Email ou mot de passe incorrect.', 'Wrong email or password.'))
    return !err
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')

    if (needsSetup) {
      try {
        const res = await fetch('/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          setError(json?.error || tx('Le serveur ne répond pas. Vérifiez le déploiement Vercel.', 'The server did not respond. Check the Vercel deployment.'))
          setBusy(false)
          return
        }
        setNeedsSetup(false)
      } catch {
        setError(tx('Le serveur ne répond pas. Vérifiez le déploiement Vercel.', 'The server did not respond. Check the Vercel deployment.'))
        setBusy(false)
        return
      }
    }

    await signIn(form.email, form.password)
    setBusy(false)
  }

  const setup = needsSetup === true

  return (
    <div className="adm-login">
      <form className="adm-login__card" onSubmit={submit}>
        <div className="adm-login__icon"><IconLock aria-hidden="true" /></div>
        <span className="brand-mark adm-login__logo">CB</span>
        <h1>
          {setup
            ? tx('Créer le compte propriétaire', 'Create the owner account')
            : tx('Espace administration', 'Admin area')}
        </h1>
        {setup && (
          <p className="adm-login__intro">
            {tx(
              'Première ouverture : ce compte aura tous les droits et pourra inviter le reste de l’équipe.',
              'First run: this account gets full access and can invite the rest of the team.'
            )}
          </p>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="password">{tx('Mot de passe', 'Password')}</label>
          <input
            id="password"
            type="password"
            autoComplete={setup ? 'new-password' : 'current-password'}
            required
            minLength={setup ? 8 : undefined}
            value={form.password}
            onChange={set('password')}
          />
        </div>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button type="submit" className="adm-btn adm-btn--solid adm-btn--block" disabled={busy || needsSetup === null}>
          {busy ? '…' : setup ? tx('Créer et entrer', 'Create and sign in') : tx('Entrer', 'Sign in')}
        </button>
      </form>
    </div>
  )
}
