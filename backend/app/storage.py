"""Saves trips. Uses Supabase if configured, otherwise a local JSON file."""
import json
from pathlib import Path
from typing import List, Optional

import httpx

from . import config

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "trips.json"


def _use_supabase() -> bool:
    return bool(config.SUPABASE_URL and config.SUPABASE_KEY)


def _headers() -> dict:
    return {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def _table() -> str:
    return f"{config.SUPABASE_URL}/rest/v1/trips"


# ----------------------------------------------------------- local file mode
def _read_file() -> dict:
    if not DATA_FILE.exists():
        return {}
    return json.loads(DATA_FILE.read_text(encoding="utf-8") or "{}")


def _write_file(data: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


# ---------------------------------------------------------------- public API
async def save_trip(trip: dict) -> None:
    if _use_supabase():
        row = {"id": trip["id"], "created_at": trip["created_at"], "data": trip}
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                _table(), json=row,
                headers={**_headers(), "Prefer": "resolution=merge-duplicates"},
                params={"on_conflict": "id"},
            )
        if r.status_code >= 300:
            raise RuntimeError(f"Supabase error {r.status_code}: {r.text[:200]}")
    else:
        data = _read_file()
        data[trip["id"]] = trip
        _write_file(data)


async def list_trips() -> List[dict]:
    if _use_supabase():
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(_table(), headers=_headers(),
                            params={"select": "data", "order": "created_at.desc"})
        if r.status_code >= 300:
            raise RuntimeError(f"Supabase error {r.status_code}: {r.text[:200]}")
        return [row["data"] for row in r.json()]
    trips = list(_read_file().values())
    return sorted(trips, key=lambda t: t["created_at"], reverse=True)


async def get_trip(trip_id: str) -> Optional[dict]:
    if _use_supabase():
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(_table(), headers=_headers(),
                            params={"select": "data", "id": f"eq.{trip_id}"})
        rows = r.json() if r.status_code < 300 else []
        return rows[0]["data"] if rows else None
    return _read_file().get(trip_id)


async def delete_trip(trip_id: str) -> None:
    if _use_supabase():
        async with httpx.AsyncClient(timeout=20) as c:
            await c.delete(_table(), headers=_headers(), params={"id": f"eq.{trip_id}"})
    else:
        data = _read_file()
        data.pop(trip_id, None)
        _write_file(data)
