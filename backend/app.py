import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

PORT = int(os.environ.get("PORT", 5000))

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "app": "FlowX Intelligent Mobility Python Backend",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })

@app.route('/api/routes/balance', methods=['POST'])
def balance_routes():
    data = request.get_json() or {}
    routes = data.get('routes', [])

    if not routes or not isinstance(routes, list) or len(routes) == 0:
        return jsonify({
            "success": False,
            "message": "Array of routes required."
        }), 400

    total_score = sum(r.get('score', 50) for r in routes)
    num_routes = len(routes)
    equal_share = 1.0 / num_routes
    flatten_factor = 0.3

    distributions = []
    for r in routes:
        score = r.get('score', 50)
        raw_pct = score / total_score if total_score > 0 else equal_share
        adjusted_pct = raw_pct * (1 - flatten_factor) + equal_share * flatten_factor
        distributions.append(round(adjusted_pct * 100))

    # Normalize to 100%
    total_dist = sum(distributions)
    if total_dist != 100:
        distributions[0] += (100 - total_dist)

    distribution_result = []
    for idx, pct in enumerate(distributions):
        r_id = routes[idx].get('id', f"route-{idx + 1}")
        distribution_result.append({
            "routeId": r_id,
            "percentage": pct
        })

    congestion_reduction = round((100 - distributions[0]) * 0.55)

    return jsonify({
        "success": True,
        "congestionReductionPct": congestion_reduction,
        "distribution": distribution_result
    })

if __name__ == '__main__':
    print(f"🚀 FlowX Python API Server listening on port {PORT}")
    app.run(host='0.0.0.0', port=PORT)
