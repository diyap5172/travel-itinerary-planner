# Wayfare - Personalized Travel Itinerary Planner

An AI-powered full-stack web app that generates personalized day-by-day travel itineraries from a user's destination, dates, budget, travel style and interests. Built for the SkillWallet project.

## Features
- Smart trip builder (destination, dates, budget, solo/couple/group, pace, stay level, interests)
- AI-generated itinerary: attractions, food, stays, transport, tips, and per-day / total cost
- Interactive itinerary view with day tabs and a budget check
- Edit, add or remove activities; regenerate a single day or the whole trip
- Dashboard with stats, search and delete
- Download as PDF (browser print), copy shareable link, dark mode
- Works without an API key using sample data (`MOCK_AI=true`)

## Tech stack
| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router, plain CSS |
| Backend | Python, FastAPI, Pydantic |
| Database | Supabase (PostgreSQL), falls back to a local JSON file |
| AI | Google Gemini API with prompt engineering and JSON-only output |

## Architecture
```
React (Vite)  --HTTP/JSON-->  FastAPI  --->  Gemini API  (itinerary JSON)
                                  |
                                  +------->  Supabase (trips table) or local JSON
```

## Folder structure
```
backend/app/    main.py (endpoints)  ai_service.py  prompts.py  storage.py  schemas.py  config.py
frontend/src/   App.jsx  api.js  pages/ (Dashboard, NewTrip, TripView)  styles.css
database/       schema.sql
```

## Run locally

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows   (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env         # Mac/Linux: cp .env.example .env
uvicorn app.main:app --reload --port 8000
```
Open http://localhost:8000/docs to see the API.

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

### 3. Turn on real AI (optional)
In `backend/.env` set `GEMINI_API_KEY=your_key` and `MOCK_AI=false`, then restart the backend.

### 4. Turn on Supabase (optional)
Run `database/schema.sql` in the Supabase SQL Editor, then put `SUPABASE_URL` and `SUPABASE_KEY` in `backend/.env`.

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | Status, AI mode, storage mode |
| POST | /api/trips/generate | Generate and save a trip |
| GET | /api/trips | List trips |
| GET | /api/trips/{id} | Get one trip |
| PUT | /api/trips/{id} | Save edited itinerary |
| DELETE | /api/trips/{id} | Delete a trip |
| POST | /api/trips/{id}/regenerate-day/{n} | Regenerate one day |
| POST | /api/trips/{id}/regenerate | Regenerate whole trip |

## Prompt engineering
`backend/app/prompts.py` holds a system prompt that fixes the role, the rules (real places only, budget in INR, grouped nearby places, pace-aware), and the exact JSON schema. The backend asks Gemini for JSON, strips code fences, retries once on bad JSON, and validates the result with Pydantic.

## Future scope
User login with Supabase Auth, real shared group trips, maps, weather and live price APIs.
