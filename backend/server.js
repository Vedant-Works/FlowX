import express from 'express'
import cors from 'cors'

const app = express()
const PORT = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FlowX Intelligent Mobility Backend Server',
    timestamp: new Date().toISOString(),
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
