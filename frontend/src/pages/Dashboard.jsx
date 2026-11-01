import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "../api.js";

export default function Dashboard() {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = () =>
    api.listTrips().then(setTrips).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  async function remove(id) {
    if (!window.confirm("Delete this trip permanently?")) return;
    await api.deleteTrip(id);
    load();
  }

  if (error) return <p className="error">{error}</p>;
  if (!trips) return <p className="muted">Loading your trips…</p>;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = trips.filter((t) => t.request.end_date >= today).length;
  const budget = trips.reduce((s, t) => s + (t.total_cost || 0), 0);
  const shown = trips.filter((t) =>
    t.request.destination.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <div className="row between">
        <h1>Your trips</h1>
        <Link className="btn primary" to="/new">Plan a new trip</Link>
      </div>

      <div className="stats">
        <div className="stat"><b>{trips.length}</b><span>Trips planned</span></div>
        <div className="stat"><b>{upcoming}</b><span>Upcoming</span></div>
        <div className="stat"><b>{inr(budget)}</b><span>Estimated spend</span></div>
      </div>

      {trips.length > 0 && (
        <input className="search" placeholder="Search by destination" value={query}
               onChange={(e) => setQuery(e.target.value)} />
      )}

      {trips.length === 0 ? (
        <div className="empty">
          <h2>No trips yet</h2>
          <p>Tell us where you want to go and get a day-by-day plan in seconds.</p>
          <Link className="btn primary" to="/new">Plan your first trip</Link>
        </div>
      ) : (
        <div className="grid">
          {shown.map((t) => (
            <article className="card" key={t.id}>
              <h3>{t.request.destination}</h3>
              <p className="muted">{t.request.start_date} to {t.request.end_date}</p>
              <p>{t.itinerary.days.length} days · {t.request.travel_type} · {t.request.pace}</p>
              <p className="price">{inr(t.total_cost)}</p>
              <div className="row">
                <Link className="btn primary" to={`/trip/${t.id}`}>Open</Link>
                <button className="btn ghost" onClick={() => remove(t.id)}>Delete</button>
              </div>
            </article>
          ))}
          {shown.length === 0 && <p className="muted">No trips match "{query}".</p>}
        </div>
      )}
    </>
  );
}
