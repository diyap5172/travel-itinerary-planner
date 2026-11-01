// All calls to the FastAPI backend live here.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running on port 8000?");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.detail) msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  listTrips: () => request("/api/trips"),
  getTrip: (id) => request(`/api/trips/${id}`),
  generate: (payload) => request("/api/trips/generate", { method: "POST", body: JSON.stringify(payload) }),
  saveItinerary: (id, itinerary) => request(`/api/trips/${id}`, { method: "PUT", body: JSON.stringify({ itinerary }) }),
  deleteTrip: (id) => request(`/api/trips/${id}`, { method: "DELETE" }),
  regenerateDay: (id, day) => request(`/api/trips/${id}/regenerate-day/${day}`, { method: "POST" }),
  regenerateTrip: (id) => request(`/api/trips/${id}/regenerate`, { method: "POST" }),
};

export const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
