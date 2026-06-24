import { useState, useRef, useEffect, useCallback } from 'react'
import airports from './airports.json'

// Deduplicate by ICAO
const AIRPORTS = airports.filter(
  (a, i, arr) => arr.findIndex(b => b.icao === a.icao) === i
)

function score(airport, query) {
  const q = query.toUpperCase()
  const iata = airport.iata?.toUpperCase() ?? ''
  const icao = airport.icao.toUpperCase()
  const city = airport.city.toUpperCase()
  const name = airport.name.toUpperCase()

  if (iata === q || icao === q) return 100
  if (iata.startsWith(q) || icao.startsWith(q)) return 90
  if (city.startsWith(q)) return 70
  if (iata.includes(q) || icao.includes(q)) return 60
  if (city.includes(q) || name.includes(q)) return 40
  return 0
}

function search(query) {
  if (!query || query.length < 1) return []
  const results = AIRPORTS
    .map(a => ({ airport: a, s: score(a, query) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(x => x.airport)
  return results
}

export default function AirportSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const [selected, setSelected] = useState(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setResults(search(query))
    setHighlighted(0)
    setIsOpen(query.length > 0)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((airport) => {
    setSelected(airport)
    setQuery('')
    setIsOpen(false)
    onSelect(airport.icao)
  }, [onSelect])

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter' && query.trim().length >= 3) {
        // Free-text fallback: prepend K if 3 chars, use as-is if 4
        const raw = query.trim().toUpperCase()
        const icao = raw.length === 3 ? `K${raw}` : raw
        setSelected(null)
        setQuery('')
        setIsOpen(false)
        onSelect(icao)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[highlighted])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const displayValue = selected
    ? `${selected.iata ?? selected.icao} — ${selected.city}`
    : query

  return (
    <div className="airport-search" ref={containerRef}>
      <div className="search-input-wrap">
        <span className="search-icon">✈️</span>
        <input
          ref={inputRef}
          className="airport-input"
          type="text"
          value={displayValue}
          onChange={(e) => {
            // If an airport is currently selected, the input's DOM value still contains
            // the display label (e.g. "JFK — New York") when the first keypress fires —
            // React hasn't re-rendered to the empty string yet. Strip the stale prefix
            // so the user's new characters become a fresh query instead of being appended.
            if (selected) {
              const prefix = `${selected.iata ?? selected.icao} — ${selected.city}`
              const stripped = e.target.value.startsWith(prefix)
                ? e.target.value.slice(prefix.length)
                : e.target.value
              setSelected(null)
              setQuery(stripped)
            } else {
              setQuery(e.target.value)
            }
          }}
          onFocus={() => {
            if (selected) {
              setQuery('')
              setSelected(null)
            }
            if (query.length > 0) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search airport — JFK, London, Chicago…"
          autoComplete="off"
          spellCheck="false"
        />
        {(query || selected) && (
          <button
            className="clear-btn"
            onClick={() => { setQuery(''); setSelected(null); setIsOpen(false); inputRef.current?.focus() }}
            tabIndex={-1}
            aria-label="Clear"
          >×</button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className="dropdown" role="listbox">
          {results.map((airport, i) => (
            <li
              key={airport.icao}
              className={`dropdown-item${i === highlighted ? ' highlighted' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(airport) }}
              onMouseEnter={() => setHighlighted(i)}
              role="option"
              aria-selected={i === highlighted}
            >
              <span className="drop-codes">
                <span className="drop-iata">{airport.iata ?? airport.icao}</span>
                <span className="drop-icao">{airport.icao}</span>
              </span>
              <span className="drop-info">
                <span className="drop-name">{airport.name}</span>
                <span className="drop-city">
                  {airport.city}{airport.state ? `, ${airport.state}` : ''} · {airport.country}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="dropdown dropdown-empty">
          No airports found for "{query}"
        </div>
      )}
    </div>
  )
}
