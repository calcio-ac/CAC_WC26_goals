import { App } from "./App";
import { Login } from "./components/Login";
import { useAuth } from "./lib/useAuth";
import { supabaseConfigured } from "./lib/supabase";

export function Root() {
  const auth = useAuth();

  // No Supabase configured → offline mode (localStorage only), no gate.
  if (!supabaseConfigured) return <App auth={null} />;

  if (auth.loading) {
    return (
      <div className="gate">
        <div className="gate-card">Loading…</div>
      </div>
    );
  }

  // Must be signed in AND on the tagger allowlist.
  if (!auth.session || !auth.allowed) return <Login auth={auth} />;

  return <App auth={auth} />;
}
