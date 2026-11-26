import { useEffect, useMemo, useState } from 'react'
import FieldEditor from '../components/forms/FieldEditor'
import FieldItem from '../components/forms/FieldItem'
import FieldPalette from '../components/forms/FieldPalette'
import PublicField from '../components/public/PublicField'
import { Toast, useToast } from '../components/common/ui'
import { createForm, getForm, updateForm } from '../services/formsApi'

const fieldLabels = {
  text: 'Text Field', textarea: 'Textarea Field', number: 'Number Field', email: 'Email Field', mobile: 'Mobile Field',
  date: 'Date Field', radio: 'Radio Field', select: 'Select Field', multiselect: 'Multiselect Field',
  checkbox: 'Checkbox Field', heading: 'Heading', paragraph: 'Paragraph', file: 'File Field',
}
const choiceTypes = ['radio', 'select', 'multiselect', 'checkbox']

function normalizeField(field, index) {
  const label = field.label || fieldLabels[field.type] || 'Text Field'
  return {
    id: field.id || field.fieldId || `field_${index + 1}`,
    type: field.type || 'text',
    label,
    name: field.name || label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${index + 1}`,
    placeholder: field.placeholder || '',
    required: Boolean(field.required),
    defaultValue: field.defaultValue ?? '',
    helpText: field.helpText || '',
    options: (field.options || []).map((option) => typeof option === 'string' ? option : option.value ?? option.label ?? ''),
    validation: field.validation || {},
    order: Number(field.order) || index + 1,
    active: field.active ?? field.isActive ?? true,
  }
}

const orderedFields = (fields) => [...fields].sort((a, b) => a.order - b.order)
const snapshotOf = (form) => JSON.stringify([form.form_name, form.form_description, form.form_config])
const emptyForm = { form_name: '', form_description: '', form_config: { fields: [] } }

function previewValue(field) {
  const value = field.defaultValue
  if (field.type === 'multiselect' || (field.type === 'checkbox' && field.options?.length)) {
    return Array.isArray(value) ? value.map(String) : value ? [String(value)] : []
  }
  if (field.type === 'checkbox') return value === true || value === 'true' || value === '1' || value === 'on'
  return value ?? ''
}

export default function FormBuilderPage({ formId, onBack }) {
  const [savedFormId, setSavedFormId] = useState(formId)
  const [form, setForm] = useState(emptyForm)
  const [baseline, setBaseline] = useState(() => snapshotOf(emptyForm))
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(Boolean(formId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [previewValues, setPreviewValues] = useState({})
  const { toast, show, hide } = useToast()

  useEffect(() => {
    if (!formId) return undefined
    let isCurrent = true
    getForm(formId)
      .then((result) => {
        if (!isCurrent) return
        const fields = orderedFields((result.form_config?.fields || []).map(normalizeField)).map((f, i) => ({ ...f, order: i + 1 }))
        const loaded = { form_name: result.form_name, form_description: result.form_description || '', form_config: { ...result.form_config, fields } }
        setForm(loaded)
        setBaseline(snapshotOf(loaded))
        setSelectedId(fields[0]?.id || null)
      })
      .catch((loadError) => { if (isCurrent) setError(loadError.message || 'Could not load this form.') })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
  }, [formId])

  const fields = orderedFields(form.form_config.fields)
  const selectedField = fields.find((field) => field.id === selectedId) || null
  const dirty = snapshotOf(form) !== baseline

  // Warn before closing the tab with unsaved work
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Ctrl/Cmd+S saves, Esc closes preview
  useEffect(() => {
    function onKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!saving && form.form_name.trim()) handleSave()
      }
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // What still needs attention before this form is worth publishing
  const checks = useMemo(() => {
    const interactive = fields.filter((f) => !['heading', 'paragraph'].includes(f.type))
    return [
      { label: 'Has a title', ok: Boolean(form.form_name.trim()) },
      { label: 'Has a description', ok: Boolean(form.form_description.trim()) },
      { label: 'Has at least one question', ok: interactive.length > 0 },
      { label: 'Choice fields have 2+ options', ok: fields.filter((f) => choiceTypes.includes(f.type)).every((f) => f.options.filter(Boolean).length >= 2) },
      { label: 'No empty labels', ok: fields.every((f) => f.label.trim()) },
    ]
  }, [fields, form.form_name, form.form_description])
  const passed = checks.filter((c) => c.ok).length

  function updateField(fieldId, changes) {
    setForm((current) => ({ ...current, form_config: { ...current.form_config, fields: current.form_config.fields.map((f) => f.id === fieldId ? { ...f, ...changes } : f) } }))
    setSaveMessage('')
  }

  function addField(type) {
    const label = fieldLabels[type] || 'Text Field'
    const baseName = type.replace(/[^a-z0-9]+/g, '_')
    let suffix = fields.filter((f) => f.type === type).length + 1
    let name = `${baseName}_${suffix}`
    while (fields.some((f) => f.name === name)) { suffix += 1; name = `${baseName}_${suffix}` }
    let fieldIndex = fields.length + 1
    let id = `field_${fieldIndex}`
    while (fields.some((f) => f.id === id)) { fieldIndex += 1; id = `field_${fieldIndex}` }
    const field = {
      id, type, label, name, placeholder: '', required: false, defaultValue: '', helpText: '',
      options: choiceTypes.includes(type) ? ['Option 1', 'Option 2'] : [], validation: {}, order: fields.length + 1, active: true,
    }
    setForm((current) => ({ ...current, form_config: { ...current.form_config, fields: [...current.form_config.fields, field] } }))
    setSelectedId(field.id)
    setSaveMessage('')
    setTimeout(() => document.getElementById(`canvas-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  function moveField(fieldId, direction) {
    const index = fields.findIndex((f) => f.id === fieldId)
    const targetIndex = index + direction
    if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) return
    const reordered = [...fields]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    setForm((current) => ({ ...current, form_config: { ...current.form_config, fields: reordered.map((f, i) => ({ ...f, order: i + 1 })) } }))
  }

  function removeField(fieldId) {
    const removed = fields.find((f) => f.id === fieldId)
    if (removed && !window.confirm(`Remove “${removed.label}”?`)) return
    const remaining = fields.filter((f) => f.id !== fieldId).map((f, i) => ({ ...f, order: i + 1 }))
    setForm((current) => ({ ...current, form_config: { ...current.form_config, fields: remaining } }))
    if (selectedId === fieldId) setSelectedId(null)
  }

  async function handleSave(event) {
    event?.preventDefault?.()
    setSaving(true)
    setError('')
    setSaveMessage('')
    const payload = {
      form_name: form.form_name.trim(),
      form_description: form.form_description.trim() || null,
      form_config: { ...form.form_config, fields: fields.map((f, i) => ({ ...f, order: i + 1 })) },
    }
    try {
      const result = savedFormId ? await updateForm(savedFormId, payload) : await createForm(payload)
      setSavedFormId(result.form_id)
      setBaseline(snapshotOf(form))
      setSaveMessage(`Saved ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(result.updated_at))}`)
      show('Form saved.')
    } catch (saveError) {
      setError(saveError.message || 'Could not save this form. Your changes are still here, so try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return
    onBack()
  }

  function openPreview() {
    setPreviewValues(Object.fromEntries(fields.map((f) => [f.id, previewValue(f)])))
    setPreviewOpen(true)
  }

  if (loading) return <main className="builder-loading"><span className="spinner" /> Loading form</main>

  return (
    <main className="builder-shell">
      <header className="builder-topbar">
        <button className="back-button" onClick={handleBack} aria-label="Back to forms">← <span>All forms</span></button>
        <div className="builder-topbar-title"><span className="brand-mark">F</span><span>Form builder</span>{savedFormId && <span className="builder-status">DRAFT</span>}</div>
        <div className="builder-save-area">
          <span className={`save-state ${dirty ? 'save-state-dirty' : ''}`} role="status">
            <i className="pill-dot" />{saving ? 'Saving…' : dirty ? 'Unsaved changes' : saveMessage || 'All changes saved'}
          </span>
          <button className="button button-quiet builder-preview-button" type="button" onClick={openPreview}>Preview</button>
          <button className="button button-primary" onClick={handleSave} disabled={saving || !form.form_name.trim() || !dirty} title="Ctrl+S">
            {saving ? 'Saving…' : 'Save form'}
          </button>
        </div>
      </header>

      {error && <div className="notice notice-error builder-notice" role="alert">{error}</div>}

      <form className="builder-meta" onSubmit={handleSave}>
        <div className="builder-meta-fields">
          <input className="builder-title-input" value={form.form_name} maxLength={255}
            onChange={(e) => { setForm((c) => ({ ...c, form_name: e.target.value })); setSaveMessage('') }}
            placeholder="Enter form title" aria-label="Form title" />
          <input className="builder-description-input" value={form.form_description}
            onChange={(e) => { setForm((c) => ({ ...c, form_description: e.target.value })); setSaveMessage('') }}
            placeholder="Add a short description (optional)" aria-label="Form description" />
        </div>
        <details className="readiness">
          <summary>
            <span className="ring" style={{ '--pct': `${(passed / checks.length) * 100}%` }}><b>{passed}/{checks.length}</b></span>
            <span>{passed === checks.length ? 'Ready to publish' : 'Checklist'}</span>
          </summary>
          <ul>{checks.map((c) => <li key={c.label} className={c.ok ? 'check-ok' : 'check-todo'}>{c.ok ? '✓' : '○'} {c.label}</li>)}</ul>
        </details>
        <div className="builder-count"><strong>{fields.length.toString().padStart(2, '0')}</strong><span>fields</span></div>
      </form>

      <div className="builder-workspace">
        <FieldPalette onAdd={addField} />

        <section className="builder-canvas" aria-label="Form fields">
          <div className="canvas-heading">
            <div className="canvas-title-editor">
              <label className="eyebrow" htmlFor="form-name">Form name</label>
              <input id="form-name" className="canvas-title-input" value={form.form_name}
                onChange={(e) => { setForm((c) => ({ ...c, form_name: e.target.value })); setSaveMessage('') }}
                placeholder="Untitled form" aria-label="Form name" maxLength={255} />
            </div>
            <span className="canvas-draft">Draft</span>
          </div>
          {fields.length === 0 ? (
            <div className="canvas-empty">
              <span className="empty-symbol" aria-hidden="true">＋</span>
              <h2>Your form starts here</h2>
              <p>Choose a field from the left, or start with a text field.</p>
              <button className="button button-primary" type="button" onClick={() => addField('text')}>Add a text field</button>
            </div>
          ) : (
            <div className="field-stack">
              {fields.map((field, index) => (
                <div id={`canvas-${field.id}`} key={field.id}>
                  <FieldItem field={field} index={index} count={fields.length} selected={field.id === selectedId}
                    onSelect={() => setSelectedId(field.id)} onMove={(d) => moveField(field.id, d)} onDelete={() => removeField(field.id)} />
                </div>
              ))}
            </div>
          )}
          {fields.length > 0 && <button className="canvas-add-button" onClick={() => addField('text')} type="button">＋ Add text field</button>}
        </section>

        <FieldEditor field={selectedField} onChange={(changes) => selectedField && updateField(selectedField.id, changes)} />
      </div>

      {previewOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false) }}>
          <section className={`confirm-dialog builder-preview-dialog preview-${previewDevice}`} role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <button className="icon-button submission-close" type="button" aria-label="Close preview" onClick={() => setPreviewOpen(false)}>×</button>
            <div className="preview-toolbar">
              <p className="eyebrow">Form preview</p>
              <div className="segmented" role="group" aria-label="Preview size">
                <button type="button" aria-pressed={previewDevice === 'desktop'} onClick={() => setPreviewDevice('desktop')}>Desktop</button>
                <button type="button" aria-pressed={previewDevice === 'mobile'} onClick={() => setPreviewDevice('mobile')}>Phone</button>
              </div>
            </div>
            <h2 id="preview-title">{form.form_name || 'Untitled form'}</h2>
            {form.form_description && <p className="public-description">{form.form_description}</p>}
            <div className="builder-preview-fields">
              {fields.map((field) => (
                <PublicField key={field.id} field={field} fieldId={`preview-${field.id}`} value={previewValues[field.id]}
                  onChange={(value) => setPreviewValues((c) => ({ ...c, [field.id]: value }))} />
              ))}
            </div>
            <div className="confirm-actions"><button className="button button-quiet" type="button" onClick={() => setPreviewOpen(false)}>Close preview</button></div>
          </section>
        </div>
      )}
      <Toast toast={toast} onClose={hide} />
    </main>
  )
}
