import { useState, useEffect, useRef, useCallback } from 'react'
import { reverseGeocode } from './routing.js'

/**
 * Custom React hook for continuous live GPS tracking.
 * Uses navigator.geolocation.watchPosition() for continuous updates.
 */
export function useLiveLocation() {
  const [isTracking, setIsTracking] = useState(false)
  const [liveLocation, setLiveLocation] = useState(null)
  const [error, setError] = useState(null)
  const watchIdRef = useRef(null)

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTracking(false)
    setLiveLocation(null)
  }, [])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }

    setError(null)
    setIsTracking(true)

    const handleSuccess = async (pos) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords

      // Speed in km/h if available, else 0
      const speedKmh = speed != null && !isNaN(speed) && speed > 0 ? Math.round(speed * 3.6) : 0

      setLiveLocation((prev) => {
        return {
          lat: latitude,
          lon: longitude,
          accuracy: accuracy || 0,
          heading: heading || 0,
          speedKmh,
          timestamp: pos.timestamp || Date.now(),
          name: prev?.name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        }
      })
    }

    const handleError = (err) => {
      console.warn('Live GPS watchPosition warning:', err.code, err.message)
      if (err.code === err.PERMISSION_DENIED) {
        setError('Location access denied. Please allow location permissions.')
        stopTracking()
      } else if (err.code === err.TIMEOUT) {
        setError('GPS signal searching…')
      }
    }

    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    })
  }, [stopTracking])

  const toggleTracking = useCallback(() => {
    if (isTracking) {
      stopTracking()
    } else {
      startTracking()
    }
  }, [isTracking, startTracking, stopTracking])

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return {
    isTracking,
    liveLocation,
    error,
    startTracking,
    stopTracking,
    toggleTracking,
  }
}
