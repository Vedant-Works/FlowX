import { useState, useEffect } from 'react'
import {
  getIncidents,
  fetchIncidentsFromApi,
  addIncident,
  removeIncident,
  INCIDENT_TYPES,
  SEVERITY_OPTIONS,
  getIncidentTypeInfo,
  formatTimeAgo,
} from '../services/incidents'
import './IncidentReporter.css'

function IncidentReporter({ onIncidentsChange, mapCenter }) {
  const [incidents, setIncidents] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState({
    type: 'accident',
    severity: 'medium',
    locationName: '',
    description: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null)

  // Load incidents on mount and refresh every 30s
  useEffect(() => {
    loadIncidents()
    const interval = setInterval(loadIncidents, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadIncidents() {
    const active = await fetchIncidentsFromApi()
    setIncidents(active)
    onIncidentsChange?.(active)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!formData.locationName.trim()) return

    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      // Geocode the location name
      const params = new URLSearchParams({
        q: formData.locationName.trim(),
        format: 'json',
        limit: '1',
      })

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'FlowX-Hackathon/1.0',
          },
        }
      )

      if (!response.ok) throw new Error('Geocoding failed')
      const results = await response.json()

      if (!results.length) {
        setSubmitStatus({ type: 'error', message: `Could not find "${formData.locationName}"` })
        setIsSubmitting(false)
        return
      }

      const place = results[0]

      await addIncident({
        type: formData.type,
        severity: formData.severity,
        lat: Number(place.lat),
        lon: Number(place.lon),
        description:
          formData.description.trim() ||
          `${getIncidentTypeInfo(formData.type).label} reported near ${place.display_name.split(',')[0]}`,
      })

      await loadIncidents()
      setSubmitStatus({ type: 'success', message: 'Incident reported successfully!' })
      setFormData({ type: 'accident', severity: 'medium', locationName: '', description: '' })

      // Auto-close form after success
      setTimeout(() => {
        setIsFormOpen(false)
        setSubmitStatus(null)
      }, 1500)
    } catch (err) {
      setSubmitStatus({ type: 'error', message: err.message || 'Failed to report incident' })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleRemoveIncident(id) {
    removeIncident(id)
    loadIncidents()
  }

  return (
    <div className="incident-reporter-card animate-fade-in">
      <div className="incident-header">
        <div className="incident-header-left">
          <span className="incident-header-icon">🚨</span>
          <div>
            <h3 className="incident-title">Community Reports</h3>
            <p className="incident-subtitle">
              {incidents.length > 0
                ? `${incidents.length} active report${incidents.length > 1 ? 's' : ''}`
                : 'No active reports'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className={`report-toggle-btn ${isFormOpen ? 'active' : ''}`}
          onClick={() => {
            setIsFormOpen((prev) => !prev)
            setSubmitStatus(null)
          }}
          title={isFormOpen ? 'Close report form' : 'Report an incident'}
        >
          {isFormOpen ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          <span>{isFormOpen ? 'Cancel' : 'Report'}</span>
        </button>
      </div>

      {/* Report Form */}
      {isFormOpen && (
        <form className="incident-form animate-fade-in" onSubmit={handleSubmit}>
          <div className="incident-type-grid">
            {INCIDENT_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className={`type-chip ${formData.type === type.value ? 'selected' : ''}`}
                onClick={() => setFormData((prev) => ({ ...prev, type: type.value }))}
              >
                <span className="type-chip-icon">{type.icon}</span>
                <span className="type-chip-label">{type.label}</span>
              </button>
            ))}
          </div>

          <div className="severity-selector">
            <label className="form-field-label">Severity</label>
            <div className="severity-options">
              {SEVERITY_OPTIONS.map((sev) => (
                <button
                  key={sev.value}
                  type="button"
                  className={`severity-chip ${formData.severity === sev.value ? 'selected' : ''}`}
                  style={{
                    '--sev-color': sev.color,
                    '--sev-bg': `${sev.color}22`,
                  }}
                  onClick={() => setFormData((prev) => ({ ...prev, severity: sev.value }))}
                >
                  <span
                    className="severity-dot"
                    style={{ backgroundColor: sev.color }}
                  />
                  {sev.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="inc-location">
              Location
            </label>
            <input
              id="inc-location"
              type="text"
              placeholder="e.g. Andheri Station, Mumbai"
              value={formData.locationName}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, locationName: e.target.value }))
              }
              required
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="inc-desc">
              Description <span className="optional-tag">(optional)</span>
            </label>
            <input
              id="inc-desc"
              type="text"
              placeholder="Brief description of the incident"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <button
            type="submit"
            className="submit-incident-btn"
            disabled={isSubmitting || !formData.locationName.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="btn-spinner" />
                Reporting…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                </svg>
                Submit Report
              </>
            )}
          </button>

          {submitStatus && (
            <div className={`submit-status ${submitStatus.type}`}>
              {submitStatus.type === 'success' ? '✅' : '❌'} {submitStatus.message}
            </div>
          )}
        </form>
      )}

      {/* Active Reports List */}
      {incidents.length > 0 && (
        <div className="active-incidents-list">
          {incidents.map((inc) => {
            const typeInfo = getIncidentTypeInfo(inc.type)
            const sevInfo = SEVERITY_OPTIONS.find((s) => s.value === inc.severity)

            return (
              <div key={inc.id} className="incident-item">
                <span className="incident-item-icon">{typeInfo.icon}</span>
                <div className="incident-item-info">
                  <div className="incident-item-top">
                    <span className="incident-item-type">{typeInfo.label}</span>
                    <span
                      className="incident-item-sev"
                      style={{ color: sevInfo?.color || '#f59e0b' }}
                    >
                      ● {inc.severity}
                    </span>
                  </div>
                  <span className="incident-item-desc">
                    {inc.description || 'No description'}
                  </span>
                  <span className="incident-item-time">{formatTimeAgo(inc.timestamp)}</span>
                </div>
                <button
                  type="button"
                  className="incident-remove-btn"
                  onClick={() => handleRemoveIncident(inc.id)}
                  title="Remove this report"
                  aria-label="Remove incident"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default IncidentReporter
