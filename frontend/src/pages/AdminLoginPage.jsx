import { useState } from 'react'
import { loginAdmin } from '../services/formsApi'

export default function AdminLoginPage({ redirectTo = '/' }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsOn, setCapsOn] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await loginAdmin(username, password)
      window.location.assign(redirectTo)
    } catch (loginError) {
      if (loginError.status === 401) setError('Invalid username or password. Check both and try again.')
      else if (loginError.status === 503) setError('Admin login is not configured. Set the admin environment variables in backend/.env.')
      else setError('Unable to sign in. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <main className="admin-shell login-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="FormFlow home"><span className="brand-mark">F</span><span>FormFlow</span></a>
        <div className="topbar-meta">Admin sign in</div>
      </header>
      <section className="login-split">
        <aside className="login-aside">
          <div className="sheet-stack" aria-hidden="true">
            <div className="sheet sheet-back" />
            <div className="sheet sheet-mid" />
            <div className="sheet sheet-front">
              <i className="line w60" /><i className="line w90" /><i className="line w40" />
              <i className="box" /><i className="line w75" /><i className="check" />
            </div>
          </div>
          <h2>Build it once. Collect it everywhere.</h2>
          <ul>
            <li>Design forms with drag-free field controls</li>
            <li>Publish and share a public link in one click</li>
            <li>Review submissions and download them as PDF</li>
          </ul>
        </aside>
        <div className="login-content">
          <div className="login-panel">
            <h1>Welcome back</h1>
            <p className="login-description">Sign in to manage forms and registrations.</p>
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            <form className="login-form" onSubmit={handleSubmit}>
              <label className="control-label" htmlFor="admin-username">
                <span>Username</span>
                <input id="admin-username" autoComplete="username" autoFocus value={username} onChange={(event) => setUsername(event.target.value)} required />
              </label>
              <label className="control-label" htmlFor="admin-password">
                <span>Password</span>
                <span className="password-wrap">
                  <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyUp={(event) => setCapsOn(event.getModifierState && event.getModifierState('CapsLock'))}
                    onBlur={() => setCapsOn(false)} required />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </span>
                {capsOn && <small className="caps-warning" role="status">Caps Lock is on.</small>}
              </label>
              <button className="button button-primary" type="submit" disabled={loading || !username || !password}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}
