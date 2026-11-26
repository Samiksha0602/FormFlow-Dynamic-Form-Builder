import { useEffect, useMemo, useRef, useState } from 'react'
import PublicForm from '../components/public/PublicForm'
import { PrintGuide } from '../components/common/ui'
import { getPublicForm } from '../services/formsApi'

function buildInstructions(form) {
  const fields = (form.form_config?.fields || []).filter((f) => (f.active ?? f.isActive ?? true) && !['heading', 'paragraph'].includes(f.type))
  const required = fields.filter((f) => f.required).length
  const minutes = Math.max(1, Math.round(fields.length * 0.4))
  // Optional: form_config.instructions (string or array) overrides the defaults if you add it later.
  const custom = form.form_config?.instructions
  const list = Array.isArray(custom) ? custom : typeof custom === 'string' && custom.trim() ? custom.split('\n').filter(Boolean) : null
  return {
    fields: fields.length,
    required,
    minutes,
    steps: list || [
      required ? `Fields marked with * are required (${required} in total).` : 'All fields are optional. Fill in what applies to you.',
      'Check your details before you submit. You may not be able to edit them afterwards.',
      'Keep your answers accurate. They are recorded exactly as typed.',
      'After submitting, wait for the confirmation message before closing this page.',
    ],
  }
}

export default function PublicFormPage({ slug }) {
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [guideOpen, setGuideOpen] = useState(false)
  const [instructionsOpen, setInstructionsOpen] = useState(true)
  const formRef = useRef(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  // Live completion meter: reads the rendered inputs, so PublicForm stays untouched.
  useEffect(() => {
    const root = formRef.current
    if (!root) return undefined
    function measure() {
      const groups = {}
      root.querySelectorAll('input, select, textarea').forEach((el, i) => {
        if (['hidden', 'submit', 'button'].includes(el.type)) return
        const key = el.name || el.id || `c${i}`
        const filled = el.type === 'checkbox' || el.type === 'radio' ? el.checked : String(el.value || '').trim() !== ''
        groups[key] = groups[key] || filled
      })
      const keys = Object.keys(groups)
      setProgress({ done: keys.filter((k) => groups[k]).length, total: keys.length })
    }
    measure()
    root.addEventListener('input', measure)
    root.addEventListener('change', measure)
    return () => { root.removeEventListener('input', measure); root.removeEventListener('change', measure) }
  }, [form])
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  useEffect(() => {
    let isCurrent = true
    getPublicForm(slug)
      .then((result) => { if (isCurrent) setForm(result) })
      .catch((loadError) => {
        if (!isCurrent) return
        if (loadError.message === 'Form not available') setUnavailable(true)
        else setError(loadError.message || 'Could not load this form.')
      })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
  }, [slug])

  const info = useMemo(() => (form ? buildInstructions(form) : null), [form])

  function startFilling() {
    setInstructionsOpen(false)
    setTimeout(() => {
      const first = formRef.current?.querySelector('input:not([type=hidden]), select, textarea')
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      first?.focus({ preventScroll: true })
    }, 60)
  }

  function printNow() {
    setGuideOpen(false)
    setTimeout(() => window.print(), 150)
  }

  return (
    <main className="public-shell">
      {form && <div className="read-progress no-print" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
      <header className="topbar no-print">
        <a className="brand" href="/" aria-label="FormFlow home"><span className="brand-mark">F</span><span>FormFlow</span></a>
        <div className="topbar-meta"><span className="topbar-dot" /> Public form</div>
      </header>
      <section className="public-content">
        {loading ? (
          <div className="public-state"><span className="spinner" /> Loading form...</div>
        ) : unavailable ? (
          <div className="public-state public-unavailable">
            <span className="public-state-mark" aria-hidden="true">!</span>
            <p className="eyebrow">Unavailable</p>
            <h1>Form not available</h1>
            <p>This form may be unpublished or no longer active. Contact the person who shared the link.</p>
            <a className="public-back-link" href="/">Back to forms</a>
          </div>
        ) : error ? (
          <div className="public-state public-unavailable" role="alert">
            <p className="eyebrow">Connection issue</p>
            <h1>We could not load this form.</h1>
            <p>Check your connection, then reload the page.</p>
            <button className="button button-quiet" type="button" onClick={() => window.location.reload()}>Reload</button>
          </div>
        ) : (
          <article className="public-form-summary paper">
            <div className="print-only print-header">
              <strong>{form.form_name}</strong>
              <span>Printed {new Date().toLocaleDateString()} · {window.location.host}/forms/{slug}</span>
            </div>
            <p className="eyebrow">Registration form</p>
            <h1>{form.form_name}</h1>
            {form.form_description && <p className="public-description">{form.form_description}</p>}

            <div className="form-facts no-print">
              <span><b>{info.fields}</b> questions</span>
              <span><b>{info.required}</b> required</span>
              <span>About <b>{info.minutes}</b> min</span>
              <span className="meter" role="status"><span className="ring" style={{ '--pct': `${pct}%` }}><b>{pct}%</b></span>{pct === 100 ? 'All set. Review and submit.' : `${progress.done} of ${progress.total} answered`}</span>
              <button type="button" className="text-button facts-print" onClick={() => setGuideOpen(true)}>Print a copy</button>
            </div>

            <section className={`instructions ${instructionsOpen ? 'instructions-open' : ''}`} aria-label="Instructions">
              <button type="button" className="instructions-head" onClick={() => setInstructionsOpen((v) => !v)} aria-expanded={instructionsOpen}>
                <span>Before you begin</span><span className="chev" aria-hidden="true">{instructionsOpen ? '−' : '+'}</span>
              </button>
              {instructionsOpen && (
                <div className="instructions-body">
                  <ol>{info.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                  <button type="button" className="button button-primary no-print" onClick={startFilling}>Got it, start filling</button>
                </div>
              )}
            </section>

            <div ref={formRef}><PublicForm form={form} slug={slug} /></div>
          </article>
        )}
      </section>
      {guideOpen && (
        <PrintGuide
          title="Before you print this form"
          intro="Printing opens your browser's print dialog. A few settings make it look right."
          steps={[
            { title: 'Fill the form first if you want answers on paper', text: 'Typed answers appear in the printout. Leave it blank for a handwritten copy.' },
            { title: 'Choose “Portrait” and “Fit to page”', text: 'This keeps long forms from being cut off at the edge.' },
            { title: 'Turn headers and footers off', text: 'Cleaner pages. Or pick “Save as PDF” as the destination to keep a digital copy.' },
          ]}
          confirmLabel="Open print dialog" onConfirm={printNow} onCancel={() => setGuideOpen(false)} />
      )}
    </main>
  )
}
