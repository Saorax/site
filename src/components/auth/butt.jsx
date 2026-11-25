import { useEffect, useState } from "react";
import { Spinner, cx } from "../ui";
import { authFetch, clearTokens, loginAvailable, loginUrl, readTokens, takeLoginResult } from "./session";

const buttonBase = "inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-sm font-bold transition";

function Avatar({ src, name }) {
  if (src) return <img className="h-12 w-12 shrink-0 rounded-lg object-cover" src={src} alt="" />;
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 font-bold text-white">{(name || "?").charAt(0).toUpperCase()}</div>;
}

function LoginButton({ adminHref = "/esports/autoseed/admin" }) {
  const [state, setState] = useState({ status: "checking", user: null, error: null, available: true });

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const result = takeLoginResult();
      if (result.error) {
        const available = await loginAvailable();
        if (!cancelled) setState({ status: "signedOut", user: null, error: "start.gg didn't accept the sign-in. Try again.", available });
        return;
      }
      if (readTokens().accessToken) {
        try {
          const { signedOut, response } = await authFetch("/auth/user");
          if (!signedOut && response.ok) {
            const data = await response.json();
            if (!cancelled) setState({ status: "signedIn", user: data.user || {}, error: null, available: true });
            return;
          }
        } catch {
          if (!cancelled) setState({ status: "signedIn", user: {}, error: "Couldn't load your start.gg profile.", available: true });
          return;
        }
      }
      const available = await loginAvailable();
      if (!cancelled) setState({ status: "signedOut", user: null, error: null, available });
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const signOut = () => {
    clearTokens();
    setState((current) => ({ ...current, status: "signedOut", user: null, error: null }));
  };

  if (state.status === "checking") {
    return <div className="flex min-h-10 items-center gap-2 text-sm text-slate-400"><Spinner />Checking sign-in</div>;
  }

  if (state.status === "signedIn") {
    const user = state.user || {};
    const name = user.player?.gamerTag || user.slug || "start.gg user";
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Avatar src={user.images?.[0]?.url} name={name} />
          <div className="min-w-0">
            <div className="truncate font-bold text-white">{name}</div>
            {user.slug && <a className="text-sm text-slate-400 hover:text-blue-300 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://start.gg/${user.slug}`}>{user.slug}</a>}
          </div>
        </div>
        {state.error && <p className="text-sm text-amber-200">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <a href={adminHref} className={cx(buttonBase, "border-blue-400/40 bg-blue-500 text-white hover:bg-blue-400")}>Open Autoseed</a>
          <button type="button" onClick={signOut} className={cx(buttonBase, "border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700")}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {state.error && <p className="text-sm text-rose-200">{state.error}</p>}
      {state.available ? (
        <a href={loginUrl()} className={cx(buttonBase, "border-emerald-400/40 bg-emerald-600 text-white hover:bg-emerald-500")}>Sign in with start.gg</a>
      ) : (
        <>
          <span className={cx(buttonBase, "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-400")} aria-disabled="true">Sign in with start.gg</span>
          <p className="text-sm text-slate-400">start.gg sign-in isn't available on this server right now.</p>
        </>
      )}
    </div>
  );
}

export default LoginButton;
