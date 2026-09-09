import { useState, useEffect } from 'react'
import './CommunityReviewsModal.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

const VEHICLE_OPTIONS = [
  { value: 'car', label: '🚗 Four-Wheeler' },
  { value: 'bike', label: '🛵 Two-Wheeler' },
  { value: 'walking', label: '🚶 Walking' },
]

function CommunityReviewsModal({ isOpen, onClose }) {
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState(null)

  // Form State
  const [author, setAuthor] = useState('')
  const [city, setCity] = useState('')
  const [route, setRoute] = useState('')
  const [rating, setRating] = useState(5)
  const [vehicle, setVehicle] = useState('car')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!isOpen) return

    async function loadReviews() {
      setIsLoading(true)
      setError(null)
      try {
        const res = await fetch(`${BACKEND_URL}/api/reviews`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && Array.isArray(data.reviews)) {
            setReviews(data.reviews)
          }
        }
      } catch (err) {
        console.warn('Could not connect to FlowX backend reviews:', err.message)
      } finally {
        setIsLoading(false)
      }
    }

    loadReviews()
  }, [isOpen])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!comment.trim()) return

    setIsSubmitting(true)
    setError(null)

    const payload = {
      author: author.trim() || 'Anonymous Traveler',
      city: city.trim() || 'India',
      route: route.trim() || 'Urban Route',
      rating,
      vehicle,
      comment: comment.trim(),
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success && data.review) {
          setReviews((prev) => [data.review, ...prev])
          setSubmitSuccess(true)
          setComment('')
          setTimeout(() => setSubmitSuccess(false), 3500)
        }
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to submit review.')
      }
    } catch {
      // Local fallback in case backend is offline
      const localRev = {
        id: `local-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
      }
      setReviews((prev) => [localRev, ...prev])
      setSubmitSuccess(true)
      setComment('')
      setTimeout(() => setSubmitSuccess(false), 3500)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="reviews-modal-backdrop" onClick={onClose}>
      <div className="reviews-modal-container animate-fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="reviews-modal-header">
          <div className="reviews-title-row">
            <span className="reviews-icon">💬</span>
            <div>
              <h3 className="reviews-modal-title">Community Route Reviews</h3>
              <p className="reviews-modal-sub">Insights and feedback from Indian city commuters</p>
            </div>
          </div>
          <button type="button" className="reviews-close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Submit Review Form */}
        <form className="submit-review-form" onSubmit={handleSubmit}>
          <h4 className="form-section-title">Share Your Route Experience</h4>

          <div className="form-grid">
            <input
              type="text"
              placeholder="Your Name (optional)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="review-input"
            />
            <input
              type="text"
              placeholder="City (e.g. Mumbai, Delhi, Bengaluru)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="review-input"
            />
          </div>

          <div className="form-grid">
            <input
              type="text"
              placeholder="Route / Corridor (e.g. Bandra to BKC)"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="review-input"
            />
            <div className="form-select-group">
              <select
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                className="review-select"
              >
                {VEHICLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="review-select"
              >
                <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                <option value={3}>⭐⭐⭐ (3/5)</option>
                <option value={2}>⭐⭐ (2/5)</option>
                <option value={1}>⭐ (1/5)</option>
              </select>
            </div>
          </div>

          <textarea
            placeholder="How was the traffic, road quality, or alternative route? (min 3 chars)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="review-textarea"
            rows={2}
            required
          />

          <div className="review-submit-row">
            {submitSuccess && (
              <span className="review-success-msg">✓ Thank you! Review published.</span>
            )}
            {error && <span className="review-error-msg">⚠️ {error}</span>}
            <button type="submit" className="review-submit-btn" disabled={isSubmitting || !comment.trim()}>
              {isSubmitting ? 'Posting…' : 'Post Review'}
            </button>
          </div>
        </form>

        {/* Existing Reviews List */}
        <div className="reviews-list-section">
          <h4 className="form-section-title">Recent Feedback ({reviews.length})</h4>

          {isLoading ? (
            <div className="reviews-loading">Loading community reviews…</div>
          ) : reviews.length === 0 ? (
            <div className="reviews-empty">No reviews yet. Be the first to share!</div>
          ) : (
            <div className="reviews-cards-scroll">
              {reviews.map((rev) => (
                <div key={rev.id} className="community-review-card">
                  <div className="rev-card-top">
                    <div className="rev-author-info">
                      <span className="rev-author-name">{rev.author}</span>
                      <span className="rev-badge-city">{rev.city}</span>
                      {rev.vehicle && (
                        <span className="rev-badge-vehicle">
                          {rev.vehicle === 'car' ? '🚗 Four-Wheeler' : rev.vehicle === 'bike' ? '🛵 Two-Wheeler' : '🚶 Walking'}
                        </span>
                      )}
                    </div>
                    <span className="rev-stars">{'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}</span>
                  </div>

                  {rev.route && <div className="rev-route-tag">📍 {rev.route}</div>}
                  <p className="rev-comment">{rev.comment}</p>
                  <span className="rev-time">
                    {new Date(rev.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommunityReviewsModal
