import { useState, useCallback, useEffect } from 'react'
import { parseMetar, getWeatherEmoji } from './metarParser'
import AirportSearch from './AirportSearch'
import airports from './airports.json'
import './App.css'

// Pre-build a lookup map so WeatherDisplay can resolve ICAO → airport info in O(1)
const AIRPORT_MAP = Object.fromEntries(airports.map(a => [a.icao, a]))

/**
 * Great-circle distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's mean radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Finds the closest airport in our dataset to the given coordinates.
 * Airports without lat/lon are skipped.
 */
function nearestAirport(lat, lon) {
  let best = null, bestDist = Infinity
  for (const a of airports) {
    if (a.lat == null || a.lon == null) continue
    const d = haversineKm(lat, lon, a.lat, a.lon)
    if (d < bestDist) { bestDist = d; best = a }
  }
  return best
}

/**
 * Resolves the user's approximate location via IP geolocation (ipinfo.io),
 * then returns the nearest airport from our dataset.
 * Returns null if the request fails or location is unavailable.
 */
async function detectNearestAirport() {
  const res = await fetch('https://ipinfo.io/json')
  if (!res.ok) return null
  const data = await res.json()
  if (!data.loc) return null
  const [lat, lon] = data.loc.split(',').map(Number)
  return nearestAirport(lat, lon)
}

/**
 * Displays a circular compass rose with an arrow pointing toward the
 * direction the wind is coming FROM (meteorological convention).
 * The CSS arrow starts pointing North (0°) and rotates clockwise.
 */
function WindCompass({ degrees }) {
  if (degrees == null) return null
  return (
    <div className="compass-wrap">
      <div className="compass">
        <span className="compass-n">N</span>
        <span className="compass-e">E</span>
        <span className="compass-s">S</span>
        <span className="compass-w">W</span>
        <div
          className="compass-arrow"
          style={{ transform: `rotate(${degrees}deg)` }}
          title={`Wind from ${degrees}°`}
        />
      </div>
    </div>
  )
}

/** A small tile showing a single weather measurement (temperature, humidity, etc.) */
function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

/**
 * Renders the full decoded weather report for one airport.
 *
 * @param {object} parsed - Output of parseMetar()
 */
