"""FastAPI app: all API endpoints live here."""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import ai_service, config, storage
from .schemas import Itinerary, ItineraryUpdate, Trip, TripRequest

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("planner")

app = FastAPI(title="Personalized Travel Itinerary Planner", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[config.FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def total_cost(itin: Itinerary, req: TripRequest) -> float:
    """Activities cost + cheapest stay for each night."""
    activities = sum(a.cost for d in itin.days for a in d.activities)
    nights = max(len(itin.days) - 1, 1)
    stay = min((s.price_per_night for s in itin.stays), default=0) * nights
    return round(activities + stay)


async def _load(trip_id: str) -> dict:
    trip = await storage.get_trip(trip_id)
    if not trip:
        raise HTTPException(404, "Trip not found")
    return trip


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ai_mode": "mock" if (config.MOCK_AI or not config.GEMINI_API_KEY) else "gemini",
        "storage": "supabase" if (config.SUPABASE_URL and config.SUPABASE_KEY) else "local-file",
    }


@app.post("/api/trips/generate", response_model=Trip)
async def generate_trip(req: TripRequest):
    try:
        itin = await ai_service.generate_itinerary(req)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        log.exception("AI generation failed")
        raise HTTPException(502, f"AI service failed: {e}")
    trip = Trip(
        id=uuid.uuid4().hex[:10],
        created_at=datetime.now(timezone.utc).isoformat(),
        request=req,
        itinerary=itin,
        total_cost=total_cost(itin, req),
    )
    await storage.save_trip(trip.model_dump())
    return trip


@app.get("/api/trips")
async def list_trips():
    return await storage.list_trips()


@app.get("/api/trips/{trip_id}", response_model=Trip)
async def get_trip(trip_id: str):
    return await _load(trip_id)


@app.put("/api/trips/{trip_id}", response_model=Trip)
async def update_trip(trip_id: str, body: ItineraryUpdate):
    trip = Trip(**await _load(trip_id))
    trip.itinerary = body.itinerary
    trip.total_cost = total_cost(trip.itinerary, trip.request)
    await storage.save_trip(trip.model_dump())
    return trip


@app.delete("/api/trips/{trip_id}")
async def delete_trip(trip_id: str):
    await storage.delete_trip(trip_id)
    return {"deleted": trip_id}


@app.post("/api/trips/{trip_id}/regenerate-day/{day_number}", response_model=Trip)
async def regenerate_day(trip_id: str, day_number: int):
    trip = Trip(**await _load(trip_id))
    if not any(d.day == day_number for d in trip.itinerary.days):
        raise HTTPException(404, "Day not found")
    try:
        new_day = await ai_service.regenerate_day(trip.request, trip.itinerary, day_number)
    except Exception as e:
        log.exception("Day regeneration failed")
        raise HTTPException(502, f"AI service failed: {e}")
    trip.itinerary.days = [new_day if d.day == day_number else d for d in trip.itinerary.days]
    trip.total_cost = total_cost(trip.itinerary, trip.request)
    await storage.save_trip(trip.model_dump())
    return trip


@app.post("/api/trips/{trip_id}/regenerate", response_model=Trip)
async def regenerate_trip(trip_id: str):
    trip = Trip(**await _load(trip_id))
    try:
        trip.itinerary = await ai_service.generate_itinerary(trip.request)
    except Exception as e:
        log.exception("Regeneration failed")
        raise HTTPException(502, f"AI service failed: {e}")
    trip.total_cost = total_cost(trip.itinerary, trip.request)
    await storage.save_trip(trip.model_dump())
    return trip
