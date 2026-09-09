import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000
const REVIEWS_FILE = path.join(__dirname, 'reviews.json')

app.use(cors())
app.use(express.json())

// Default seed reviews (Indian urban mobility routes)
const DEFAULT_REVIEWS = [
  {
    id: 'rev-1',
    author: 'Aarav Sharma',
    city: 'Mumbai',
    route: 'Bandra West ➔ BKC',
    rating: 5,
    vehicle: 'car',
    comment: 'The alternative corridor saved me 25 minutes during peak evening rush. Smooth bypass!',
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
  },
  {
    id: 'rev-2',
    author: 'Priya Iyer',
    city: 'Bengaluru',
    route: 'MG Road ➔ Koramangala',
    rating: 4,
    vehicle: 'bike',
    comment: 'Great suggestions for avoiding the congested junction bottlenecks.',
    createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
  },
  {
    id: 'rev-3',
    author: 'Vikram Mehta',
    city: 'Delhi',
    route: 'Connaught Place ➔ India Gate',
    rating: 5,
    vehicle: 'walking',
    comment: 'Accurate night safety hints and pleasant walking directions.',
    createdAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
  },
]

// Helper to load reviews from disk
function loadReviews() {
  try {
    if (fs.existsSync(REVIEWS_FILE)) {
      const data = fs.readFileSync(REVIEWS_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.warn('Could not read reviews file, using default seed:', err.message)
  }
  return [...DEFAULT_REVIEWS]
}

// Helper to save reviews to disk
function saveReviews(reviews) {
  try {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2), 'utf-8')
  } catch (err) {
    console.warn('Could not persist reviews file:', err.message)
  }
}

// In-memory reviews cache initialized from file
let reviewsStore = loadReviews()

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'FlowX Intelligent Mobility Backend Server',
    timestamp: new Date().toISOString(),
  })
})

// 2. Balanced Routing Traffic Distribution Endpoint
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

// 3. Community Reviews: Get All Reviews
app.get('/api/reviews', (req, res) => {
  res.json({
    success: true,
    count: reviewsStore.length,
    reviews: reviewsStore,
  })
})

// 4. Community Reviews: Submit a New Review
app.post('/api/reviews', (req, res) => {
  const { author, city, route, rating, vehicle, comment } = req.body

  if (!comment || typeof comment !== 'string' || comment.trim().length < 3) {
    return res.status(400).json({
      success: false,
      message: 'Review comment must be at least 3 characters.',
    })
  }

  const newReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author: (author && String(author).trim()) || 'Anonymous Traveler',
    city: (city && String(city).trim()) || 'India',
    route: (route && String(route).trim()) || 'Urban Corridor',
    rating: Math.min(5, Math.max(1, Number(rating) || 5)),
    vehicle: (vehicle && String(vehicle).trim()) || 'car',
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  }

  reviewsStore = [newReview, ...reviewsStore]
  saveReviews(reviewsStore)

  res.status(201).json({
    success: true,
    message: 'Review recorded successfully.',
    review: newReview,
  })
})

app.listen(PORT, () => {
  console.log(`🚀 FlowX Express API Server listening on port ${PORT}`)
})
