import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useLanguage } from '../../i18n/LanguageContext.jsx'
import { IconCheckCircle } from '../../components/AdminIcons.jsx'

// One "paste your pixel ID" card (used for Facebook and TikTok). The id is stored in
// site_settings under `settingKey`; an empty value turns that pixel off.
export default function PixelCard({
  settingKey, title, description, label, placeholder, inputMode = 'text',
  validate, invalidMessage, liveText, whereToFind, notify,
}) {
  const { tx } = useLanguage()
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)
  const inputId = `pixel-${settingKey}`

  useEffect(() => {
    supabase.from('site_settings').select('value').eq('key', settingKey).maybeSingle().then(({ data }) => {
      setValue(data?.value || '')
      setSaved(data?.value || '')
    })
  }, [settingKey])

  const valid = value.trim() === '' || validate(value)

  const save = async (e) => {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    const clean = value.trim()
    const { error } = await supabase.from('site_settings').upsert({ key: settingKey, value: clean, updated_at: new Date().toISOString() })
    setBusy(false)
    if (error) { notify(error.message, 'err'); return }
    setValue(clean)
    setSaved(clean)
    notify(clean ? tx('Pixel enregistré. Il est actif sur la boutique.', 'Pixel saved. It is now live on the store.') : tx('Pixel désactivé.', 'Pixel turned off.'))
  }

  return (
    <section className="adm-card">
      <h3>{title}</h3>
      <p className="adm-hint">{description}</p>
      <form className="settings-form" onSubmit={save}>
        <div className="field">
          <label htmlFor={inputId}>{label}</label>
          <input id={inputId} type="text" inputMode={inputMode} placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} aria-invalid={!valid} autoComplete="off" />
          {!valid && <span className="adm-error">{invalidMessage}</span>}
        </div>
        <button type="submit" className="adm-btn adm-btn--solid" disabled={busy || !valid || value.trim() === saved}>
          {busy ? '…' : tx('Enregistrer', 'Save')}
        </button>
      </form>
      {saved && <p className="adm-status adm-status--ok"><IconCheckCircle /> {liveText}</p>}
      <p className="adm-hint">{whereToFind}</p>
    </section>
  )
}
