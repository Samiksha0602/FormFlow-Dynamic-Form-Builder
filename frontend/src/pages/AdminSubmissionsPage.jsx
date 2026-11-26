import { useEffect, useMemo, useState } from 'react'
import { downloadAdminSubmissionPdf, getForm, getFormSubmission, getFormSubmissions, logoutAdmin } from '../services/formsApi'
import { formatSubmissionTimestamp, submissionDateInIndia } from '../services/submissionDateTime'
import { PrintGuide, Toast, useToast } from '../components/common/ui'

const formatDate = (value) => formatSubmissionTimestamp(value)

function valueForField(field, value) {
  if (Array.isArray(value)) return value.map((item) => valueForField(field, item)).join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (['radio', 'select', 'multiselect', 'checkbox'].includes(field.type)) {
    const option = (field.options || []).find((item) => {
      const optionValue = typeof item === 'object' ? item.value ?? item.label : item
      return String(optionValue) === String(value)
    })
    if (option !== undefined) return String(typeof option === 'object' ? option.label ?? option.value : option)
  }
  return String(value)
}

const fieldName = (field, index) => String(field.name || field.id || field.fieldId || `field_${index + 1}`)

function SubmissionDetailDialog({ form, submission, position, total, onPrev, onNext, onClose }) {
  const [downloading, setDownloading] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [error, setError] = useState('')
  const snapshot = submission.form_snapshot
  const fields = (snapshot?.form_config?.fields || form.form_config?.fields || [])
    .filter((field) => (field.active ?? field.isActive ?? true) && !['heading', 'paragraph', 'file'].includes(field.type))
    .map((field, index) => ({ field, index }))
    .sort((a, b) => (Number(a.field.order) || a.index + 1) - (Number(b.field.order) || b.index + 1))
  const rows = fields.flatMap(({ field, index }) => {
    const name = fieldName(field, index)
    const value = submission.submission_data?.[name]
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return []
    return [{ key: name, label: field.label || name, value: valueForField(field, value) }]
  })

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    setError('')
    try {
      const pdf = await downloadAdminSubmissionPdf(form.form_id, submission.submission_id)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = `${form.form_slug}-submission-${submission.submission_id}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setGuideOpen(false)
    } catch {
      setGuideOpen(false)
      setError('Unable to download the PDF. Check your connection and try again.')
    } finally {
      setDownloading(false)
    }
  }

  useEffect(() => {
    function onKey(event) {
      if (guideOpen) return
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && onPrev) onPrev()
      if (event.key === 'ArrowRight' && onNext) onNext()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onPrev, onNext, guideOpen])

  return (
    <div className="modal-backdrop submission-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="confirm-dialog submission-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-submission-title">
        <button className="icon-button submission-close" type="button" aria-label="Close submission details" onClick={onClose}>×</button>
        <p className="eyebrow">{snapshot?.form_name || form.form_name}</p>
        <h2 id="admin-submission-title">Submission #{submission.submission_id}</h2>
        <div className="submission-meta">
          <span>Submitted</span><strong>{formatDate(submission.submitted_at)}</strong>
          <span>Status</span><strong><span className="status-pill status-submitted"><i className="pill-dot" />{submission.status}</span></strong>
        </div>
        <dl className="submission-details">
          {rows.length ? rows.map((row) => <div className="submission-row" key={row.key}><dt>{row.label}</dt><dd>{row.value}</dd></div>) : <p className="submission-empty">No field values were provided.</p>}
        </dl>
        {error && <p className="public-field-error" role="alert">{error}</p>}
        <div className="dialog-footer">
          <div className="pager" aria-label="Browse submissions">
            <button className="icon-button" type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous submission">←</button>
            <span>{position} of {total}</span>
            <button className="icon-button" type="button" onClick={onNext} disabled={!onNext} aria-label="Next submission">→</button>
          </div>
          <div className="confirm-actions">
            <button className="button button-quiet" type="button" onClick={onClose}>Close</button>
            <button className="button button-primary" type="button" onClick={() => setGuideOpen(true)}>Download PDF</button>
          </div>
        </div>
      </section>
      {guideOpen && (
        <PrintGuide
          title="Before you print this submission"
          intro="A quick check helps the printout come out clean."
          steps={[
            { title: 'Review the answers', text: 'The PDF is a snapshot of what the person submitted, exactly as shown here.' },
            { title: 'Use A4 or Letter, portrait', text: 'The layout is designed for a single portrait page per submission.' },
            { title: 'Keep it confidential', text: 'Submissions can contain personal details. Store or share the PDF carefully.' },
          ]}
          confirmLabel="Download PDF" busy={downloading} onConfirm={handleDownload} onCancel={() => setGuideOpen(false)} />
      )}
    </div>
  )
}

function csvCell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export default function AdminSubmissionsPage({ formId, onBack }) {
  const [form, setForm] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const { toast, show, hide } = useToast()

  async function handleLogout() {
    await logoutAdmin().catch(() => null)
    window.location.assign('/admin/login')
  }

  useEffect(() => {
    let isCurrent = true
    Promise.all([getForm(formId), getFormSubmissions(formId)])
      .then(([formResult, submissionsResult]) => {
        if (!isCurrent) return
        setForm(formResult)
        setSubmissions(submissionsResult)
      })
      .catch((loadError) => { if (isCurrent) setError(loadError.status === 404 ? 'Form not found.' : 'Unable to load submissions. Refresh to try again.') })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
  }, [formId])

  async function viewSubmission(submissionId) {
    setViewingId(submissionId)
    setError('')
    try {
      setSelectedSubmission(await getFormSubmission(formId, submissionId))
    } catch (loadError) {
      show(loadError.status === 404 ? 'Submission not found.' : 'Unable to load submission details.', 'error')
    } finally {
      setViewingId(null)
    }
  }

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesId = !query || String(submission.submission_id).includes(query.trim())
    const matchesStatus = statusFilter === 'all' || submission.status.toUpperCase() === statusFilter
    const matchesDate = !dateFilter || submissionDateInIndia(submission.submitted_at) === dateFilter
    return matchesId && matchesStatus && matchesDate
  })

  const stats = useMemo(() => {
    const today = submissionDateInIndia(new Date().toISOString())
    const latest = [...submissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0]
    return {
      today: submissions.filter((s) => submissionDateInIndia(s.submitted_at) === today).length,
      latest: latest ? formatSubmissionTimestamp(latest.submitted_at) : '—',
    }
  }, [submissions])

  const week = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000)
      const key = submissionDateInIndia(d.toISOString())
      days.push({ key, label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d), count: submissions.filter((s) => submissionDateInIndia(s.submitted_at) === key).length })
    }
    const max = Math.max(1, ...days.map((d) => d.count))
    return days.map((d) => ({ ...d, pct: Math.round((d.count / max) * 100) }))
  }, [submissions])

  const selectedIndex = selectedSubmission ? filteredSubmissions.findIndex((s) => s.submission_id === selectedSubmission.submission_id) : -1
  const goTo = (offset) => {
    const target = filteredSubmissions[selectedIndex + offset]
    return target ? () => viewSubmission(target.submission_id) : null
  }

  function exportCsv() {
    const lines = [['ID', 'Submitted', 'Status', 'Summary'].map(csvCell).join(',')]
    filteredSubmissions.forEach((s) => lines.push([s.submission_id, formatDate(s.submitted_at), s.status, s.summary].map(csvCell).join(',')))
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${form?.form_slug || 'form'}-submissions.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    show(`Exported ${filteredSubmissions.length} ${filteredSubmissions.length === 1 ? 'row' : 'rows'} to CSV.`)
  }

  const hasFilters = query || statusFilter !== 'all' || dateFilter

  return (
    <main className="admin-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FormFlow home"><span className="brand-mark">F</span><span>FormFlow</span></a>
        <div className="topbar-meta">Admin workspace <button className="topbar-action" type="button" onClick={handleLogout}>Log out</button></div>
      </header>
      <section className="page-content">
        <div className="hero hero-compact">
          <div className="hero-copy">
            <p className="eyebrow"><button className="breadcrumb-button" type="button" onClick={onBack}>Forms</button> / Submissions</p>
            <h1>{form?.form_name || 'Submissions'}</h1>
            <p className="page-intro">{loading ? 'Loading submissions…' : 'Review what people have sent in. Open any row for the full answers.'}</p>
          </div>
          <button className="button button-primary hero-cta" type="button" onClick={onBack}>← Back to forms</button>
        </div>

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {loading ? (
          <div className="skeleton-list" aria-busy="true">{[0, 1, 2].map((i) => <div className="skeleton-row" key={i}><span className="skeleton w15" /><span className="skeleton w30" /><span className="skeleton w40" /></div>)}</div>
        ) : !form ? null : submissions.length === 0 ? (
          <div className="empty-state submissions-empty-state">
            <div className="empty-symbol" aria-hidden="true">✉</div>
            <h3>No submissions yet</h3>
            <p>Share the public link and responses will appear here.</p>
            <button className="button button-quiet" type="button" onClick={onBack}>Back to forms</button>
          </div>
        ) : (
          <>
            <div className="insight-row">
              <div className="stat-row stat-row-static">
                <div className="stat-card"><strong>{submissions.length}</strong><span>Total submissions</span></div>
                <div className="stat-card"><strong>{stats.today}</strong><span>Received today</span></div>
                <div className="stat-card stat-wide"><strong className="stat-small">{stats.latest}</strong><span>Latest submission</span></div>
              </div>
              <div className="activity" aria-label="Submissions in the last 7 days">
                <p className="activity-title">Last 7 days <small>Click a bar to filter</small></p>
                <div className="activity-bars">
                  {week.map((day) => (
                    <button key={day.key} type="button" className={`bar-col ${dateFilter === day.key ? 'bar-active' : ''}`}
                      onClick={() => setDateFilter(dateFilter === day.key ? '' : day.key)} title={`${day.count} on ${day.key}`}>
                      <span className="bar-count">{day.count}</span>
                      <span className="bar" style={{ '--h': `${Math.max(day.pct, 6)}%` }} />
                      <span className="bar-label">{day.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <section className="list-panel" aria-label="Form submissions">
              <div className="panel-heading submissions-toolbar">
                <div><h2>Submissions</h2><p>Showing {filteredSubmissions.length} of {submissions.length}</p></div>
                <div className="submission-filters">
                  <label className="filter-control"><span>Submission ID</span><input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID" /></label>
                  <label className="filter-control"><span>Status</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="SUBMITTED">Submitted</option></select></label>
                  <label className="filter-control"><span>Date</span><input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} /></label>
                  {hasFilters && <button className="button button-quiet" type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setDateFilter('') }}>Clear</button>}
                  <button className="button button-quiet" type="button" onClick={exportCsv} disabled={!filteredSubmissions.length}>Export CSV</button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="forms-table submissions-table">
                  <thead><tr><th>ID</th><th>Submitted</th><th>Status</th><th>Summary</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    {filteredSubmissions.map((submission) => (
                      <tr key={submission.submission_id} className="row-clickable" onClick={() => viewSubmission(submission.submission_id)}>
                        <td><strong>#{submission.submission_id}</strong></td>
                        <td className="date-cell">{formatDate(submission.submitted_at)}</td>
                        <td><span className="status-pill status-submitted"><i className="pill-dot" />{submission.status}</span></td>
                        <td className="submission-summary-cell">{submission.summary}</td>
                        <td className="row-actions"><button className="button button-quiet" type="button" onClick={(e) => { e.stopPropagation(); viewSubmission(submission.submission_id) }} disabled={viewingId === submission.submission_id}>{viewingId === submission.submission_id ? 'Loading…' : 'View'}</button></td>
                      </tr>
                    ))}
                    {filteredSubmissions.length === 0 && <tr><td className="submissions-no-match" colSpan="5">No submissions match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
      {selectedSubmission && form && (
        <SubmissionDetailDialog form={form} submission={selectedSubmission}
          position={selectedIndex + 1} total={filteredSubmissions.length}
          onPrev={goTo(-1)} onNext={goTo(1)} onClose={() => setSelectedSubmission(null)} />
      )}
      <Toast toast={toast} onClose={hide} />
    </main>
  )
}
