import { useEffect, useMemo, useRef, useState } from 'react'
import { deactivateForm, deleteForm, getForms, logoutAdmin, publishForm } from '../services/formsApi'
import { Toast, relativeDate, useToast } from '../components/common/ui'

function publicUrl(slug) {
  return new URL(`/forms/${encodeURIComponent(slug)}`, window.location.origin).toString()
}

const tabs = [
  { key: 'all', label: 'All forms' },
  { key: 'PUBLISHED', label: 'Live' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'INACTIVE', label: 'Paused' },
]
const statusLabel = { PUBLISHED: 'Live', DRAFT: 'Draft', INACTIVE: 'Paused' }

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export default function AdminFormsPage({ onCreate, onEdit }) {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [pendingTransition, setPendingTransition] = useState(null)
  const [transitioningId, setTransitioningId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [view, setView] = useState(() => {
    try { return localStorage.getItem('formflow:view') || 'cards' } catch { return 'cards' }
  })
  const searchRef = useRef(null)
  const { toast, show, hide } = useToast()

  function changeView(next) {
    setView(next)
    try { localStorage.setItem('formflow:view', next) } catch { /* ignore */ }
  }

  async function loadForms() {
    setLoading(true)
    setError('')
    try {
      setForms(await getForms())
    } catch (loadError) {
      setError(loadError.message || 'Could not load forms. Check your connection and refresh.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isCurrent = true
    getForms()
      .then((result) => { if (isCurrent) setForms(result) })
      .catch((loadError) => { if (isCurrent) setError(loadError.message || 'Could not load forms.') })
      .finally(() => { if (isCurrent) setLoading(false) })
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    function onKey(event) {
      const tag = event.target.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === '/') { event.preventDefault(); searchRef.current?.focus() }
      if (event.key === 'n' && !pendingTransition) { event.preventDefault(); onCreate() }
      if (event.key === 'Escape') setPendingTransition(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCreate, pendingTransition])

  async function handleDelete(form) {
    if (!window.confirm(`Delete “${form.form_name}”? This action cannot be undone.`)) return
    setDeletingId(form.form_id)
    try {
      await deleteForm(form.form_id)
      setForms((current) => current.filter((item) => item.form_id !== form.form_id))
      show(`Deleted “${form.form_name}”.`)
    } catch (deleteError) {
      show(deleteError.message || 'Could not delete this form. Try again.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function confirmStatusTransition() {
    if (!pendingTransition) return
    const { form, action } = pendingTransition
    setTransitioningId(form.form_id)
    try {
      const result = action === 'publish' ? await publishForm(form.form_id) : await deactivateForm(form.form_id)
      setForms((current) => current.map((item) => item.form_id === form.form_id
        ? { ...item, status: result.status, form_slug: result.slug || item.form_slug, updated_at: result.updated_at }
        : item))
      if (action === 'publish') show('Published. Your form is live.', 'success', publicUrl(result.slug))
      else show('Deactivated. The public URL is no longer available.')
      setPendingTransition(null)
    } catch (transitionError) {
      show(transitionError.message || `Could not ${action} this form.`, 'error')
    } finally {
      setTransitioningId(null)
    }
  }

  async function handleCopyUrl(form) {
    try {
      await navigator.clipboard.writeText(publicUrl(form.form_slug))
      setCopiedId(form.form_id)
      setTimeout(() => setCopiedId((id) => (id === form.form_id ? null : id)), 1800)
    } catch {
      show('Could not copy the link. Allow clipboard access and try again.', 'error')
    }
  }

  async function handleLogout() {
    await logoutAdmin().catch(() => null)
    window.location.assign('/admin/login')
  }

  const counts = useMemo(() => forms.reduce((acc, form) => {
    const key = form.status.toUpperCase()
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {}), [forms])

  const filteredForms = useMemo(() => {
    const search = searchTerm.trim().toLowerCase()
    return forms
      .filter((form) => {
        const matchesSearch = !search || [form.form_name, form.form_description, form.form_slug].some((v) => String(v || '').toLowerCase().includes(search))
        return matchesSearch && (statusFilter === 'all' || form.status.toUpperCase() === statusFilter)
      })
      .sort((a, b) => sort === 'name' ? a.form_name.localeCompare(b.form_name)
        : sort === 'oldest' ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at))
  }, [forms, searchTerm, statusFilter, sort])

  const clearFilters = () => { setSearchTerm(''); setStatusFilter('all') }

  function renderActions(form) {
    const isPublished = form.status.toUpperCase() === 'PUBLISHED'
    const isTransitioning = transitioningId === form.form_id
    return (
      <>
        <button className="button button-quiet" onClick={() => onEdit(form.form_id)}>Edit</button>
        <a className="button button-quiet" href={`/admin/forms/${form.form_id}/submissions`}>Submissions</a>
        {isPublished ? (
          <>
            <a className="button button-quiet" href={`/forms/${encodeURIComponent(form.form_slug)}`} target="_blank" rel="noreferrer">Open</a>
            <button className={`button button-quiet ${copiedId === form.form_id ? 'button-copied' : ''}`} onClick={() => handleCopyUrl(form)}>{copiedId === form.form_id ? '✓ Copied' : 'Copy link'}</button>
            <button className="button button-danger-quiet" onClick={() => setPendingTransition({ form, action: 'deactivate' })} disabled={isTransitioning}>Deactivate</button>
          </>
        ) : (
          <>
            <button className="button button-publish" onClick={() => setPendingTransition({ form, action: 'publish' })} disabled={isTransitioning}>Publish</button>
            <button className="button button-danger-quiet" onClick={() => handleDelete(form)} disabled={deletingId === form.form_id}>{deletingId === form.form_id ? 'Deleting…' : 'Delete'}</button>
          </>
        )}
      </>
    )
  }

  return (
    <main className="admin-shell">
      <header className="topbar">
        <a className="brand" href="#forms" aria-label="FormFlow home"><span className="brand-mark">F</span><span>FormFlow</span></a>
        <div className="topbar-meta"><span className="topbar-dot" /> Admin workspace <button className="topbar-action" type="button" onClick={handleLogout}>Log out</button></div>
      </header>

      <section className="page-content" id="forms">
        <div className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{greeting()}</p>
            <h1>Your forms</h1>
            <p className="page-intro">Create, publish and track the forms your team needs.</p>
            {!loading && (
              <div className="hero-chips">
                <span><b>{counts.PUBLISHED || 0}</b> live</span>
                <span><b>{counts.DRAFT || 0}</b> in draft</span>
                <span><b>{counts.INACTIVE || 0}</b> paused</span>
              </div>
            )}
            <button className="button button-primary hero-cta" onClick={onCreate}>
              <span aria-hidden="true">＋</span> New form <kbd className="kbd">N</kbd>
            </button>
          </div>
          <div className="sheet-stack hero-art" aria-hidden="true">
            <div className="sheet sheet-back" /><div className="sheet sheet-mid" />
            <div className="sheet sheet-front"><i className="line w60" /><i className="line w90" /><i className="line w40" /><i className="box" /><i className="line w75" /><i className="check" /></div>
          </div>
        </div>

        {error && <div className="notice notice-error" role="alert">{error} <button className="text-button" type="button" onClick={loadForms}>Try again</button></div>}

        {!loading && forms.length > 0 && (
          <div className="stat-row" role="tablist" aria-label="Filter by status">
            {tabs.map((tab) => {
              const value = tab.key === 'all' ? forms.length : counts[tab.key] || 0
              return (
                <button key={tab.key} type="button" role="tab" aria-selected={statusFilter === tab.key}
                  className={`stat-card stat-${tab.key.toLowerCase()} ${statusFilter === tab.key ? 'stat-active' : ''}`}
                  onClick={() => setStatusFilter(tab.key)}>
                  <strong>{value}</strong><span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        )}

        <section className="list-panel" aria-label="Existing forms">
          <div className="panel-heading">
            <div>
              <h2>{tabs.find((tab) => tab.key === statusFilter)?.label}</h2>
              <p>{loading ? 'Loading forms…' : `Showing ${filteredForms.length} of ${forms.length}`}</p>
            </div>
            <div className="forms-toolbar-actions">
              <label className="filter-control"><span>Search <kbd className="kbd kbd-dark">/</kbd></span><input ref={searchRef} type="search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Name, description, or slug" /></label>
              <label className="filter-control"><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label>
              <div className="segmented" role="group" aria-label="Layout">
                <button type="button" aria-pressed={view === 'cards'} onClick={() => changeView('cards')}>Cards</button>
                <button type="button" aria-pressed={view === 'table'} onClick={() => changeView('table')}>Table</button>
              </div>
              <button className="button button-quiet" onClick={loadForms} disabled={loading} aria-label="Refresh forms">↻ <span>Refresh</span></button>
            </div>
          </div>

          {loading ? (
            <div className="skeleton-list" aria-busy="true" aria-label="Loading forms">
              {[0, 1, 2, 3].map((i) => <div className="skeleton-row" key={i}><span className="skeleton w40" /><span className="skeleton w15" /><span className="skeleton w20" /></div>)}
            </div>
          ) : forms.length === 0 ? (
            <div className="empty-state">
              <div className="empty-symbol" aria-hidden="true">＋</div>
              <h3>Your workspace is ready</h3>
              <p>Start with a blank form and add the fields you need.</p>
              <button className="button button-primary" onClick={onCreate}>Create your first form</button>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="forms-no-match">No forms match these filters. <button className="text-button" type="button" onClick={clearFilters}>Clear filters</button></div>
          ) : view === 'cards' ? (
            <div className="card-grid">
              {filteredForms.map((form, index) => {
                const status = form.status.toUpperCase()
                return (
                  <article className={`form-card card-${status.toLowerCase()}`} key={form.form_id} style={{ '--i': Math.min(index, 8) }}>
                    <div className="card-sheet" aria-hidden="true"><i /><i /><i /><b /></div>
                    <div className="card-top">
                      <span className={`status-pill status-${status.toLowerCase()}`}><i className="pill-dot" />{statusLabel[status] || status}</span>
                      <span className="card-date" title={new Date(form.created_at).toLocaleString()}>{relativeDate(form.created_at)}</span>
                    </div>
                    <button className="card-title" onClick={() => onEdit(form.form_id)}>{form.form_name}</button>
                    <p className="card-desc">{form.form_description || 'No description yet'}</p>
                    <code className="slug-value">/{form.form_slug}</code>
                    <div className="card-actions">{renderActions(form)}</div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="forms-table">
                <thead><tr><th>Form name</th><th>Status</th><th>Slug</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {filteredForms.map((form) => {
                    const status = form.status.toUpperCase()
                    return (
                      <tr key={form.form_id} className={`row-${status.toLowerCase()}`}>
                        <td>
                          <button className="form-title-button" onClick={() => onEdit(form.form_id)}>{form.form_name}</button>
                          <span className="form-description">{form.form_description || 'No description yet'}</span>
                        </td>
                        <td><span className={`status-pill status-${status.toLowerCase()}`}><i className="pill-dot" />{statusLabel[status] || status}</span></td>
                        <td><code className="slug-value">/{form.form_slug}</code></td>
                        <td className="date-cell" title={new Date(form.created_at).toLocaleString()}>{relativeDate(form.created_at)}</td>
                        <td className="row-actions">{renderActions(form)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <footer className="page-footer">FormFlow <span>·</span> Admin <span>·</span> Tip: press <kbd className="kbd kbd-dark">/</kbd> to search, <kbd className="kbd kbd-dark">N</kbd> for a new form</footer>
      </section>

      {pendingTransition && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setPendingTransition(null) }}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="transition-title">
            <p className="eyebrow">Confirm action</p>
            <h2 id="transition-title">{pendingTransition.action === 'publish' ? `Publish “${pendingTransition.form.form_name}”?` : `Deactivate “${pendingTransition.form.form_name}”?`}</h2>
            <p>{pendingTransition.action === 'publish'
              ? 'Anyone with the link will be able to open and submit this form. You can deactivate it at any time.'
              : 'The public link will stop working straight away. Existing submissions stay available to you.'}</p>
            <div className="confirm-actions">
              <button className="button button-quiet" onClick={() => setPendingTransition(null)}>Cancel</button>
              <button className="button button-primary" autoFocus onClick={confirmStatusTransition} disabled={transitioningId === pendingTransition.form.form_id}>
                {transitioningId === pendingTransition.form.form_id ? 'Saving…' : pendingTransition.action === 'publish' ? 'Publish' : 'Deactivate'}
              </button>
            </div>
          </section>
        </div>
      )}
      <Toast toast={toast} onClose={hide} />
    </main>
  )
}
