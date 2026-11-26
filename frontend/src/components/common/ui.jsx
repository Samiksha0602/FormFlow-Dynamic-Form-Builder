import { useCallback, useEffect, useState } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)
  const show = useCallback((message, type = 'success', url) => setToast({ message, type, url, id: Date.now() }), [])
  const hide = useCallback(() => setToast(null), [])
  return { toast, show, hide }
}

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(onClose, toast.url ? 9000 : 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])
  if (!toast) return null
  return (
    <div className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon" aria-hidden="true">{toast.type === 'error' ? '!' : '✓'}</span>
      <div className="toast-body">
        <p>{toast.message}</p>
        {toast.url && <a href={toast.url} target="_blank" rel="noreferrer">{toast.url}</a>}
      </div>
      <button className="icon-button" type="button" aria-label="Dismiss message" onClick={onClose}>×</button>
    </div>
  )
}

export function relativeDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const days = Math.round((Date.now() - date.getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

/* Checklist dialog shown before printing / downloading. Purely client-side. */
export function PrintGuide({ title, intro, steps, confirmLabel, busy, onConfirm, onCancel }) {
  const [done, setDone] = useState([])
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])
  const toggle = (index) => setDone((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])
  return (
    <div className="modal-backdrop guide-backdrop no-print" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="confirm-dialog guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <h2 id="guide-title">{title}</h2>
        <p className="guide-intro">{intro}</p>
        <div className="guide-progress" aria-hidden="true"><span style={{ width: `${(done.length / steps.length) * 100}%` }} /></div>
        <ol className="guide-steps">
          {steps.map((step, index) => (
            <li key={step.title}>
              <label className={done.includes(index) ? 'guide-step guide-step-done' : 'guide-step'}>
                <input type="checkbox" checked={done.includes(index)} onChange={() => toggle(index)} />
                <span><b>{step.title}</b><small>{step.text}</small></span>
              </label>
            </li>
          ))}
        </ol>
        <p className="guide-count">{done.length} of {steps.length} checked. Checking is optional.</p>
        <div className="confirm-actions">
          <button className="button button-quiet" type="button" onClick={onCancel}>Not now</button>
          <button className="button button-primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? 'Preparing...' : confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
