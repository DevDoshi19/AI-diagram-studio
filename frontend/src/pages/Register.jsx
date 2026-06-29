import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/v1/auth/register', form)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/generate')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '12px 14px',
    fontSize: '14px',
    fontFamily: 'Inter',
    outline: 'none',
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}
      className="flex items-center justify-center">

      <div style={{ width: '420px' }}>

        <div className="mb-10">
          <span className="mono" style={{ color: 'var(--accent)', fontSize: '13px' }}>
            $ ai-diagram-studio --new-user
          </span>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginTop: '8px', color: 'var(--text)' }}>
            Create account.
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>
            Start turning ideas into diagrams.
          </p>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          padding: '32px'
        }}>
          {error && (
            <div className="mono" style={{
              color: '#FF5F5F', fontSize: '13px', marginBottom: '20px',
              padding: '10px 14px', border: '1px solid #FF5F5F33', background: '#FF5F5F11'
            }}>
              ✗ {error}
            </div>
          )}

          {[
            { label: 'NAME', name: 'name', type: 'text', placeholder: 'Your name' },
            { label: 'EMAIL', name: 'email', type: 'email', placeholder: 'you@example.com' },
            { label: 'PASSWORD', name: 'password', type: 'password', placeholder: '••••••••' },
          ].map(field => (
            <div key={field.name} style={{ marginBottom: '20px' }}>
              <label className="mono" style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
                placeholder={field.placeholder}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          ))}

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
              marginTop: '8px'
            }}
            onMouseEnter={e => { if (!loading) e.target.style.background = 'var(--accent-dim)' }}
            onMouseLeave={e => { if (!loading) e.target.style.background = 'var(--accent)' }}
          >
            {loading ? 'Creating account...' : 'Get started →'}
          </button>
        </div>

        <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '20px', textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  )
}