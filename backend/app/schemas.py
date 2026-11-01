"""Pydantic models = the shape of data going in and out of the API."""
from typing import List
from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    destination: str = Field(..., min_length=2)
    start_date: str            # "YYYY-MM-DD"
    end_date: str              # "YYYY-MM-DD"
    budget_level: str = "medium"       # low | medium | high
    budget_amount: float = 20000       # total budget in INR
    travel_type: str = "solo"          # solo | couple | group
    group_size: int = Field(1, ge=1, le=30)
    pace: str = "balanced"             # relaxed | balanced | packed
    interests: List[str] = []
    stay_level: str = "comfort"        # budget | comfort | premium
    notes: str = ""


class Activity(BaseModel):
    id: str
    time_slot: str             # morning | afternoon | evening
    time: str                  # e.g. "09:00 AM"
    title: str
    description: str = ""
    category: str = "sightseeing"
    duration: str = ""
    cost: float = 0


class Day(BaseModel):
    day: int
    title: str
    activities: List[Activity]


class Stay(BaseModel):
    name: str
    type: str = "Hotel"
    price_per_night: float = 0
    description: str = ""


class Itinerary(BaseModel):
    summary: str
    stays: List[Stay] = []
    transport: List[str] = []
    tips: List[str] = []
    days: List[Day]


class Trip(BaseModel):
    id: str
    created_at: str
    request: TripRequest
    itinerary: Itinerary
    total_cost: float = 0


class ItineraryUpdate(BaseModel):
    itinerary: Itinerary
