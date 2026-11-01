import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import NewTrip from "./pages/NewTrip.jsx";
import TripView from "./pages/TripView.jsx";

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">Wayfare</Link>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/new">Plan a trip</NavLink>
        </nav>
        <button className="btn ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/new" element={<NewTrip />} />
          <Route path="/trip/:id" element={<TripView />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go to dashboard</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
