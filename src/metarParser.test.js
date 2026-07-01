import { describe, it, expect } from 'vitest'
import { parseMetar, getWeatherEmoji } from './metarParser'

// ── Helpers ────────────────────────────────────────────────────────────────

// Wraps a METAR body with the mandatory station+time prefix so tests can
// focus on the token under test without repeating boilerplate.
function metar(body) {
  return parseMetar(`KJFK 010000Z ${body}`)
}

// ── Station & time ─────────────────────────────────────────────────────────

describe('station and time', () => {
  it('parses station ICAO code', () => {
    const p = parseMetar('KJFK 010000Z 00000KT 10SM CLR 20/10 A2992')
    expect(p.station).toBe('KJFK')
  })

  it('strips leading METAR keyword', () => {
    const p = parseMetar('METAR KJFK 010000Z 00000KT 10SM CLR 20/10 A2992')
    expect(p.station).toBe('KJFK')
  })

  it('strips leading SPECI keyword', () => {
    const p = parseMetar('SPECI KJFK 010000Z 00000KT 10SM CLR 20/10 A2992')
    expect(p.station).toBe('KJFK')
  })

  it('formats observation time as HH:MM UTC', () => {
    const p = parseMetar('KJFK 241551Z 00000KT 10SM CLR 20/10 A2992')
    expect(p.time).toBe('15:51 UTC')
  })

  it('marks AUTO stations', () => {
    const p = parseMetar('KJFK 010000Z AUTO 00000KT 10SM CLR 20/10 A2992')
    expect(p.isAuto).toBe(true)
  })

  it('does not mark non-AUTO stations', () => {
    const p = parseMetar('KJFK 010000Z 00000KT 10SM CLR 20/10 A2992')
    expect(p.isAuto).toBe(false)
  })

  it('preserves raw string', () => {
    const raw = 'KJFK 010000Z 00000KT 10SM CLR 20/10 A2992'
    expect(parseMetar(raw).raw).toBe(raw)
  })
})

// ── Remarks ────────────────────────────────────────────────────────────────

describe('remarks', () => {
  it('strips RMK section from parsing and stores it', () => {
    const p = parseMetar('KJFK 010000Z 00000KT 10SM CLR 20/10 A2992 RMK AO2 SLP142')
    expect(p.remarks).toBe('AO2 SLP142')
    // station should still parse correctly
    expect(p.station).toBe('KJFK')
  })
})

// ── Wind ───────────────────────────────────────────────────────────────────

describe('wind', () => {
  it('parses calm wind (00000KT)', () => {
    const p = metar('00000KT 10SM CLR 20/10 A2992')
    expect(p.wind.text).toBe('Calm winds')
    expect(p.wind.speedMph).toBe(0)
  })

  it('parses directional wind and converts knots to mph', () => {
    // 15 kt × 1.15078 ≈ 17 mph
    const p = metar('27015KT 10SM CLR 20/10 A2992')
    expect(p.wind.text).toMatch(/17 mph/)
    expect(p.wind.text).toMatch(/West/)
    expect(p.wind.degrees).toBe(270)
    expect(p.wind.speedMph).toBe(17)
  })

  it('parses variable-direction wind (VRB)', () => {
    const p = metar('VRB03KT 10SM CLR 20/10 A2992')
    expect(p.wind.text).toMatch(/Variable direction/)
    expect(p.wind.speedMph).toBe(3)
  })

  it('parses gusts', () => {
    // 15G25KT → 17 mph gusting to 29 mph
    const p = metar('27015G25KT 10SM CLR 20/10 A2992')
    expect(p.wind.gustMph).toBe(29)
    expect(p.wind.detail).toMatch(/gusts to 29 mph/)
  })

  it('parses variable wind direction range (280V350)', () => {
    const p = metar('27010KT 280V350 10SM CLR 20/10 A2992')
    expect(p.wind.variable).toMatch(/West/)
  })

  it('parses north wind (360°)', () => {
    const p = metar('36010KT 10SM CLR 20/10 A2992')
    expect(p.wind.text).toMatch(/North/)
    expect(p.wind.degrees).toBe(360)
  })

  it('has no variable range when token absent', () => {
    const p = metar('27010KT 10SM CLR 20/10 A2992')
    expect(p.wind.variable).toBeUndefined()
  })
})

// ── Visibility ─────────────────────────────────────────────────────────────

