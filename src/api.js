const API_URL = import.meta.env.VITE_API_URL || "/api";

export { API_URL };

export function getToken() {
  return localStorage.getItem("token") || "";
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export function isAdmin() {
  return getUser()?.role === "administrator";
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}

// Adds the Bearer token to every request and handles an expired session.
export async function apiFetch(path, options = {}) {
  const url = /^https?:\/\//.test(path) ? path : `${API_URL}${path}`;
  const headers = { ...(options.headers || {}) };
  const token = getToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    logout();
    throw new Error("Session expired. Please log in again.");
  }

  return response;
}
