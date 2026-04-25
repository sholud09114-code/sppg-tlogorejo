import { useState } from "react";
import brandMark from "../assets/bgn-logo-color-optimized.png";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.username.trim() || !form.password) {
      setError("Username dan password wajib diisi.");
      return;
    }

    try {
      setLoading(true);
      await login({
        username: form.username.trim(),
        password: form.password,
      });
    } catch (err) {
      setError(err.message || "Login gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-brand-panel">
          <div className="login-brand-mark">
            <img src={brandMark} alt="Logo Badan Gizi Nasional" />
          </div>
          <div>
            <span className="login-eyebrow">SPPG Tlogorejo</span>
            <h1>Sistem Pelaporan Operasional</h1>
            <p>Masuk untuk memantau laporan harian, menu, belanja, sisa pangan, dan rekap operasional.</p>
          </div>
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-head">
            <h2>Masuk</h2>
            <p>Gunakan akun yang sudah dibuat oleh admin.</p>
          </div>

          <div className="login-field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              disabled={loading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              disabled={loading}
            />
          </div>

          {error ? <div className="login-error">{error}</div> : null}

          <button type="submit" className="submit-btn login-submit" disabled={loading}>
            {loading ? "Memeriksa..." : "Login"}
          </button>
        </form>
      </section>
    </main>
  );
}
