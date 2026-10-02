import { useEffect, useRef } from 'react'
import { IconX } from './AdminIcons.jsx'

// Simple accessible dialog: Escape closes, focus moves inside, page scroll is locked.
export default function Modal({ title, onClose, children, footer, wide = false, closeLabel = 'Close' }) {
  const panelRef = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div
        ref={panelRef}
        className={`modal ${wide ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="modal__head">
          <h3>{title}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label={closeLabel}>
            <IconX />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>
  )
}
