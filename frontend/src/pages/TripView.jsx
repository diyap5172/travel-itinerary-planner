import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, inr } from "../api.js";

const SLOT_ORDER = { morning: 0, afternoon: 1, evening: 2 };

export default function TripView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState(null);
  const [active, setActive] = useState(1);
  const [editing, setEditing] = useState(null); // {dayNo, activity}
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getTrip(id).then(setTrip).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="error">{error} <Link to="/">Back to dashboard</Link></p>;
  if (!trip) return <p className="muted">Loading trip…</p>;

  const itin = trip.itinerary;
  const day = itin.days.find((d) => d.day === active) || itin.days[0];

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(""), 2500); };

  async function persist(newItin, label = "Saved") {
    setBusy("Saving…");
    try {
      setTrip(await api.saveItinerary(trip.id, newItin));
      flash(label);
    } catch (e) { setError(e.message); }
    setBusy("");
  }

  const mapDays = (fn) => ({ ...itin, days: itin.days.map(fn) });

  const deleteActivity = (aid) =>
    persist(mapDays((d) => d.day === day.day ? { ...d, activities: d.activities.filter((a) => a.id !== aid) } : d), "Activity removed");

  function saveActivity(a) {
    const { dayNo, isNew } = editing;
    const clean = { ...a, cost: Number(a.cost) || 0 };
    persist(mapDays((d) => {
      if (d.day !== dayNo) return d;
      const list = isNew ? [...d.activities, clean] : d.activities.map((x) => (x.id === clean.id ? clean : x));
      list.sort((x, y) => SLOT_ORDER[x.time_slot] - SLOT_ORDER[y.time_slot]);
      return { ...d, activities: list };
    }), "Activity saved");
    setEditing(null);
  }

  function addActivity() {
    setEditing({
      dayNo: day.day, isNew: true,
      activity: { id: Math.random().toString(36).slice(2, 12), time_slot: "afternoon", time: "02:00 PM", title: "", description: "", category: "sightseeing", duration: "", cost: 0 },
    });
  }

  async function regenDay() {
    setBusy(`Regenerating day ${day.day}…`);
    try { setTrip(await api.regenerateDay(trip.id, day.day)); flash("Day regenerated"); }
    catch (e) { setError(e.message); }
    setBusy("");
  }

  async function regenTrip() {
    if (!window.confirm("Replace the whole itinerary with a new one? Your edits will be lost.")) return;
    setBusy("Regenerating trip…");
    try { setTrip(await api.regenerateTrip(trip.id)); setActive(1); flash("Trip regenerated"); }
    catch (e) { setError(e.message); }
    setBusy("");
  }

  async function remove() {
    if (!window.confirm("Delete this trip permanently?")) return;
    await api.deleteTrip(trip.id);
    nav("/");
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => flash("Link copied"));
  }

  const dayCost = (d) => d.activities.reduce((s, a) => s + (a.cost || 0), 0);
  const overBudget = trip.total_cost > trip.request.budget_amount;

  return (
    <>
      <div className="row between noprint">
        <Link to="/" className="muted">← All trips</Link>
        <div className="row">
          <button className="btn ghost" onClick={copyLink}>Copy link</button>
          <button className="btn ghost" onClick={() => window.print()}>Download PDF</button>
          <button className="btn ghost" onClick={regenTrip} disabled={!!busy}>Regenerate trip</button>
          <button className="btn ghost" onClick={remove}>Delete</button>
        </div>
      </div>

      <h1>{trip.request.destination}</h1>
      <p className="muted">
        {trip.request.start_date} to {trip.request.end_date} · {trip.request.travel_type} ({trip.request.group_size}) · {trip.request.pace} pace
      </p>
      <p>{itin.summary}</p>

      <div className="stats">
        <div className="stat"><b>{inr(trip.total_cost)}</b><span>Estimated cost</span></div>
        <div className="stat"><b>{inr(trip.request.budget_amount)}</b><span>Your budget</span></div>
        <div className={"stat " + (overBudget ? "warn" : "ok")}>
          <b>{overBudget ? "Over by " + inr(trip.total_cost - trip.request.budget_amount) : "Within budget"}</b>
          <span>{overBudget ? "Remove or edit activities" : inr(trip.request.budget_amount - trip.total_cost) + " left"}</span>
        </div>
      </div>

      {(busy || msg) && <p className="notice noprint">{busy || msg}</p>}

      <div className="tabs noprint">
        {itin.days.map((d) => (
          <button key={d.day} className={"tab" + (d.day === day.day ? " on" : "")} onClick={() => setActive(d.day)}>Day {d.day}</button>
        ))}
      </div>

      <section className="day">
        <div className="row between">
          <h2>{day.title}</h2>
          <span className="price">{inr(dayCost(day))}</span>
        </div>
        <div className="timeline">
          {day.activities.map((a) => (
            <div className="act" key={a.id}>
              <div className="when"><b>{a.time}</b><span>{a.time_slot}</span></div>
              <div className="what">
                <h3>{a.title} <small className="tag">{a.category}</small></h3>
                <p>{a.description}</p>
                <p className="muted">{a.duration && a.duration + " · "}{inr(a.cost)}</p>
                <div className="row noprint">
                  <button className="link" onClick={() => setEditing({ dayNo: day.day, isNew: false, activity: a })}>Edit</button>
                  <button className="link" onClick={() => deleteActivity(a.id)}>Remove</button>
                </div>
              </div>
            </div>
          ))}
          {day.activities.length === 0 && <p className="muted">No activities for this day yet.</p>}
        </div>
        <div className="row noprint">
          <button className="btn ghost" onClick={addActivity}>Add activity</button>
          <button className="btn ghost" onClick={regenDay} disabled={!!busy}>Regenerate this day</button>
        </div>
      </section>

      <div className="two info">
        <section>
          <h2>Where to stay</h2>
          {itin.stays.map((s, i) => (
            <div className="mini" key={i}>
              <b>{s.name}</b> <small className="tag">{s.type}</small>
              <p>{s.description}</p>
              <p className="muted">{inr(s.price_per_night)} per night</p>
            </div>
          ))}
        </section>
        <section>
          <h2>Getting around</h2>
          <ul>{itin.transport.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <h2>Tips</h2>
          <ul>{itin.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </section>
      </div>

      {editing && <EditModal data={editing.activity} onSave={saveActivity} onClose={() => setEditing(null)} />}
    </>
  );
}

function EditModal({ data, onSave, onClose }) {
  const [a, setA] = useState(data);
  const set = (k, v) => setA((p) => ({ ...p, [k]: v }));
  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); if (a.title.trim()) onSave(a); }}>
        <h2>{data.title ? "Edit activity" : "Add activity"}</h2>
        <label>Title<input value={a.title} onChange={(e) => set("title", e.target.value)} autoFocus /></label>
        <label>Description<textarea rows="3" value={a.description} onChange={(e) => set("description", e.target.value)} /></label>
        <div className="two">
          <label>Time<input value={a.time} onChange={(e) => set("time", e.target.value)} /></label>
          <label>Part of day
            <select value={a.time_slot} onChange={(e) => set("time_slot", e.target.value)}>
              <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="evening">Evening</option>
            </select>
          </label>
        </div>
        <div className="two">
          <label>Duration<input value={a.duration} onChange={(e) => set("duration", e.target.value)} /></label>
          <label>Cost (₹)<input type="number" min="0" value={a.cost} onChange={(e) => set("cost", e.target.value)} /></label>
        </div>
        <div className="row">
          <button className="btn primary">Save activity</button>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