describe('visibility', () => {
  it('parses whole-number US statute miles', () => {
    const p = metar('27010KT 10SM CLR 20/10 A2992')
    expect(p.visibility.miles).toBe(10)
    expect(p.visibility.text).toBe('10 miles')
  })

  it('parses P6SM (greater than 6 miles)', () => {
    const p = metar('27010KT P6SM CLR 20/10 A2992')
    expect(p.visibility.text).toMatch(/Greater than 6/)
    expect(p.visibility.miles).toBe(6)
  })

  it('parses simple fractional visibility (1/2SM)', () => {
    const p = metar('27010KT 1/2SM FG 20/10 A2992')
    expect(p.visibility.miles).toBeCloseTo(0.5)
  })

  it('parses mixed fraction visibility (1 1/2SM)', () => {
    const p = metar('27010KT 1 1/2SM FG 20/10 A2992')
    expect(p.visibility.miles).toBeCloseTo(1.5)
    expect(p.visibility.text).toBe('1.5 miles')
  })

  it('parses CAVOK', () => {
    const p = metar('27010KT CAVOK 20/10 A2992')
    expect(p.visibility.text).toMatch(/CAVOK/)
    expect(p.visibility.miles).toBe(10)
  })

  it('parses ICAO 9999 as 10+ km', () => {
    const p = metar('27010KT 9999 CLR 20/10 Q1013')
    expect(p.visibility.text).toMatch(/10\+ km/)
    expect(p.visibility.miles).toBe(10)
  })

  it('parses ICAO low visibility in meters', () => {
    const p = metar('27010KT 0800 FG 20/10 Q1013')
    expect(p.visibility.text).toMatch(/0\.8 km/)
    expect(p.visibility.miles).toBeCloseTo(0.5, 0)
  })

  it('parses single-mile visibility', () => {
    const p = metar('27010KT 1SM BR 20/10 A2992')
    expect(p.visibility.text).toBe('1 mile')
  })
})

// ── Weather phenomena ──────────────────────────────────────────────────────

describe('weather phenomena', () => {
  it('decodes moderate rain (RA)', () => {
    const p = metar('27010KT 5SM RA SCT030 20/10 A2992')
    expect(p.weather).toContain('Moderate Rain')
  })

  it('decodes light rain (-RA)', () => {
    const p = metar('27010KT 5SM -RA SCT030 20/10 A2992')
    expect(p.weather).toContain('Light Rain')
  })

  it('decodes heavy rain (+RA)', () => {
    const p = metar('27010KT 3SM +RA OVC010 20/10 A2992')
    expect(p.weather).toContain('Heavy Rain')
  })

  it('decodes thunderstorm with heavy rain (+TSRA)', () => {
    const p = metar('27010KT 2SM +TSRA OVC010 20/10 A2992')
    expect(p.weather[0]).toMatch(/Thunderstorm/)
    expect(p.weather[0]).toMatch(/Rain/)
  })

  it('decodes freezing fog (FZFG)', () => {
    const p = metar('00000KT 1/4SM FZFG VV003 M02/M05 A2990')
    expect(p.weather[0]).toMatch(/Freezing/)
    expect(p.weather[0]).toMatch(/Fog/)
  })

  it('decodes blowing snow (BLSN)', () => {
    const p = metar('36025KT 1SM BLSN OVC005 M05/M08 A2985')
    expect(p.weather[0]).toMatch(/Blowing/)
    expect(p.weather[0]).toMatch(/Snow/)
  })

  it('decodes snow (SN)', () => {
    const p = metar('36010KT 2SM SN OVC008 M03/M05 A2988')
    expect(p.weather).toContain('Moderate Snow')
  })

  it('decodes fog (FG)', () => {
    const p = metar('00000KT 1/4SM FG VV002 18/17 A2998')
    expect(p.weather).toContain('Moderate Fog')
  })

  it('decodes mist (BR)', () => {
    const p = metar('09006KT 3SM BR FEW015 20/18 A3002')
    expect(p.weather).toContain('Moderate Mist')
  })

  it('decodes nearby thunderstorm (VCTS)', () => {
    const p = metar('27010KT 10SM VCTS FEW030CB 25/10 A2990')
    expect(p.weather[0]).toMatch(/Nearby/)
    expect(p.weather[0]).toMatch(/Thunderstorm/)
  })

  it('parses multiple simultaneous phenomena', () => {
    const p = metar('27010KT 1SM -RA BR OVC010 18/16 A2992')
    expect(p.weather).toHaveLength(2)
  })
})

// ── Sky conditions ─────────────────────────────────────────────────────────

