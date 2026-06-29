import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/v1/auth/login', { email, password })
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/generate')
    } catch (err) {
      // If backend is unreachable, offer demo mode
      if (!err.response) {
        setError('Backend unavailable — use "Enter Demo" below to preview UI')
      } else {
        setError(err.response?.data?.detail || 'Login failed — check your credentials')
      }
    } finally {
      setLoading(false)
    }
  }

  function enterDemo() {
    localStorage.setItem('token', 'demo-token')
    localStorage.setItem('user', JSON.stringify({ name: 'Demo User', email: 'demo@studio.ai' }))
    navigate('/generate')
  }

  return (
    <div className="auth-bg">
      <div style={{ width: '100%', maxWidth: '440px', padding: '24px', position: 'relative', zIndex: 1 }}>

        {/* Brand header */}
        <div className="animate-fade-in" style={{ marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: '700',
              color: 'var(--bg)',
              fontFamily: 'Space Grotesk, sans-serif'
            }}>
              ◇
            </div>
            <span className="mono" style={{ color: 'var(--muted)', fontSize: '12px', letterSpacing: '0.05em' }}>
              AI DIAGRAM STUDIO
            </span>
          </div>
          <h1 style={{ fontSize: '30px', color: 'var(--text)', lineHeight: '1.2' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px', lineHeight: '1.5' }}>
            Sign in to continue building diagrams from text.
          </p>
        </div>

        {/* Form card */}
        <div className="glass-card animate-fade-in-scale" style={{ padding: '32px', animationDelay: '100ms' }}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="error-banner">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label className="field-label" htmlFor="login-email">EMAIL</label>
              <input
                id="login-email"
                type="email"
                className="input-field"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label className="field-label" htmlFor="login-password">PASSWORD</label>
              <input
                id="login-password"
                type="password"
                className="input-field"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  Signing in
                  <span className="loading-dots"><span></span><span></span><span></span></span>
                </span>
              ) : 'Sign in →'}
            </button>
          </form>

          {/* Demo mode separator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '20px 0 16px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span className="mono" style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.1em' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <button
            type="button"
            onClick={enterDemo}
            className="btn-ghost"
          >
            Enter Demo →
          </button>
        </div>

        {/* Footer link */}
        <p className="animate-fade-in" style={{
          color: 'var(--muted)',
          fontSize: '13px',
          marginTop: '24px',
          textAlign: 'center',
          animationDelay: '200ms'
        }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', fontWeight: '500' }}>
            Create one
          </Link>
        </p>

        {/* Feature hints */}
        <div className="animate-fade-in" style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          marginTop: '40px',
          animationDelay: '350ms'
        }}>
          {['AI-powered', 'Real-time SSE', 'Excalidraw'].map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

      </div>
    </div>
  )
}