function WeatherDisplay({ parsed }) {
  const emoji = getWeatherEmoji(parsed)
  const cat = parsed.flightCategory
  // Look up human-readable airport details from our local dataset
  const airportInfo = AIRPORT_MAP[parsed.station]

  // If there are no active weather phenomena, fall back to the sky condition
  // summary. If that's also absent, label the sky as clear.
  const skySummary = parsed.skyConditions.length
    ? parsed.skyConditions.join('; ')
    : parsed.weather.length ? null : 'Clear skies'

  const conditions = [
    ...parsed.weather,
    ...(skySummary ? [skySummary] : []),
  ]

  return (
    <div className="weather-card">
      <div className="weather-header">
        <div className="weather-emoji">{emoji}</div>
        <div className="weather-station">
          <h2>{parsed.station}</h2>
          {/* Show the full airport name when it exists in our local dataset */}
          {airportInfo && (
            <p className="airport-name">
              {airportInfo.name}
              {airportInfo.city ? ` · ${airportInfo.city}` : ''}
              {airportInfo.state ? `, ${airportInfo.state}` : ''}
              {/* Omit country label for US airports to reduce visual noise */}
              {airportInfo.country && airportInfo.country !== 'US' ? ` · ${airportInfo.country}` : ''}
            </p>
          )}
          {parsed.time && <p className="obs-time">Observed at {parsed.time}</p>}
          {parsed.isAuto && <span className="badge">Automated Station</span>}
        </div>
        {/* Flight category badge (VFR / MVFR / IFR / LIFR) with color coding */}
        <div
          className="flight-cat"
          style={{ background: cat.color }}
          title={cat.desc}
        >
          {cat.label}
        </div>
      </div>

      {conditions.length > 0 && (
        <div className="conditions-summary">
          {conditions.map((c, i) => (
            <span key={i} className="condition-chip">{c}</span>
          ))}
        </div>
      )}

      <div className="stats-grid">
        {parsed.temperature && (
          <StatCard
            icon="🌡️"
            label="Temperature"
            value={`${parsed.temperature.tempF}°F`}
            sub={`${parsed.temperature.tempC}°C`}
          />
        )}
        {parsed.temperature && (
          <StatCard
            icon="💧"
            label="Dew Point"
            value={`${parsed.temperature.dewF}°F`}
            sub={`${parsed.temperature.dewC}°C`}
          />
        )}
        {parsed.humidity != null && (
          <StatCard
            icon="🌊"
            label="Humidity"
            value={`${parsed.humidity}%`}
          />
        )}
        {parsed.altimeter && (
          <StatCard
            icon="📊"
            label="Pressure"
            value={parsed.altimeter.text}
          />
        )}
        {parsed.visibility && (
          <StatCard
            icon="👁️"
            label="Visibility"
            value={parsed.visibility.text}
          />
        )}
        {/* Wind gets a wider card to accommodate the compass rose */}
        {parsed.wind && (
          <div className="stat-card wind-card">
            <div className="stat-icon">💨</div>
            <div className="stat-label">Wind</div>
            <div className="stat-value">{parsed.wind.text}</div>
            {parsed.wind.detail && <div className="stat-sub">{parsed.wind.detail}</div>}
            {parsed.wind.variable && <div className="stat-sub">{parsed.wind.variable}</div>}
            <WindCompass degrees={parsed.wind.degrees} />
          </div>
        )}
      </div>

      {/* Collapsible raw METAR string for users who want the source data */}
      <details className="raw-metar">
        <summary>Raw METAR</summary>
        <code>{parsed.raw}</code>
      </details>
    </div>
  )
}

/**
 * Root application component.
 *
 * On mount it attempts to auto-select the nearest airport using IP
 * geolocation, falling back to KSFO (San Francisco) if that fails.
 * The user can then search for any airport using the combobox.
 */
export default function App() {
  const [currentCode, setCurrentCode] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /**
   * Fetches a live METAR for the given ICAO code through the Vite dev-proxy
   * (configured in vite.config.js to forward /api/metar → aviationweather.gov).
   * The proxy is needed because the Aviation Weather API does not send CORS headers.
   */
  const fetchMetar = useCallback(async (icao) => {
    if (!icao) return
    setCurrentCode(icao)
    setLoading(true)
    setError(null)
    setParsed(null)

    try {
      const res = await fetch(`/api/metar?ids=${icao}&format=raw`)
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const text = (await res.text()).trim()

      if (!text) {
        throw new Error(`No METAR data found for "${icao}". Check the airport code and try again.`)
      }

      // The API can return multiple lines when querying several stations;
      // we only requested one, so the first line is always the one we want.
      setParsed(parseMetar(text.split('\n')[0].trim()))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // On first render, detect the user's location and load their nearest airport.
  // KSFO is the fallback if geolocation is unavailable or the request fails.
  useEffect(() => {
    detectNearestAirport()
      .then(airport => fetchMetar(airport?.icao ?? 'KSFO'))
      .catch(() => fetchMetar('KSFO'))
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>✈️ METAR Reader</h1>
        <p className="tagline">Airport weather in plain English</p>
      </header>

      <AirportSearch onSelect={fetchMetar} />

      <main className="main-content">
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Fetching weather for {currentCode}…</p>
          </div>
        )}

        {error && (
          <div className="error-card">
            <p>⚠️ {error}</p>
          </div>
        )}

        {parsed && !loading && <WeatherDisplay parsed={parsed} />}
      </main>

      <footer className="app-footer">
        <p>Data from <a href="https://aviationweather.gov" target="_blank" rel="noreferrer">aviationweather.gov</a></p>
      </footer>
    </div>
  )
}
