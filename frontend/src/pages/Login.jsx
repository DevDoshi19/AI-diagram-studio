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
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/v1/auth/login', { email, password })
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/generate')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="flex items-center justify-center">

      <div style={{ width: '420px' }}>

        {/* Logo */}
        <div className="mb-10">
          <span className="mono" style={{ color: 'var(--accent)', fontSize: '13px' }}>
            $ ai-diagram-studio
          </span>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginTop: '8px', color: 'var(--text)' }}>
            Welcome back.
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>
            Turn plain text into architecture diagrams.
          </p>
        </div>

        {/* Form */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '32px'
        }}>
          {error && (
            <div className="mono" style={{
              color: '#FF5F5F',
              fontSize: '13px',
              marginBottom: '20px',
              padding: '10px 14px',
              border: '1px solid #FF5F5F33',
              background: '#FF5F5F11'
            }}>
              ✗ {error}
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label className="mono" style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '12px 14px',
                fontSize: '14px',
                fontFamily: 'Inter',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label className="mono" style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '12px 14px',
                fontSize: '14px',
                fontFamily: 'Inter',
                outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? 'var(--muted)' : 'var(--accent)',
              color: '#0A0A0F',
              padding: '13px',
              fontSize: '14px',
              fontWeight: '600',
              fontFamily: 'Space Grotesk',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = 'var(--accent-dim)' }}
            onMouseLeave={e => { if (!loading) e.target.style.background = 'var(--accent)' }}
          >
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '20px', textAlign: 'center' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Create one
          </Link>
        </p>

      </div>
    </div>
  )
}