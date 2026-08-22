import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="FlowX Intelligent Mobility Backend",
    description="Traffic distribution and intelligent routing API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RouteItem(BaseModel):
    id: Optional[str] = None
    label: Optional[str] = None
    score: Optional[float] = 50.0
    duration: Optional[float] = None
    distance: Optional[float] = None

class BalanceRequest(BaseModel):
    routes: List[Dict[str, Any]]

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "app": "FlowX Intelligent Mobility FastAPI Server",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.post("/api/routes/balance")
def balance_routes(payload: BalanceRequest):
    routes = payload.routes
    if not routes or len(routes) == 0:
        raise HTTPException(status_code=400, detail="Array of routes required.")

    total_score = sum(r.get("score", 50.0) for r in routes)
    num_routes = len(routes)
    equal_share = 1.0 / num_routes
    flatten_factor = 0.3

    distributions = []
    for r in routes:
        score = r.get("score", 50.0)
        raw_pct = score / total_score if total_score > 0 else equal_share
        adjusted_pct = raw_pct * (1 - flatten_factor) + equal_share * flatten_factor
        distributions.append(round(adjusted_pct * 100))

    # Normalize to 100%
    total_dist = sum(distributions)
    if total_dist != 100:
        distributions[0] += (100 - total_dist)

    distribution_result = []
    for idx, pct in enumerate(distributions):
        r_id = routes[idx].get("id", f"route-{idx + 1}")
        distribution_result.append({
            "routeId": r_id,
            "percentage": pct
        })

    congestion_reduction = round((100 - distributions[0]) * 0.55)

    return {
        "success": True,
        "congestionReductionPct": congestion_reduction,
        "distribution": distribution_result
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