describe('sky conditions', () => {
  it('parses CLR', () => {
    const p = metar('27010KT 10SM CLR 20/10 A2992')
    expect(p.skyConditions).toContain('Clear skies')
  })

  it('parses SKC', () => {
    const p = metar('27010KT 10SM SKC 20/10 A2992')
    expect(p.skyConditions).toContain('Clear skies')
  })

  it('parses NCD (no cloud detected, ICAO automated)', () => {
    const p = metar('27010KT 9999 NCD 20/10 Q1013')
    expect(p.skyConditions).toContain('Clear skies')
  })

  it('parses NSC (no significant cloud)', () => {
    const p = metar('27010KT 9999 NSC 20/10 Q1013')
    expect(p.skyConditions).toContain('Clear skies')
  })

  it('parses FEW clouds with height', () => {
    const p = metar('27010KT 10SM FEW030 20/10 A2992')
    expect(p.skyConditions[0]).toMatch(/Few clouds/)
    expect(p.skyConditions[0]).toMatch(/3,000 ft/)
  })

  it('parses SCT clouds', () => {
    const p = metar('27010KT 10SM SCT050 20/10 A2992')
    expect(p.skyConditions[0]).toMatch(/Scattered clouds/)
    expect(p.skyConditions[0]).toMatch(/5,000 ft/)
  })

  it('parses BKN ceiling', () => {
    const p = metar('27010KT 5SM BKN025 18/14 A2992')
    expect(p.skyConditions[0]).toMatch(/Broken cloud layer/)
    expect(p.skyConditions[0]).toMatch(/2,500 ft/)
  })

  it('parses OVC ceiling', () => {
    const p = metar('27010KT 3SM OVC010 18/16 A2992')
    expect(p.skyConditions[0]).toMatch(/Overcast/)
    expect(p.skyConditions[0]).toMatch(/1,000 ft/)
  })

  it('flags cumulonimbus (CB)', () => {
    const p = metar('27010KT 10SM FEW030CB 25/10 A2992')
    expect(p.skyConditions[0]).toMatch(/cumulonimbus/)
  })

  it('flags towering cumulus (TCU)', () => {
    const p = metar('27010KT 10SM SCT025TCU 25/10 A2992')
    expect(p.skyConditions[0]).toMatch(/towering cumulus/)
  })

  it('parses multiple cloud layers', () => {
    const p = metar('27010KT 10SM FEW020 SCT050 BKN100 20/10 A2992')
    expect(p.skyConditions).toHaveLength(3)
  })
})

// ── Temperature & dew point ────────────────────────────────────────────────

describe('temperature and dew point', () => {
  it('converts positive °C to °F', () => {
    // 27°C = 80.6°F → rounds to 81
    const p = metar('27010KT 10SM CLR 27/11 A2992')
    expect(p.temperature.tempC).toBe(27)
    expect(p.temperature.tempF).toBe(81)
  })

  it('parses negative temperature (M prefix)', () => {
    const p = metar('27010KT 10SM CLR M02/M05 A2992')
    expect(p.temperature.tempC).toBe(-2)
    expect(p.temperature.tempF).toBe(28) // -2°C = 28.4°F → 28
  })

  it('parses dew point', () => {
    const p = metar('27010KT 10SM CLR 27/11 A2992')
    expect(p.temperature.dewC).toBe(11)
    expect(p.temperature.dewF).toBe(52) // 11°C = 51.8 → 52
  })

  it('parses negative dew point (M prefix)', () => {
    const p = metar('27010KT 10SM CLR M02/M10 A2992')
    expect(p.temperature.dewC).toBe(-10)
  })

  it('parses 0°C temperature', () => {
    const p = metar('27010KT 10SM CLR 00/M02 A2992')
    expect(p.temperature.tempC).toBe(0)
    expect(p.temperature.tempF).toBe(32)
  })
})

// ── Humidity ───────────────────────────────────────────────────────────────

describe('humidity', () => {
  it('calculates humidity from temperature and dew point', () => {
    // 27°C / 11°C dew → ~37% RH
    const p = metar('27010KT 10SM CLR 27/11 A2992')
    expect(p.humidity).toBeGreaterThan(30)
    expect(p.humidity).toBeLessThan(45)
  })

  it('yields ~100% humidity when temp equals dew point', () => {
    const p = metar('00000KT 1/4SM FG VV002 18/18 A2998')
    expect(p.humidity).toBe(100)
  })

  it('is null when no temperature reported', () => {
    const p = metar('27010KT 10SM CLR A2992')
    expect(p.humidity).toBeUndefined()
  })
})

// ── Altimeter ──────────────────────────────────────────────────────────────

describe('altimeter', () => {
  it('parses US A-format in inHg', () => {
    const p = metar('27010KT 10SM CLR 20/10 A2992')
    expect(p.altimeter.inhg).toBeCloseTo(29.92)
    expect(p.altimeter.text).toBe('29.92 inHg')
  })

  it('parses ICAO Q-format in hPa', () => {
    const p = metar('27010KT 9999 CLR 20/10 Q1013')
    expect(p.altimeter.hpa).toBe(1013)
    expect(p.altimeter.text).toBe('1013 hPa')
  })

  it('converts Q-format to inHg', () => {
    const p = metar('27010KT 9999 CLR 20/10 Q1013')
    // 1013 hPa / 33.8639 ≈ 29.92 inHg
    expect(p.altimeter.inhg).toBeCloseTo(29.92, 1)
  })

  it('converts A-format to hPa', () => {
    const p = metar('27010KT 10SM CLR 20/10 A2992')
    // 29.92 inHg × 33.8639 ≈ 1013 hPa
    expect(p.altimeter.hpa).toBeCloseTo(1013, -1)
  })
})

