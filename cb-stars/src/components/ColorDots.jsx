import { colorName, normalizeHex } from '../data/colors.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import './ColorDots.css'

// Read-only row of colour dots (product cards).
export function ColorDotRow({ colors = [], max = 5 }) {
  const { lang, t } = useLanguage()
  const list = colors.map(normalizeHex).filter(Boolean)
  if (list.length === 0) return null
  const shown = list.slice(0, max)
  const extra = list.length - shown.length

  return (
    <span className="color-row">
      {shown.map((hex) => (
        <span
          key={hex}
          className="color-dot"
          style={{ '--c': hex }}
          title={colorName(hex, lang) || hex}
          role="img"
          aria-label={colorName(hex, lang) || hex}
        />
      ))}
      {extra > 0 && (
        <span className="color-row__more" title={t('product.moreColors', { n: extra })}>+{extra}</span>
      )}
    </span>
  )
}

// Selectable dots (product page): radio group with the chosen colour named next to the label.
export function ColorPicker({ colors = [], value, onChange, label }) {
  const { lang } = useLanguage()
  const list = colors.map(normalizeHex).filter(Boolean)
  if (list.length === 0) return null
  const chosenName = value ? colorName(value, lang) : ''

  return (
    <div className="color-picker">
      <div className="color-picker__head">
        <span className="color-picker__label" id="color-picker-label">{label}</span>
        {chosenName && <span className="color-picker__name">{chosenName}</span>}
      </div>
      <div className="color-picker__dots" role="radiogroup" aria-labelledby="color-picker-label">
        {list.map((hex) => {
          const name = colorName(hex, lang) || hex
          const selected = value === hex
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={name}
              title={name}
              className={`color-picker__dot ${selected ? 'is-selected' : ''}`}
              style={{ '--c': hex }}
              onClick={() => onChange(hex)}
            >
              <span className="color-dot" style={{ '--c': hex, '--dot': '30px' }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
