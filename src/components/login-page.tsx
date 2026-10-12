import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "./workspace-provider";
import { SYSTEM_USERS, type RoleType } from "@/lib/auth-service";
import { isDemoAuthEnabled } from "@/lib/security";

export function LoginPage() {
  const { login, loginAsRole } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(res.error || "Invalid email or password.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: RoleType) => {
    loginAsRole(role);
  };

  return (
    <div className="login-screen">
      <div className="login-visual" aria-hidden="true">
        <img src="/images/login-banner.jpg" alt="" className="login-visual-img" />
        <div className="login-visual-shade" />
        <div className="login-visual-copy">
          <img src="/logos/logos/avighna.png" alt="" className="login-mark" />
          <p className="login-eyebrow">Avighna Group</p>
          <h1 className="login-brand">
            avighna <em>one</em>
          </h1>
          <p className="login-tagline">Four companies. One connected view.</p>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-panel-inner">
          <div className="login-panel-head">
            <img src="/logos/logos/avighna.png" alt="Avighna" className="login-panel-logo" />
            <h2>Welcome back</h2>
            <p>Sign in to continue to your workspace.</p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field" htmlFor="login-email">
              Email
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@avighna.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="login-field" htmlFor="login-password">
              Password
              <span className="login-password-wrap">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </span>
            </label>

            <Button type="submit" disabled={loading} className="login-submit">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {isDemoAuthEnabled() && (
            <div className="login-demo">
              <p>Demo access</p>
              <div className="login-demo-list">
                {SYSTEM_USERS.map((u) => (
                  <button key={u.id} type="button" onClick={() => handleQuickLogin(u.role)}>
                    <span className="login-demo-avatar">{u.initials}</span>
                    <span className="login-demo-meta">
                      <span className="login-demo-name">{u.name}</span>
                      <span className="login-demo-role">{u.roleName}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
