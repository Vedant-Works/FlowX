import { useState, useEffect, useRef } from 'react'
import { fetchSuggestions } from '../services/autocomplete'
import './LocationInput.css'

const PLACE_ICONS = {
  shop: '🛍️',
  supermarket: '🛒',
  convenience: '🏪',
  park: '🌳',
  garden: '🌿',
  monument: '🏛️',
  tourism: '🏰',
  attraction: '🗺️',
  hotel: '🏨',
  guest_house: '🏨',
  restaurant: '☕',
  cafe: '☕',
  bus_station: '🚌',
  station: '🚆',
  railway: '🚆',
  aeroway: '✈️',
  airport: '✈️',
  hospital: '🏥',
  pharmacy: '💊',
  school: '🎓',
  university: '🎓',
  fuel: '⛽',
}

function getPlaceIcon(type) {
  if (!type) return '📍'
  const lower = type.toLowerCase()
  for (const [key, icon] of Object.entries(PLACE_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return '📍'
}

function LocationInput({
  id,
  placeholder,
  value,
  onChange,
  onSelectLocation,
  iconClass,
  required = false,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const wrapperRef = useRef(null)
  const debounceTimerRef = useRef(null)

  // Fetch suggestions with 220ms debounce
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([])
      setIsOpen(false)
      setIsLoading(false)
      return
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsLoading(true)
      const results = await fetchSuggestions(value)
      setSuggestions(results)
      setIsOpen(results.length > 0)
      setIsLoading(false)
      setSelectedIndex(-1)
    }, 220)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(item) {
    onSelectLocation?.({
      lat: item.lat,
      lon: item.lon,
      name: item.fullName || `${item.name}, ${item.description}`,
    })
    onChange(item.name)
    setIsOpen(false)
    setSuggestions([])
  }

  function handleKeyDown(e) {
    if (!isOpen || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault()
      handleSelect(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="location-input-wrapper" ref={wrapperRef}>
      <div className="input-with-icon">
        <span className={`input-icon ${iconClass || ''}`}></span>
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          required={required}
          autoComplete="off"
        />
        {isLoading && <span className="autocomplete-spinner" />}
      </div>

      {/* Dropdown Suggestions Menu */}
      {isOpen && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown animate-fade-in" role="listbox">
          {suggestions.map((item, idx) => (
            <li
              key={`${item.lat}-${item.lon}-${idx}`}
              className={`autocomplete-item ${idx === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSelect(item)}
              role="option"
              aria-selected={idx === selectedIndex}
            >
              <span className="item-icon">{getPlaceIcon(item.type)}</span>
              <div className="item-details">
                <span className="item-title">{item.name}</span>
                {item.description && (
                  <span className="item-sub">{item.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default LocationInput
