import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const INTERESTS = ["food", "culture", "adventure", "nature", "shopping", "nightlife", "sightseeing"];

export default function NewTrip() {
  const nav = useNavigate();
  const [f, setF] = useState({
    destination: "", start_date: "", end_date: "",
    budget_level: "medium", budget_amount: 20000,
    travel_type: "solo", group_size: 1, pace: "balanced",
    stay_level: "comfort", interests: ["food", "sightseeing"], notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (i) =>
    set("interests", f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i]);

  function changeType(type) {
    setF((p) => ({ ...p, travel_type: type, group_size: type === "solo" ? 1 : type === "couple" ? 2 : Math.max(p.group_size, 3) }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (f.destination.trim().length < 2) return setError("Enter a destination.");
    if (!f.start_date || !f.end_date) return setError("Choose both travel dates.");
    if (f.end_date < f.start_date) return setError("End date must be on or after the start date.");
    setLoading(true);
    try {
      const trip = await api.generate({
        ...f, destination: f.destination.trim(),
        budget_amount: Number(f.budget_amount), group_size: Number(f.group_size),
      });
      nav(`/trip/${trip.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <h1>Plan a trip</h1>
      <p className="muted">Fill in a few details. The AI builds the plan around them.</p>

      <label>Destination
        <input value={f.destination} onChange={(e) => set("destination", e.target.value)} placeholder="e.g. Jaipur, Goa, Manali" />
      </label>

      <div className="two">
        <label>Start date
          <input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </label>
        <label>End date
          <input type="date" value={f.end_date} min={f.start_date} onChange={(e) => set("end_date", e.target.value)} />
        </label>
      </div>

      <div className="two">
        <label>Total budget (₹)
          <input type="number" min="1000" step="500" value={f.budget_amount} onChange={(e) => set("budget_amount", e.target.value)} />
        </label>
        <label>Budget level
          <select value={f.budget_level} onChange={(e) => set("budget_level", e.target.value)}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
          </select>
        </label>
      </div>

      <div className="two">
        <label>Travelling as
          <select value={f.travel_type} onChange={(e) => changeType(e.target.value)}>
            <option value="solo">Solo</option><option value="couple">Couple</option><option value="group">Group</option>
          </select>
        </label>
        <label>Group size
          <input type="number" min="1" max="30" value={f.group_size} disabled={f.travel_type !== "group"}
                 onChange={(e) => set("group_size", e.target.value)} />
        </label>
      </div>

      <div className="two">
        <label>Pace
          <select value={f.pace} onChange={(e) => set("pace", e.target.value)}>
            <option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="packed">Packed</option>
          </select>
        </label>
        <label>Stay
          <select value={f.stay_level} onChange={(e) => set("stay_level", e.target.value)}>
            <option value="budget">Budget</option><option value="comfort">Comfort</option><option value="premium">Premium</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend>Interests</legend>
        <div className="chips">
          {INTERESTS.map((i) => (
            <button type="button" key={i} className={"chip" + (f.interests.includes(i) ? " on" : "")} onClick={() => toggle(i)}>{i}</button>
          ))}
        </div>
      </fieldset>

      <label>Anything else? (optional)
        <textarea rows="3" value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Vegetarian food, travelling with parents, avoid long treks…" />
      </label>

      {error && <p className="error">{error}</p>}
      <button className="btn primary big" disabled={loading}>
        {loading ? "Building your itinerary… this can take up to 20 seconds" : "Generate itinerary"}
      </button>
    </form>
  );
}
