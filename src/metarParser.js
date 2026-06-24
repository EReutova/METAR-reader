// Direction in degrees → compass cardinal/intercardinal
function degreesToCompass(deg) {
  const dirs = ['North', 'North-Northeast', 'Northeast', 'East-Northeast',
    'East', 'East-Southeast', 'Southeast', 'South-Southeast',
    'South', 'South-Southwest', 'Southwest', 'West-Southwest',
    'West', 'West-Northwest', 'Northwest', 'North-Northwest']
  const idx = Math.round(deg / 22.5) % 16
  return dirs[idx]
}

function knotsToMph(kt) {
  return Math.round(kt * 1.15078)
}

function celsiusToFahrenheit(c) {
  return Math.round(c * 9 / 5 + 32)
}

const WEATHER_CODES = {
  // Intensity
  '-': 'Light', '+': 'Heavy', 'VC': 'In the vicinity',
  // Descriptors
  'MI': 'Shallow', 'PR': 'Partial', 'BC': 'Patches of', 'DR': 'Low drifting',
  'BL': 'Blowing', 'SH': 'Shower', 'TS': 'Thunderstorm', 'FZ': 'Freezing',
  // Precipitation
  'RA': 'Rain', 'DZ': 'Drizzle', 'SN': 'Snow', 'SG': 'Snow grains',
  'IC': 'Ice crystals', 'PL': 'Ice pellets', 'GR': 'Hail', 'GS': 'Small hail',
  'UP': 'Unknown precipitation',
  // Obscuration
  'FG': 'Fog', 'BR': 'Mist', 'HZ': 'Haze', 'VA': 'Volcanic ash',
  'DU': 'Dust', 'SA': 'Sand', 'PY': 'Spray', 'FU': 'Smoke',
  // Other
  'SQ': 'Squall', 'PO': 'Dust/sand whirl', 'DS': 'Dust storm',
  'SS': 'Sandstorm', 'FC': 'Funnel cloud/tornado',
}

function decodeWeather(token) {
  let s = token
  let parts = []

  if (s.startsWith('-')) { parts.push('Light'); s = s.slice(1) }
  else if (s.startsWith('+')) { parts.push('Heavy'); s = s.slice(1) }
  else if (s.startsWith('VC')) { parts.push('Nearby'); s = s.slice(2) }
  else { parts.push('Moderate') }

  while (s.length >= 2) {
    const code = s.slice(0, 2)
    if (WEATHER_CODES[code]) {
      parts.push(WEATHER_CODES[code])
      s = s.slice(2)
    } else {
      s = s.slice(2)
    }
  }

  return parts.join(' ')
}

function parseSkyCondition(token) {
  const match = token.match(/^(CLR|SKC|CAVOK|FEW|SCT|BKN|OVC|VV)(\d{3})?(CB|TCU)?$/)
  if (!match) return null

  const [, cover, heightStr, type] = match
  const height = heightStr ? parseInt(heightStr) * 100 : null
  const heightDesc = height != null ? ` at ${height.toLocaleString()} ft` : ''
  const typeDesc = type === 'CB' ? ' (cumulonimbus — thunderstorm cloud)' : type === 'TCU' ? ' (towering cumulus)' : ''

  const coverDescriptions = {
    CLR: 'Clear skies',
    SKC: 'Clear skies',
    CAVOK: 'Ceiling and visibility OK',
    FEW: `Few clouds${heightDesc}`,
    SCT: `Scattered clouds${heightDesc}`,
    BKN: `Broken cloud layer${heightDesc}`,
    OVC: `Overcast (completely cloudy)${heightDesc}`,
    VV: `Vertical visibility${heightDesc}`,
  }

  return (coverDescriptions[cover] || cover) + typeDesc
}

function parseTemperature(token) {
  // e.g. 18/07 or M02/M05
  const match = token.match(/^(M?\d{2})\/(M?\d{2})$/)
  if (!match) return null
  const parse = (s) => s.startsWith('M') ? -parseInt(s.slice(1)) : parseInt(s)
  const tempC = parse(match[1])
  const dewC = parse(match[2])
  return { tempC, dewC, tempF: celsiusToFahrenheit(tempC), dewF: celsiusToFahrenheit(dewC) }
}

function humidityFromDewpoint(tempC, dewC) {
  // Magnus formula approximation
  const rh = 100 * Math.exp((17.625 * dewC) / (243.04 + dewC)) /
    Math.exp((17.625 * tempC) / (243.04 + tempC))
  return Math.round(rh)
}

