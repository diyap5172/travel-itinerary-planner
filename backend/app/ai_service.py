"""Talks to the AI model (Gemini) or returns sample data in MOCK mode."""
import json
import re
import uuid
from datetime import date
from typing import Optional

import httpx

from . import config
from .prompts import SYSTEM_PROMPT, build_day_prompt, build_user_prompt
from .schemas import Day, Itinerary, TripRequest


def count_days(req: TripRequest) -> int:
    try:
        s = date.fromisoformat(req.start_date)
        e = date.fromisoformat(req.end_date)
    except ValueError:
        raise ValueError("Dates must be in YYYY-MM-DD format")
    n = (e - s).days + 1
    if n < 1:
        raise ValueError("End date must be on or after start date")
    if n > 14:
        raise ValueError("Please plan at most 14 days at a time")
    return n


def _new_id() -> str:
    return uuid.uuid4().hex[:10]


def _extract_json(text: str) -> dict:
    """Models sometimes wrap JSON in ```json fences. Strip them and parse."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
        raise


async def _call_gemini(user_prompt: str) -> dict:
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{config.GEMINI_MODEL}:generateContent"
    )
    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.8,
            "responseMimeType": "application/json",
        },
    }
    last_error: Optional[Exception] = None
    for _ in range(2):  # retry once if the JSON is broken
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(url, params={"key": config.GEMINI_API_KEY}, json=body)
        if r.status_code != 200:
            raise RuntimeError(f"Gemini API error {r.status_code}: {r.text[:300]}")
        try:
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
            return _extract_json(text)
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            last_error = exc
    raise RuntimeError(f"AI returned invalid JSON: {last_error}")


def _add_ids(data: dict) -> dict:
    for d in data.get("days", []):
        for a in d.get("activities", []):
            a["id"] = _new_id()
    if "activities" in data:  # single-day response
        for a in data["activities"]:
            a["id"] = _new_id()
    return data


def _use_mock() -> bool:
    return config.MOCK_AI or not config.GEMINI_API_KEY


# ---------------------------------------------------------------- public API
async def generate_itinerary(req: TripRequest) -> Itinerary:
    n = count_days(req)
    if _use_mock():
        return Itinerary(**_mock_itinerary(req, n))
    data = await _call_gemini(build_user_prompt(req, n))
    return Itinerary(**_add_ids(data))


async def regenerate_day(req: TripRequest, itin: Itinerary, day_number: int) -> Day:
    n = len(itin.days)
    if _use_mock():
        return Day(**_mock_day(req, day_number, shift=3))
    others = [a.title for d in itin.days if d.day != day_number for a in d.activities]
    data = await _call_gemini(build_day_prompt(req, day_number, n, others))
    data["day"] = day_number
    return Day(**_add_ids(data))


# --------------------------------------------------------------- mock (demo)
def _mock_day(req: TripRequest, day_no: int, shift: int = 0) -> dict:
    place = req.destination.title()
    people = max(req.group_size, 1)
    scale = {"low": 0.6, "medium": 1.0, "high": 1.8}.get(req.budget_level, 1.0)
    interests = req.interests or ["sightseeing", "food"]
    pick = lambda i: interests[(i + shift) % len(interests)]
    templates = [
        ("morning", "08:30 AM", f"Sunrise walk at a famous viewpoint in {place}",
         "Start early to beat the crowds and get the best light.", "nature", "2 hours", 0),
        ("morning", "10:30 AM", f"Guided {pick(day_no)} experience in {place}",
         "A local guide shows you the highlights of the area.", pick(day_no), "2 hours", 500),
        ("afternoon", "01:00 PM", f"Local lunch at a popular {place} restaurant",
         "Try the regional specialities recommended by locals.", "food", "1.5 hours", 400),
        ("afternoon", "03:30 PM", f"Visit the main landmark of {place}",
         "Take your time, click photos and read about its history.", "sightseeing", "2.5 hours", 300),
        ("evening", "07:30 PM", f"Street food and market stroll in {place}",
         "Easy, relaxed evening with snacks and shopping.", "shopping", "2 hours", 600),
    ]
    count = {"relaxed": 3, "balanced": 4, "packed": 5}.get(req.pace, 4)
    chosen = templates[:count] if count < 5 else templates
    acts = []
    for slot, t, title, desc, cat, dur, cost in chosen:
        acts.append({
            "id": _new_id(), "time_slot": slot, "time": t, "title": title,
            "description": desc, "category": cat, "duration": dur,
            "cost": round(cost * scale * people),
        })
    return {"day": day_no, "title": f"Day {day_no}: Exploring {place}", "activities": acts}


def _mock_itinerary(req: TripRequest, n: int) -> dict:
    place = req.destination.title()
    base = {"budget": 1200, "comfort": 3000, "premium": 8000}.get(req.stay_level, 3000)
    return {
        "summary": (f"A {n}-day {req.pace} trip to {place} for {req.group_size} "
                    f"traveller(s), focused on {', '.join(req.interests) or 'sightseeing and food'}. "
                    "(Sample itinerary: turn off MOCK_AI to get live AI plans.)"),
        "stays": [
            {"name": f"{place} Central Stay", "type": "Hotel", "price_per_night": base,
             "description": "Well located, close to main attractions."},
            {"name": f"The {place} Homestay", "type": "Homestay", "price_per_night": round(base * 0.7),
             "description": "Local hosts and home-cooked breakfast."},
        ],
        "transport": [
            f"Use local autos or app cabs inside {place}.",
            "Book long-distance trains or flights at least 2 weeks early for lower prices.",
        ],
        "tips": [
            "Carry some cash for small shops and street food.",
            "Start early each day to avoid crowds and heat.",
            "Keep a copy of your ID and bookings on your phone.",
        ],
        "days": [_mock_day(req, d) for d in range(1, n + 1)],
    }
