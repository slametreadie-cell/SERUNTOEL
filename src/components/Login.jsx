import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/router'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('seruntul-theme') || 'light'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'Email atau password salah. Coba lagi.'
          : error.message
      )
    } else {
      router.push('/dashboard')
    }

    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">🐟</div>
          <h1>Seruntul</h1>
          <p>Entrepreneur Business Suite</p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-control"
              placeholder="nama@email.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? <><span className="spinner" /> Masuk...</> : 'Masuk'}
          </button>
        </form>

        <div className="login-footer">
          <p>Belum punya akun? Hubungi admin untuk pendaftaran.</p>
        </div>
      </div>

      <style jsx>{`
        .login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background:
            radial-gradient(circle at 15% 20%, rgba(13,148,136,.12), transparent 40%),
            radial-gradient(circle at 85% 80%, rgba(217,119,6,.10), transparent 40%),
            var(--bg);
        }
        .login-card {
          width: 100%;
          max-width: 400px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 40px 32px;
          box-shadow: var(--shadow-xl);
        }
        .login-brand { text-align: center; margin-bottom: 28px; }
        .login-logo {
          width: 64px; height: 64px; margin: 0 auto 16px;
          background: linear-gradient(135deg, var(--primary), var(--primary-dark));
          border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          box-shadow: 0 8px 24px rgba(13,148,136,.35);
        }
        .login-brand h1 {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 26px; font-weight: 800; letter-spacing: -.5px;
        }
        .login-brand p { color: var(--muted); font-size: 13px; margin-top: 2px; }
        .login-footer { text-align: center; margin-top: 24px; color: var(--muted); font-size: 12.5px; }
        @media (min-width: 640px) {
          .login-card { padding: 48px 40px; }
        }
      `}</style>
    </div>
  )
}
