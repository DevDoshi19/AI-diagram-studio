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
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/v1/auth/register', form)
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify(res.data.user))
      navigate('/generate')
    } catch (err) {
      if (!err.response) {
        setError('Cannot connect to server — please verify backend is running')
      } else {
        setError(err.response?.data?.detail || 'Registration failed — try again')
      }
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { label: 'NAME', name: 'name', type: 'text', placeholder: 'Your name', autoComplete: 'name' },
    { label: 'EMAIL', name: 'email', type: 'email', placeholder: 'you@example.com', autoComplete: 'email' },
    { label: 'PASSWORD', name: 'password', type: 'password', placeholder: '••••••••', autoComplete: 'new-password' },
  ]

  const allFilled = form.name.trim() && form.email.trim() && form.password.trim()

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
            Create your account
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px', lineHeight: '1.5' }}>
            Start turning ideas into architecture diagrams in seconds.
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

            <div className="stagger">
              {fields.map(field => (
                <div key={field.name} className="animate-fade-in" style={{ marginBottom: '20px' }}>
                  <label className="field-label" htmlFor={`register-${field.name}`}>
                    {field.label}
                  </label>
                  <input
                    id={`register-${field.name}`}
                    type={field.type}
                    name={field.name}
                    className="input-field"
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    autoComplete={field.autoComplete}
                    required
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !allFilled}
              style={{ marginTop: '8px' }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  Creating account
                  <span className="loading-dots"><span></span><span></span><span></span></span>
                </span>
              ) : 'Get started →'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p className="animate-fade-in" style={{
          color: 'var(--muted)',
          fontSize: '13px',
          marginTop: '24px',
          textAlign: 'center',
          animationDelay: '200ms'
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent)', fontWeight: '500' }}>
            Sign in
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