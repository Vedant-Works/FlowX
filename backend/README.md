# FlowX Backend API Server

Express REST API server for the FlowX Intelligent Urban Mobility Platform.

## Features

- **Health Check (`GET /api/health`)**: API status monitor.
- **Incident Store (`GET /api/incidents`, `POST /api/incidents`)**: REST endpoints for community hazard reports.
- **Balanced Routing (`POST /api/routes/balance`)**: Server-side route scoring & traffic load distribution algorithm.

## How to run

1. Open a terminal in the `backend` folder:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the API server:

   ```bash
   npm start
   ```

   The server will start on `http://localhost:5000`.
