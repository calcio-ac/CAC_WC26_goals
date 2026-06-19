import { useState } from "react";
import { Auth } from "../lib/useAuth";

export function Login({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed in, but not an allowed tagger.
  const denied = !!auth.session && !auth.allowed;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gate">
      <div className="gate-card">
        <img className="cac" src={`${import.meta.env.BASE_URL}assets/CAC.svg`} alt="Calcio AC" />
        <div className="gate-title">
          GCIP <span className="accent">·</span> TAGGER
        </div>
        <div className="gate-sub">Restricted — taggers only</div>

        {denied ? (
          <>
            <p className="gate-error">
              <strong>{auth.email}</strong> is not an authorized tagger.
            </p>
            <button className="gate-btn" onClick={auth.signOut}>
              Sign out
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="gate-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cac.com"
                required
              />
            </label>
            <label className="gate-field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <p className="gate-error">{error}</p>}
            <button className="gate-btn" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
