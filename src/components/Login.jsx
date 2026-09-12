import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/router'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lihatPassword, setLihatPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [tema, setTema] = useState('light')
  const { signIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem('seruntul-theme') || 'light'
    setTema(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const toggleTema = () => {
    const next = tema === 'light' ? 'dark' : 'light'
    setTema(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('seruntul-theme', next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await signIn(email.trim(), password)

    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'Email atau password salah. Coba lagi.'
          : error.message
      )
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="login-wrap">
      <button className="theme-toggle login-theme" onClick={toggleTema} title="Ganti tema" type="button">
        {tema === 'light' ? '🌙' : '☀️'}
      </button>

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">S</div>
          <div>
            <h1>Seruntul</h1>
            <p>Business Management</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert-danger" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-control"
              placeholder="nama@email.com"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div className="pw-wrap">
              <input
                id="password"
                name="password"
                type={lihatPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsLock(e.getModifierState && e.getModifierState('CapsLock'))}
                onKeyDown={(e) => setCapsLock(e.getModifierState && e.getModifierState('CapsLock'))}
                className="form-control"
                placeholder="Masukkan password"
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setLihatPassword((v) => !v)}
                aria-label={lihatPassword ? 'Sembunyikan password' : 'Lihat password'}
                title={lihatPassword ? 'Sembunyikan password' : 'Lihat password'}
                tabIndex={-1}
              >
                {lihatPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {capsLock && <div className="caps-warn">⚠️ Caps Lock sedang aktif</div>}
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary btn-block login-btn">
            {loading ? <><span className="spinner" /> Masuk...</> : 'Masuk'}
          </button>
        </form>

        <div className="login-footer">
          Belum punya akun? Hubungi pemilik usaha untuk didaftarkan.
        </div>
      </div>

      <style jsx>{`
        .login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg);
        }
        .login-theme { position: fixed; top: 16px; right: 16px; }

        .login-card {
          width: 100%;
          max-width: 372px;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 28px 24px;
        }

        .login-brand {
          display: flex; align-items: center; gap: 12px;
          margin-bottom: 22px; padding-bottom: 18px;
          border-bottom: 1px solid var(--border);
        }
        .login-logo {
          width: 40px; height: 40px; flex-shrink: 0;
          background: var(--primary);
          border-radius: var(--radius-sm);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 19px; font-weight: 600;
        }
        .login-brand h1 { font-size: 17px; font-weight: 600; letter-spacing: -.2px; line-height: 1.2; }
        .login-brand p { color: var(--muted); font-size: 12px; margin-top: 1px; }

        .pw-wrap { position: relative; }
        .pw-wrap .form-control { padding-right: 42px; }
        .pw-toggle {
          position: absolute; right: 6px; top: 50%; transform: translateY(-50%);
          width: 30px; height: 30px; border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; opacity: .65;
        }
        .pw-toggle:hover { opacity: 1; background: var(--card-alt); }

        .caps-warn { font-size: 11.5px; color: var(--warning); margin-top: 5px; }

        .login-btn { padding: 10px; font-size: 13.5px; margin-top: 4px; }

        .login-footer {
          text-align: center; margin-top: 20px; padding-top: 16px;
          border-top: 1px solid var(--border);
          color: var(--muted); font-size: 12px; line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
