# FlowX

**Intelligent Urban Mobility & Traffic Distribution Platform**

FlowX analyzes multiple routes and intelligently distributes vehicles across them to reduce overall traffic congestion — unlike traditional navigation apps that only recommend the fastest route.

## Features

| Status | Feature |
|--------|---------|
| ✅ Done | Trip planner UI (source, destination, vehicle, preference) |
| ✅ Done | Interactive map (pan, zoom, OpenStreetMap, satellite view) |
| ✅ Done | Basic routing (geocode + draw route on map) |
| ✅ Done | Multiple routes + ranking |
| ✅ Done | Live traffic conditions |
| ✅ Done | Weather information |
| ✅ Done | Community-reported incidents |
| ✅ Done | Safer walking routes |
| ✅ Done | Balanced routing distribution |
| ✅ Done | Turn-by-turn navigation simulator |
| ✅ Done | Multi-stop waypoints |
| ✅ Done | Current location (GPS) |
| ✅ Done | Map click context menu |
| ✅ Done | Quick trips & search history |
| ✅ Done | Map layer controls (satellite, hazards, alternatives) |
| ✅ Done | Express backend API server |

## Tech stack

- **Frontend:** React + Vite
- **Map:** Leaflet + OpenStreetMap (CARTO tiles) + Esri Satellite tiles
- **Routing:** OSRM (Open Source Routing Machine)
- **Weather:** Open-Meteo API (free, no key)
- **Backend:** Node.js + Express

## How to run

### Option 1: Run both frontend & backend simultaneously (recommended)

From the project root directory:

```bash
npm install           # install concurrently (first time only)
npm run install:all   # install frontend & backend deps (first time only)
npm run dev           # starts both servers at once
```

This launches:
- **Frontend** → `http://localhost:5173`
- **Backend API** → `http://localhost:5000`

### Option 2: Run individually

**Frontend only:**
```bash
cd frontend
npm install
npm run dev
```

**Backend only:**
```bash
cd backend
npm install
npm start
```

## Project structure

```
FlowX/
├── package.json              ← Root: runs both servers via concurrently
├── README.md                 ← This file
├── PROJECT_CONTEXT.md        ← Vision & tech stack overview
├── backend/
│   ├── package.json          ← Express dependencies
│   ├── README.md             ← Backend setup docs
│   └── server.js             ← REST API (incidents, route balancing, health)
└── frontend/
    ├── index.html            ← HTML shell (loads React)
    ├── package.json          ← Frontend dependencies & scripts
    └── src/
        ├── main.jsx          ← Entry point (mounts React app)
        ├── App.jsx           ← Root layout + coordinates form & map
        ├── App.css           ← App-wide styles
        ├── index.css         ← Global styles (colors, fonts)
        ├── leafletSetup.js   ← Fixes Leaflet marker icons in Vite
        ├── services/
        │   ├── routing.js        ← Geocoding + OSRM + distribution
        │   ├── routeRanking.js   ← Score & rank multiple routes
        │   ├── traffic.js        ← Live traffic congestion engine
        │   ├── weather.js        ← Open-Meteo weather integration
        │   └── incidents.js      ← Community incident reports
        ├── utils/
        │   └── routeColors.js    ← Route color palette
        └── components/
            ├── Navbar.jsx / .css
            ├── TripPlanner.jsx / .css
            ├── FlowMap.jsx / .css
            ├── RouteList.jsx / .css
            ├── WeatherWidget.jsx / .css
            ├── TrafficWidget.jsx / .css
            ├── IncidentReporter.jsx / .css
            ├── BalancedRoutingBanner.jsx / .css
            └── NavSimulatorHUD.jsx / .css
```
