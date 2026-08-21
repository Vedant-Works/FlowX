import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// In-memory incidents database store
let incidentsStore = [
  {
    id: 'inc-demo-1',
    type: 'accident',
    severity: 'high',
    lat: 19.0596,
    lon: 72.8295,
    description: 'Minor collision reported on Western Express Highway',
    timestamp: Date.now() - 15 * 60 * 1000,
  },
  {
    id: 'inc-demo-2',
    type: 'construction',
    severity: 'medium',
    lat: 19.0178,
    lon: 72.8478,
    description: 'Road work near Dadar TT Circle',
    timestamp: Date.now() - 45 * 60 * 1000,
  },
]

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FlowX Intelligent Mobility Backend Server',
    timestamp: new Date().toISOString(),
  })
})

// Incident Reports Endpoints
app.get('/api/incidents', (req, res) => {
  res.json({
    success: true,
    count: incidentsStore.length,
    incidents: incidentsStore,
  })
})

app.post('/api/incidents', (req, res) => {
  const { type, severity, lat, lon, description } = req.body

  if (!type || !lat || !lon) {
    return res.status(400).json({
      success: false,
      message: 'Type, latitude, and longitude are required.',
    })
  }

  const newIncident = {
    id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: type || 'hazard',
    severity: severity || 'medium',
    lat: Number(lat),
    lon: Number(lon),
    description: description || 'Community reported incident',
    timestamp: Date.now(),
  }

  incidentsStore.push(newIncident)

  res.status(201).json({
    success: true,
    message: 'Incident reported successfully',
    incident: newIncident,
  })
})

// Balanced Routing Endpoint
app.post('/api/routes/balance', (req, res) => {
  const { routes } = req.body

  if (!routes || !Array.isArray(routes) || routes.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Array of routes required.',
    })
  }

  const totalScore = routes.reduce((sum, r) => sum + (r.score || 50), 0)
  const numRoutes = routes.length
  const equalShare = 1 / numRoutes
  const flattenFactor = 0.3

  const distributions = routes.map((r, idx) => {
    const rawPct = (r.score || 50) / totalScore
    const adjustedPct = rawPct * (1 - flattenFactor) + equalShare * flattenFactor
    return Math.round(adjustedPct * 100)
  })

  // Normalize to 100
  const sum = distributions.reduce((a, b) => a + b, 0)
  if (sum !== 100) {
    distributions[0] += 100 - sum
  }

  res.json({
    success: true,
    congestionReductionPct: Math.round((100 - distributions[0]) * 0.55),
    distribution: distributions.map((pct, idx) => ({
      routeId: routes[idx].id || `route-${idx + 1}`,
      percentage: pct,
    })),
  })
})

app.listen(PORT, () => {
  console.log(`🚀 FlowX Express API Server listening on port ${PORT}`)
})
