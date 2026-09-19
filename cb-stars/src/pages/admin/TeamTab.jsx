import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { apiFetch } from '../../lib/api.js'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { PERMISSIONS, ROLE_PRESETS } from '../../lib/permissions.js'
import { formatDateTime } from '../../lib/format.js'
import Modal from '../../components/Modal.jsx'
import { IconPlus, IconEdit, IconTrash, IconKey, IconUsers } from '../../components/AdminIcons.jsx'

function randomPassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(bytes, (n) => chars[n % chars.length]).join('')
}

function PermissionPicker({ value, onChange }) {
  const { lang, tx } = useLanguage()
  const l = lang === 'en' ? 'en' : 'fr'
  const toggle = (id) => onChange(value.includes(id) ? value.filter((p) => p !== id) : [...value, id])

  return (
    <div className="perms">
      <div className="perms__presets">
        <span>{tx('Modèles rapides', 'Quick presets')}</span>
        {ROLE_PRESETS.map((r) => (
          <button key={r.id} type="button" className="chip" onClick={() => onChange(r.permissions)}>{r[l]}</button>
        ))}
      </div>
      <ul className="perms__list">
        {PERMISSIONS.map((p) => (
          <li key={p.id}>
            <label className="perm">
              <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} />
              <span>
                <strong>{p[l].label}</strong>
                <small>{p[l].hint}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function TeamTab() {
  const { lang, tx } = useLanguage()
  const { notify } = useOutletContext()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [dialog, setDialog] = useState(null) // { mode: 'add' } | { mode: 'edit', member } | { mode: 'password', member }

  const apiError = useCallback((err) => (
    err.code === 'API_UNAVAILABLE'
      ? tx('Les fonctions serveur ne répondent pas (déployez sur Vercel ou lancez « vercel dev »).', 'Server functions are not responding (deploy to Vercel or run "vercel dev").')
      : err.message
  ), [tx])

  const load = useCallback(async () => {
    try {
      const { members: list } = await apiFetch('team')
      setMembers(list)
      setLoadError('')
    } catch (err) {
      setLoadError(apiError(err))
    }
    setLoading(false)
  }, [apiError])

  useEffect(() => { load() }, [load])

  const uiLang = lang === 'en' ? 'en' : 'fr'
  const permLabel = (id) => PERMISSIONS.find((p) => p.id === id)?.[uiLang].label || id

  const toggleActive = async (m) => {
    try {
      await apiFetch('team', { method: 'PATCH', body: { userId: m.user_id, active: !m.active } })
      notify(m.active ? tx('Accès suspendu.', 'Access suspended.') : tx('Accès rétabli.', 'Access restored.'))
      load()
    } catch (err) { notify(apiError(err), 'err') }
  }

  const remove = async (m) => {
    if (!confirm(tx(`Supprimer définitivement l’accès de ${m.full_name || m.email} ?`, `Permanently remove ${m.full_name || m.email}?`))) return
    try {
      await apiFetch(`team?userId=${encodeURIComponent(m.user_id)}`, { method: 'DELETE' })
      notify(tx('Membre supprimé.', 'Member removed.'))
      load()
    } catch (err) { notify(apiError(err), 'err') }
  }

  return (
    <>
      <div className="adm-head">
        <div>
          <h2>{tx('Équipe', 'Team')}</h2>
          <p className="adm-sub">{tx('Créez des accès et choisissez ce que chaque personne peut ouvrir.', 'Create accounts and choose what each person can open.')}</p>
        </div>
        <button type="button" className="adm-btn adm-btn--solid" onClick={() => setDialog({ mode: 'add' })}>
          <IconPlus /> {tx('Ajouter un membre', 'Add member')}
        </button>
      </div>

      <div className="adm-card adm-card--flush">
        {loading && <p className="adm-hint adm-pad">{tx('Chargement…', 'Loading…')}</p>}
        {loadError && <p className="adm-error adm-pad">{loadError}</p>}
        {!loading && !loadError && members.length === 0 && (
          <div className="adm-empty"><IconUsers /><h3>{tx('Aucun membre', 'No members')}</h3></div>
        )}

        <ul className="mlist">
          {members.map((m) => (
            <li key={m.user_id} className={`mrow ${m.active ? '' : 'is-off'}`}>
              <div className="mrow__who">
                <strong>{m.full_name || m.email}</strong>
                <span>{m.email}</span>
                <small>
                  {m.last_sign_in_at
                    ? `${tx('Dernière connexion', 'Last sign-in')}: ${formatDateTime(m.last_sign_in_at, uiLang)}`
                    : tx('Jamais connecté', 'Never signed in')}
                </small>
              </div>
              <div className="mrow__perms">
                {m.role === 'owner' ? (
                  <span className="adm-pill adm-pill--owner">{tx('Propriétaire : accès complet', 'Owner: full access')}</span>
                ) : m.permissions.length === 0 ? (
                  <span className="adm-hint">{tx('Aucune permission', 'No permissions')}</span>
                ) : (
                  m.permissions.map((p) => <span key={p} className="adm-tag">{permLabel(p)}</span>)
                )}
                {!m.active && <span className="adm-pill adm-pill--danger">{tx('Suspendu', 'Suspended')}</span>}
              </div>
              <div className="mrow__actions">
                <button type="button" className="adm-btn adm-btn--small" onClick={() => setDialog({ mode: 'password', member: m })}>
                  <IconKey /> {tx('Mot de passe', 'Password')}
                </button>
                {m.role !== 'owner' && (
                  <>
                    <button type="button" className="adm-btn adm-btn--small" onClick={() => setDialog({ mode: 'edit', member: m })}>
                      <IconEdit /> {tx('Permissions', 'Permissions')}
                    </button>
                    <button type="button" className="adm-btn adm-btn--small" onClick={() => toggleActive(m)}>
                      {m.active ? tx('Suspendre', 'Suspend') : tx('Réactiver', 'Reactivate')}
                    </button>
                    <button type="button" className="adm-btn adm-btn--small adm-btn--danger" onClick={() => remove(m)} aria-label={tx('Supprimer', 'Remove')}>
                      <IconTrash />
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {dialog?.mode === 'add' && <AddMember onClose={() => setDialog(null)} onDone={() => { setDialog(null); load() }} notify={notify} apiError={apiError} />}
      {dialog?.mode === 'edit' && <EditPermissions member={dialog.member} onClose={() => setDialog(null)} onDone={() => { setDialog(null); load() }} notify={notify} apiError={apiError} />}
      {dialog?.mode === 'password' && <ResetPassword member={dialog.member} onClose={() => setDialog(null)} onDone={() => setDialog(null)} notify={notify} apiError={apiError} />}
    </>
  )
}

function AddMember({ onClose, onDone, notify, apiError }) {
  const { tx } = useLanguage()
  const [form, setForm] = useState({ fullName: '', email: '', password: randomPassword() })
  const [permissions, setPermissions] = useState(ROLE_PRESETS[0].permissions)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  const set = (f) => (e) => setForm((x) => ({ ...x, [f]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await apiFetch('team', { method: 'POST', body: { ...form, permissions } })
      setCreated(true)
      notify(tx('Membre créé.', 'Member created.'))
    } catch (err) {
      setError(apiError(err))
    }
    setBusy(false)
  }

  if (created) {
    return (
      <Modal title={tx('Accès créé', 'Access created')} onClose={onDone} closeLabel={tx('Fermer', 'Close')}
        footer={<button type="button" className="adm-btn adm-btn--solid" onClick={onDone}>{tx('Terminé', 'Done')}</button>}>
        <p className="adm-hint">{tx('Transmettez ces identifiants à la personne. Le mot de passe ne sera plus affiché.', 'Give these details to the person. The password will not be shown again.')}</p>
        <dl className="creds">
          <dt>Email</dt><dd>{form.email}</dd>
          <dt>{tx('Mot de passe', 'Password')}</dt><dd>{form.password}</dd>
          <dt>{tx('Adresse', 'Address')}</dt><dd>{window.location.origin}/admin</dd>
        </dl>
      </Modal>
    )
  }

  return (
    <Modal title={tx('Ajouter un membre', 'Add a member')} onClose={onClose} closeLabel={tx('Fermer', 'Close')}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose}>{tx('Annuler', 'Cancel')}</button>
          <button type="submit" form="add-member" className="adm-btn adm-btn--solid" disabled={busy}>{busy ? '…' : tx('Créer l’accès', 'Create access')}</button>
        </>
      }>
      <form id="add-member" onSubmit={submit}>
        <div className="field">
          <label htmlFor="m-name">{tx('Nom complet', 'Full name')}</label>
          <input id="m-name" type="text" value={form.fullName} onChange={set('fullName')} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="m-email">Email</label>
          <input id="m-email" type="email" required value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="m-pass">{tx('Mot de passe (8 caractères minimum)', 'Password (8 characters minimum)')}</label>
          <div className="inline-input">
            <input id="m-pass" type="text" required minLength={8} value={form.password} onChange={set('password')} />
            <button type="button" className="adm-btn adm-btn--small" onClick={() => setForm((x) => ({ ...x, password: randomPassword() }))}>{tx('Générer', 'Generate')}</button>
          </div>
        </div>
        <div className="field">
          <span className="field__label">{tx('Ce que cette personne peut faire', 'What this person can do')}</span>
          <PermissionPicker value={permissions} onChange={setPermissions} />
        </div>
        {error && <p className="adm-error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

function EditPermissions({ member, onClose, onDone, notify, apiError }) {
  const { tx } = useLanguage()
  const [permissions, setPermissions] = useState(member.permissions)
  const [fullName, setFullName] = useState(member.full_name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await apiFetch('team', { method: 'PATCH', body: { userId: member.user_id, permissions, fullName } })
      notify(tx('Permissions mises à jour.', 'Permissions updated.'))
      onDone()
    } catch (err) {
      setError(apiError(err))
      setBusy(false)
    }
  }

  return (
    <Modal title={`${tx('Permissions', 'Permissions')} — ${member.full_name || member.email}`} onClose={onClose} closeLabel={tx('Fermer', 'Close')}
      footer={
        <>
          <button type="button" className="adm-btn" onClick={onClose}>{tx('Annuler', 'Cancel')}</button>
          <button type="button" className="adm-btn adm-btn--solid" onClick={save} disabled={busy}>{busy ? '…' : tx('Enregistrer', 'Save')}</button>
        </>
      }>
      <div className="field">
        <label htmlFor="e-name">{tx('Nom complet', 'Full name')}</label>
        <input id="e-name" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <PermissionPicker value={permissions} onChange={setPermissions} />
      {error && <p className="adm-error" role="alert">{error}</p>}
    </Modal>
  )
}

function ResetPassword({ member, onClose, onDone, notify, apiError }) {
  const { tx } = useLanguage()
  const [password, setPassword] = useState(randomPassword())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await apiFetch('team', { method: 'PATCH', body: { userId: member.user_id, password } })
      notify(tx('Mot de passe modifié.', 'Password changed.'))
      setDone(true)
    } catch (err) {
      setError(apiError(err))
    }
    setBusy(false)
  }

  return (
    <Modal title={`${tx('Nouveau mot de passe', 'New password')} — ${member.full_name || member.email}`} onClose={onClose} closeLabel={tx('Fermer', 'Close')}
      footer={
        done ? (
          <button type="button" className="adm-btn adm-btn--solid" onClick={onDone}>{tx('Terminé', 'Done')}</button>
        ) : (
          <>
            <button type="button" className="adm-btn" onClick={onClose}>{tx('Annuler', 'Cancel')}</button>
            <button type="button" className="adm-btn adm-btn--solid" onClick={save} disabled={busy || password.length < 8}>{busy ? '…' : tx('Changer', 'Change')}</button>
          </>
        )
      }>
      {done ? (
        <p className="adm-hint">{tx('Transmettez ce mot de passe à la personne :', 'Give this password to the person:')} <strong>{password}</strong></p>
      ) : (
        <div className="field">
          <label htmlFor="r-pass">{tx('Mot de passe (8 caractères minimum)', 'Password (8 characters minimum)')}</label>
          <div className="inline-input">
            <input id="r-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="adm-btn adm-btn--small" onClick={() => setPassword(randomPassword())}>{tx('Générer', 'Generate')}</button>
          </div>
        </div>
      )}
      {error && <p className="adm-error" role="alert">{error}</p>}
    </Modal>
  )
}