// ── Flight category ────────────────────────────────────────────────────────

describe('flight category', () => {
  it('classifies VFR (good conditions)', () => {
    const p = metar('27010KT 10SM FEW050 20/10 A2992')
    expect(p.flightCategory.label).toBe('VFR')
  })

  it('classifies MVFR (reduced visibility)', () => {
    // Ceiling 2500 ft → MVFR
    const p = metar('27010KT 4SM BKN025 18/14 A2992')
    expect(p.flightCategory.label).toBe('MVFR')
  })

  it('classifies IFR (poor visibility)', () => {
    // Ceiling 800 ft → IFR
    const p = metar('27010KT 2SM OVC008 18/16 A2992')
    expect(p.flightCategory.label).toBe('IFR')
  })

  it('classifies LIFR (very poor)', () => {
    // Ceiling 200 ft → LIFR
    const p = metar('00000KT 1/4SM FG VV002 18/17 A2998')
    expect(p.flightCategory.label).toBe('LIFR')
  })

  it('classifies LIFR when visibility below 1 mile', () => {
    const p = metar('27010KT 1/2SM FG OVC002 18/17 A2992')
    expect(p.flightCategory.label).toBe('LIFR')
  })

  it('provides a color for each category', () => {
    const vfr = metar('27010KT 10SM CLR 20/10 A2992')
    const lifr = metar('00000KT 1/4SM FG VV002 18/17 A2998')
    expect(vfr.flightCategory.color).toBeTruthy()
    expect(lifr.flightCategory.color).toBeTruthy()
    expect(vfr.flightCategory.color).not.toBe(lifr.flightCategory.color)
  })
})

// ── International METAR (ICAO format) ──────────────────────────────────────

describe('international METAR (ICAO format)', () => {
  it('parses a complete European METAR', () => {
    const p = parseMetar('EGLL 241550Z 23012KT 9999 FEW035 BKN120 15/08 Q1018')
    expect(p.station).toBe('EGLL')
    expect(p.wind.degrees).toBe(230)
    expect(p.visibility.miles).toBe(10)
    expect(p.altimeter.hpa).toBe(1018)
    expect(p.altimeter.text).toBe('1018 hPa')
    expect(p.flightCategory.label).toBe('VFR')
  })

  it('parses a Japanese METAR with low visibility', () => {
    const p = parseMetar('RJTT 241530Z 18008KT 3000 -RA BKN015 22/20 Q1010')
    expect(p.visibility.text).toMatch(/3\.0 km/)
    expect(p.weather).toContain('Light Rain')
    expect(p.flightCategory.label).toBe('IFR')
  })

  it('parses NCD sky condition from automated station', () => {
    const p = parseMetar('YSSY 241530Z 18010KT 9999 NCD 25/10 Q1015')
    expect(p.skyConditions).toContain('Clear skies')
  })
})

// ── getWeatherEmoji ────────────────────────────────────────────────────────

describe('getWeatherEmoji', () => {
  it('returns thunderstorm emoji for TSRA', () => {
    const p = metar('27010KT 2SM +TSRA OVC010 20/10 A2992')
    expect(getWeatherEmoji(p)).toBe('⛈️')
  })

  it('returns snow emoji for SN', () => {
    const p = metar('36010KT 2SM SN OVC008 M03/M05 A2988')
    expect(getWeatherEmoji(p)).toBe('❄️')
  })

  it('returns rain emoji for RA', () => {
    const p = metar('27010KT 5SM RA SCT030 20/10 A2992')
    expect(getWeatherEmoji(p)).toBe('🌧️')
  })

  it('returns fog emoji for FG', () => {
    const p = metar('00000KT 1/4SM FG VV002 18/17 A2998')
    expect(getWeatherEmoji(p)).toBe('🌫️')
  })

  it('returns cloudy emoji for overcast', () => {
    const p = metar('27010KT 10SM OVC030 20/10 A2992')
    expect(getWeatherEmoji(p)).toBe('☁️')
  })

  it('returns partly cloudy emoji for scattered clouds', () => {
    const p = metar('27010KT 10SM SCT040 20/10 A2992')
    expect(getWeatherEmoji(p)).toBe('⛅')
  })

  it('returns sun emoji for clear sky', () => {
    const p = metar('27010KT 10SM CLR 20/10 A2992')
    expect(getWeatherEmoji(p)).toBe('☀️')
  })

  it('returns freezing rain emoji for FZRA', () => {
    const p = metar('00000KT 1SM FZRA OVC010 M02/M04 A2985')
    expect(getWeatherEmoji(p)).toBe('🌨️')
  })
})
