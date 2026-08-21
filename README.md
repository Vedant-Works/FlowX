# FlowX 🚦

**Intelligent Urban Mobility & Traffic Distribution Platform**

> FlowX goes beyond traditional navigation — instead of always recommending the single fastest route, it intelligently distributes vehicles across multiple alternatives to actively reduce urban congestion.

---

## ✨ Features

| Status | Feature |
|--------|---------|
| ✅ | Trip planner — source, destination, vehicle type & preference |
| ✅ | Multi-stop waypoint support |
| ✅ | Interactive map — pan, zoom, OpenStreetMap + CARTO + Esri Satellite |
| ✅ | Map click context menu (set start/end from map) |
| ✅ | Current location via GPS |
| ✅ | Up to 5 alternative routes with corridor offset algorithm |
| ✅ | Route ranking by score (speed, safety, CO₂, weather, traffic) |
| ✅ | Live traffic — TomTom Flow API with urban peak-hour model fallback |
| ✅ | Real-time weather via Open-Meteo (no API key needed) |
| ✅ | Community-reported incidents |
| ✅ | Safer walking routes |
| ✅ | Balanced traffic distribution across routes |
| ✅ | Turn-by-turn navigation simulator (HUD) |
| ✅ | CO₂ emissions estimate per route |
| ✅ | Quick trips & search history |
| ✅ | Location autocomplete (Photon + Nominatim, India-scoped) |
| ✅ | Points of Interest (POI) discovery |
| ✅ | Map layer controls — satellite, hazards, alternative routes |
| ✅ | Express backend API server |

---

## 🛠️ Tech Stack

### Frontend
| Tech | Purpose |
|------|---------|
| React + Vite | UI framework & build tool |
| Leaflet | Interactive map rendering |
| OpenStreetMap / CARTO | Base map tiles |
| Esri Satellite | Satellite imagery tiles |

### Backend
| Tech | Purpose |
|------|---------|
| Node.js + Express | REST API server |
| CORS | Cross-origin request handling |

### External APIs
| API            | Purpose                     | FlowX Status                                           |
| -------------- | --------------------------- | ------------------------------------------------------ |
| OSRM           | Route calculation           | ✅ Free/open-source; public server has practical limits |
| Nominatim      | Geocoding/reverse geocoding | ⚠️ Free with strict usage policy                       |
| Photon         | Autocomplete                | ⚠️ Public service; use responsibly                     |
| Overpass       | POI discovery               | ⚠️ Public service; cache/reduce queries                |
| Open-Meteo     | Weather                     | ✅ Free for non-commercial use within limits            |
| TomTom Traffic | Live traffic                | ✅ Free tier/plan availability; key required            |

---

## ⚡ Quick Start

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd FlowX

# Install root dependencies (concurrently)
npm install

