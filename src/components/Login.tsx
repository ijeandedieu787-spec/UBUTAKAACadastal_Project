import React, { useState, memo } from "react";
import { MOCK_USERS, AuthUser, authenticateUser } from "../data/users";
import { Landmark, ShieldAlert, CheckCircle, Eye, EyeOff } from "lucide-react";

interface LoginProps {
  onLogin: (user: AuthUser) => void;
}

const Login = memo(function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const user = authenticateUser(username.trim(), password.trim());
      if (user) {
        onLogin(user);
      } else {
        setError("Invalid credentials. Check the quick login hints below.");
        setIsLoading(false);
      }
    }, 600);
  };

  const handleQuickLogin = (u: (typeof MOCK_USERS)[0]) => {
    setUsername(u.username);
    setPassword(u.password);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-slate-50 font-black text-2xl shadow-2xl mx-auto mb-4">
            U
          </div>
          <h1 className="text-2xl font-black text-slate-100 tracking-tight">
            UBUTAKA SMART LAND
          </h1>
          <p className="text-slate-400 text-sm font-mono mt-1 tracking-wider">
            Rwanda LAIS Unified Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-8 shadow-2xl backdrop-blur">
          <h2 className="text-lg font-bold text-slate-100 mb-6">
            Authorized Sign-In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                id="login_username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="w-full bg-slate-900/80 border border-slate-600/60 rounded-lg px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition placeholder-slate-500"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="login_password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-900/80 border border-slate-600/60 rounded-lg px-3.5 py-2.5 text-slate-100 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition placeholder-slate-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-rose-900/30 border border-rose-700/50 rounded-lg px-3.5 py-2.5 text-rose-300 text-xs">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              id="login_submit_btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Authenticating...
                </>
              ) : (
                <>
                  <Landmark className="w-4 h-4" />
                  Sign In to Land Registry
                </>
              )}
            </button>
          </form>

          {/* Quick Login Hints */}
          <div className="mt-6 pt-5 border-t border-slate-700/40">
            <div className="flex items-center gap-1.5 mb-3">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Quick Login (Demo)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {MOCK_USERS.map((u) => (
                <button
                  key={u.username}
                  type="button"
                  onClick={() => handleQuickLogin(u)}
                  className="flex items-center justify-between bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700/30 rounded-lg px-3 py-1.5 text-left transition cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono text-slate-500 font-bold w-20 uppercase">
                      {u.role}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">
                      {u.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">
                    {u.username} / {u.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center mt-6 text-[10px] text-slate-600 font-mono">
          Certified by Rwanda Land Management and Use Authority (RLMUA)
        </p>
      </div>
    </div>
  );
});

export default Login;
