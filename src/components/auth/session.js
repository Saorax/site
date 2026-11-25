import { host } from "../../stuff";

const ACCESS = "accessToken";
const REFRESH = "refreshToken";

const usable = (value) => typeof value === "string" && value !== "" && value !== "undefined" && value !== "null";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readTokens() {
  const store = storage();
  const accessToken = store?.getItem(ACCESS);
  const refreshToken = store?.getItem(REFRESH);
  return { accessToken: usable(accessToken) ? accessToken : null, refreshToken: usable(refreshToken) ? refreshToken : null };
}

export function saveTokens({ accessToken, refreshToken }) {
  const store = storage();
  if (!store || !usable(accessToken)) return false;
  store.setItem(ACCESS, accessToken);
  if (usable(refreshToken)) store.setItem(REFRESH, refreshToken);
  else store.removeItem(REFRESH);
  return true;
}

export function clearTokens() {
  const store = storage();
  store?.removeItem(ACCESS);
  store?.removeItem(REFRESH);
  store?.removeItem("user");
  document.cookie = "accessToken=; Max-Age=0; Path=/; Secure; SameSite=Strict";
}

export function takeLoginResult() {
  const url = new URL(window.location.href);
  const fromHash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const pick = (key) => fromHash.get(key) || url.searchParams.get(key);
  const accessToken = pick("access_token");
  const refreshToken = pick("refresh_token");
  const error = pick("login_error");
  if (!accessToken && !error) return { saved: false, error: null };
  for (const key of ["access_token", "refresh_token", "expires_in", "login_error"]) {
    fromHash.delete(key);
    url.searchParams.delete(key);
  }
  const hash = fromHash.toString();
  window.history.replaceState(null, "", `${url.pathname}${url.search}${hash ? `#${hash}` : ""}`);
  return { saved: accessToken ? saveTokens({ accessToken, refreshToken }) : false, error };
}

export async function refreshTokens() {
  const { refreshToken } = readTokens();
  if (!refreshToken) return null;
  try {
    const response = await fetch(`${host}/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!usable(data?.access_token)) return null;
    saveTokens({ accessToken: data.access_token, refreshToken: data.refresh_token || refreshToken });
    return data.access_token;
  } catch {
    return null;
  }
}

export async function authFetch(path, options = {}) {
  const send = (token) => fetch(`${host}${path}`, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` } });
  const { accessToken } = readTokens();
  if (!accessToken) return { signedOut: true, response: null };
  let response = await send(accessToken);
  if (response.status !== 401) return { signedOut: false, response };
  const fresh = await refreshTokens();
  if (!fresh) {
    clearTokens();
    return { signedOut: true, response };
  }
  response = await send(fresh);
  if (response.status === 401) {
    clearTokens();
    return { signedOut: true, response };
  }
  return { signedOut: false, response };
}

export async function loginAvailable() {
  try {
    const response = await fetch(`${host}/auth/login/status`);
    if (!response.ok) return false;
    const data = await response.json();
    return data?.startgg === true;
  } catch {
    return false;
  }
}

export function loginUrl(returnTo = window.location.href.split("#")[0]) {
  return `${host}/auth/login?redirect_uri=${encodeURIComponent(returnTo)}`;
}