function flightCategory(visibility, skyConditions, raw) {
  // LIFR, IFR, MVFR, VFR
  const hasOVC = skyConditions.some(s => s.includes('Overcast') || s.includes('Broken'))
  const heightMatch = raw.match(/(BKN|OVC)(\d{3})/)
  const ceilingFt = heightMatch ? parseInt(heightMatch[2]) * 100 : Infinity

  const visMiles = parseFloat(visibility) || 10

  if (visMiles < 1 || ceilingFt < 500) return { label: 'LIFR', desc: 'Low IFR — very poor conditions', color: '#c026d3' }
  if (visMiles < 3 || ceilingFt < 1000) return { label: 'IFR', desc: 'Instrument Flight Rules — poor visibility', color: '#dc2626' }
  if (visMiles < 5 || ceilingFt < 3000) return { label: 'MVFR', desc: 'Marginal VFR — reduced visibility', color: '#2563eb' }
  return { label: 'VFR', desc: 'Visual Flight Rules — good conditions', color: '#16a34a' }
}

export function parseMetar(raw) {
  const result = {
    raw,
    station: null,
    time: null,
    isAuto: false,
    wind: null,
    visibility: null,
    weather: [],
    skyConditions: [],
    temperature: null,
    altimeter: null,
    flightCategory: null,
    remarks: null,
  }

  // Split off remarks
  const remarkIdx = raw.indexOf(' RMK ')
  const body = remarkIdx >= 0 ? raw.slice(0, remarkIdx) : raw
  if (remarkIdx >= 0) result.remarks = raw.slice(remarkIdx + 5)

  const tokens = body.trim().split(/\s+/)
  let i = 0

  // Skip leading METAR/SPECI type indicator if present
  if (tokens[i] === 'METAR' || tokens[i] === 'SPECI') i++

  // Station ID
  if (/^[A-Z]{4}$/.test(tokens[i])) {
    result.station = tokens[i++]
  }

  // Date/time: DDHHmmZ
  if (/^\d{6}Z$/.test(tokens[i])) {
    const t = tokens[i++]
    const day = parseInt(t.slice(0, 2))
    const hour = parseInt(t.slice(2, 4))
    const min = parseInt(t.slice(4, 6))
    const now = new Date()
    result.time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} UTC`
    result.timeLocal = `Day ${day} of month, ${hour}:${min.toString().padStart(2, '0')} UTC`
  }

  // AUTO / COR
  if (tokens[i] === 'AUTO' || tokens[i] === 'COR') {
    result.isAuto = tokens[i++] === 'AUTO'
  }

  // Wind: dddssKT or dddssGggKT or 00000KT or VRBssKT
  if (/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?(KT|MPS)$/.test(tokens[i])) {
    const wt = tokens[i++]
    const isKt = wt.endsWith('KT')
    const gustMatch = wt.match(/G(\d{2,3})/)
    const dirStr = wt.slice(0, 3)
    const speedStr = wt.match(/^(?:VRB|\d{3})(\d{2,3})/)[1]
    const speedKt = parseInt(speedStr)
    const gustKt = gustMatch ? parseInt(gustMatch[1]) : null

    let speedMph = knotsToMph(speedKt)
    let gustMph = gustKt ? knotsToMph(gustKt) : null

    if (dirStr === 'VRB') {
      result.wind = {
        text: `Variable direction, ${speedMph} mph`,
        detail: gustMph ? ` with gusts to ${gustMph} mph` : '',
        speedMph,
      }
    } else if (dirStr === '000' && speedKt === 0) {
      result.wind = { text: 'Calm winds', detail: '', speedMph: 0 }
    } else {
      const dir = degreesToCompass(parseInt(dirStr))
      result.wind = {
        text: `${speedMph} mph from the ${dir}`,
        detail: gustMph ? ` with gusts to ${gustMph} mph` : '',
        degrees: parseInt(dirStr),
        speedMph,
        gustMph,
      }
    }

    // Variable wind direction e.g. 280V350
    if (/^\d{3}V\d{3}$/.test(tokens[i])) {
      const [from, to] = tokens[i++].split('V').map(Number)
      result.wind.variable = `varying between ${degreesToCompass(from)} and ${degreesToCompass(to)}`
    }
  }

  // Visibility
  while (i < tokens.length) {
    const vis = tokens[i]
    // CAVOK
    if (vis === 'CAVOK') {
      result.visibility = { text: 'Greater than 6 miles (CAVOK)', miles: 10 }
      i++; break
    }
    // P6SM / P10SM (greater than)
    if (/^P\d+SM$/.test(vis)) {
      const miles = parseInt(vis.slice(1))
      result.visibility = { text: `Greater than ${miles} miles`, miles }
      i++; break
    }
    // US statute miles with SM suffix, optionally fractional: 10SM, 1/2SM, M1/4SM
    if (/^M?\d+\/\d+SM$/.test(vis) || /^\d+SM$/.test(vis)) {
      const numStr = vis.replace('SM', '').replace(/^M/, '')
      if (/\//.test(numStr)) {
        const [num, den] = numStr.split('/')
        const miles = parseInt(num) / parseInt(den)
        result.visibility = { text: `${miles < 1 ? 'Less than 1' : miles} mile${miles !== 1 ? 's' : ''}`, miles }
      } else {
        const miles = parseInt(numStr)
        result.visibility = { text: `${miles} mile${miles !== 1 ? 's' : ''}`, miles }
      }
      i++; break
    }
    // US "1 1/2SM" (integer followed by fractional SM token)
    if (/^\d+$/.test(vis) && /^\d+\/\d+SM$/.test(tokens[i + 1])) {
      const [num, den] = tokens[i + 1].replace('SM', '').split('/')
      const miles = parseInt(vis) + parseInt(num) / parseInt(den)
      result.visibility = { text: `${miles} miles`, miles }
      i += 2; break
    }
    // ICAO metric visibility (4-digit meters, no suffix): 9999, 0800, 6000
    if (/^\d{4}$/.test(vis)) {
      const meters = parseInt(vis)
      if (meters === 9999) {
        result.visibility = { text: 'Greater than 6 miles (10+ km)', miles: 10 }
      } else {
        const km = (meters / 1000).toFixed(1)
        const miles = Math.round(meters / 1609.34 * 10) / 10
        result.visibility = { text: `${km} km (${miles} miles)`, miles }
      }
      i++; break
    }
    break
  }

  // Weather phenomena
  const wxPattern = /^([-+]|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(RA|DZ|SN|SG|IC|PL|GR|GS|UP|FG|BR|HZ|VA|DU|SA|PY|FU|SQ|PO|DS|SS|FC)+$/
  while (i < tokens.length && wxPattern.test(tokens[i])) {
    result.weather.push(decodeWeather(tokens[i++]))
  }

  // Sky conditions (NCD = No Cloud Detected, NSC = No Significant Cloud)
  if (tokens[i] === 'NCD' || tokens[i] === 'NSC') {
    result.skyConditions.push('Clear skies')
    i++
  }
  while (i < tokens.length && /^(CLR|SKC|CAVOK|FEW|SCT|BKN|OVC|VV)\d{0,3}(CB|TCU)?$/.test(tokens[i])) {
    const sky = parseSkyCondition(tokens[i++])
    if (sky) result.skyConditions.push(sky)
  }

  // Temperature / dew point
  while (i < tokens.length) {
    const temp = parseTemperature(tokens[i])
    if (temp) { result.temperature = temp; i++; break }
    i++
  }

  // Altimeter: US format A2992 (inHg×100) or ICAO format Q1013 (hPa)
  const altUS = body.match(/\bA(\d{4})\b/)
  const altQ = body.match(/\bQ(\d{4})\b/)
  if (altUS) {
    const inhg = parseInt(altUS[1]) / 100
    const hpa = Math.round(inhg * 33.8639)
    result.altimeter = { inhg, hpa, text: `${inhg.toFixed(2)} inHg` }
  } else if (altQ) {
    const hpa = parseInt(altQ[1])
    const inhg = Math.round(hpa / 33.8639 * 100) / 100
    result.altimeter = { inhg, hpa, text: `${hpa} hPa` }
  }

  // Flight category
  result.flightCategory = flightCategory(
    result.visibility?.miles ?? 10,
    result.skyConditions,
    raw
  )

  // Humidity
  if (result.temperature) {
    result.humidity = humidityFromDewpoint(result.temperature.tempC, result.temperature.dewC)
  }

  return result
}

export function getWeatherEmoji(parsed) {
  const wx = parsed.weather.map(w => w.toLowerCase()).join(' ')
  const sky = parsed.skyConditions.map(s => s.toLowerCase()).join(' ')

  if (wx.includes('thunderstorm')) return '⛈️'
  if (wx.includes('snow') || wx.includes('snow grains')) return '❄️'
  if (wx.includes('rain') && wx.includes('freezing')) return '🌨️'
  if (wx.includes('rain') || wx.includes('drizzle')) return '🌧️'
  if (wx.includes('fog') || wx.includes('mist')) return '🌫️'
  if (wx.includes('haze') || wx.includes('smoke')) return '😶‍🌫️'
  if (wx.includes('hail')) return '🌩️'
  if (sky.includes('overcast') || sky.includes('broken')) return '☁️'
  if (sky.includes('scattered')) return '⛅'
  if (sky.includes('few')) return '🌤️'
  return '☀️'
}