# Install frontend & backend dependencies
npm run install:all
```

### 2. Configure Environment

```bash
cp frontend/.env.example frontend/.env
```

Open `frontend/.env` and add your TomTom API key (optional — the app falls back to an urban flow model if not set):

```env
VITE_TOMTOM_API_KEY=your_tomtom_api_key_here
```

> **Get a free TomTom key:** https://developer.tomtom.com

### 3. Run the App

```bash
npm run dev
```

| Server | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:5000 |

---

## 🚀 Available Scripts

From the **project root:**

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend simultaneously |
| `npm run frontend` | Start frontend only |
| `npm run backend` | Start backend only |
| `npm run install:all` | Install all dependencies (frontend + backend) |
| `npm run build` | Build frontend for production |

From the **`frontend/`** directory:

```bash
npm run dev      # Dev server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
```

From the **`backend/`** directory:

```bash
npm start        # Start Express API server
```

---

## 🗂️ Project Structure

```
FlowX/
├── package.json                  ← Root: runs both servers via concurrently
├── README.md                     ← This file
├── PROJECT_CONTEXT.md            ← Vision & tech stack overview
│
├── backend/
│   ├── package.json              ← Express dependencies
│   ├── README.md                 ← Backend setup docs
│   └── server.js                 ← REST API (health, route balancing)
│
└── frontend/
    ├── index.html                ← HTML shell (loads React)
    ├── vite.config.js            ← Vite configuration
    ├── .env.example              ← Environment variable template
    ├── package.json              ← Frontend dependencies & scripts
    └── src/
        ├── main.jsx              ← Entry point (mounts React app)
        ├── App.jsx               ← Root layout — coordinates form & map
        ├── App.css               ← App-wide styles
        ├── index.css             ← Global styles (colors, fonts)
        ├── leafletSetup.js       ← Fixes Leaflet marker icons in Vite
        │
        ├── services/
        │   ├── routing.js        ← Geocoding pipeline + OSRM + distribution
        │   ├── routeRanking.js   ← Score & rank multiple routes
        │   ├── traffic.js        ← TomTom live traffic + peak-hour model fallback
        │   ├── weather.js        ← Open-Meteo weather integration
        │   ├── autocomplete.js   ← Typeahead suggestions (Photon + Nominatim)
        │   └── poi.js            ← Points of Interest discovery
        │
        ├── utils/
        │   └── routeColors.js    ← Route color palette
        │
        └── components/
            ├── Navbar.jsx / .css
            ├── TripPlanner.jsx / .css
            ├── FlowMap.jsx / .css
            ├── RouteList.jsx / .css
            ├── LocationInput.jsx / .css
            ├── WeatherWidget.jsx / .css
            ├── TrafficWidget.jsx / .css
            └── NavSimulatorHUD.jsx / .css
```

---

## 🔌 Backend API Reference

Base URL: `http://localhost:5000`

### `GET /api/health`
Returns server status.

```json
{
  "status": "ok",
  "app": "FlowX Intelligent Mobility Backend Server",
  "timestamp": "2026-08-21T17:00:00.000Z"
}
```

### `POST /api/routes/balance`
Computes optimal traffic distribution across routes.

**Request:**
```json
{
  "routes": [
    { "id": "route-1", "score": 85 },
    { "id": "route-2", "score": 60 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "congestionReductionPct": 22,
  "distribution": [
    { "routeId": "route-1", "percentage": 65 },
    { "routeId": "route-2", "percentage": 35 }
  ]
}
```

> A **30% flatten factor** prevents all traffic from being pushed to a single route, ensuring even the lower-ranked alternatives carry meaningful traffic load.

---

## 🧠 How It Works

### Geocoding Pipeline (6 Strategies)
Location resolution is tried in order until a result is found:
1. Pre-geocoded `{lat, lon, name}` object passthrough
2. Raw coordinate string parsing (`"19.07, 72.87"`)
3. Nominatim free-text search (India-scoped)
4. Nominatim structured city/street search
5. Photon (Komoot) worldwide fuzzy search
6. Overpass global name search fallback

### Multi-Route Generation
OSRM is queried for direct routes + 4 corridor offset waypoints (perpendicular offsets at 18% and 32%), yielding up to 5 distinct routes that are then deduplicated by distance/duration similarity.

### Traffic Analysis
Each route is sampled at 5 evenly spaced points. **TomTom Flow API** is used when a key is set; otherwise, an **urban peak-hour model** applies time-based congestion multipliers (morning rush 1.65×, evening rush 1.75×, midday 1.3×).

### Route Ranking
Routes are scored across: travel speed, traffic congestion, weather conditions, CO₂ emissions, and the user's selected preference (fastest / safest / eco).

---

## 🌱 Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `VITE_TOMTOM_API_KEY` | `frontend/.env` | TomTom Traffic Flow API key (optional) |
| `PORT` | Backend environment | Express server port (default: `5000`) |

---

## 📄 License

Built for a hackathon. Free to use and extend.
