import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// ── Fetch mock ─────────────────────────────────────────────────────────────

// Real METARs used as mock responses. Kept verbatim so any parser change
// that breaks real-world data causes a test failure here.
const MOCK_METARS = {
  KSFO: 'KSFO 241556Z 28012KT 10SM FEW020 18/10 A2997',
  KJFK: 'KJFK 241551Z 27015KT 10SM FEW060 27/11 A2996',
  EGLL: 'EGLL 241550Z 23012KT 9999 BKN025 15/08 Q1018',
  LIFR: 'KJFK 010000Z 00000KT 1/4SM FG VV002 18/17 A2998',
  IFR:  'KJFK 010000Z 27010KT 2SM OVC008 18/16 A2992',
}

function mockFetch(icao) {
  const body = MOCK_METARS[icao] ?? ''
  return Promise.resolve({
    ok: body.length > 0,
    status: body.length > 0 ? 200 : 404,
    text: () => Promise.resolve(body),
  })
}

beforeEach(() => {
  // ipinfo.io geolocation → respond with SF coordinates → maps to KSFO
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => {
    if (typeof url === 'string' && url.includes('ipinfo')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ loc: '37.6213,-122.379' }),
      })
    }
    // METAR API proxy: /api/metar?ids=XXXX&format=raw
    const match = url.match(/ids=([A-Z]{4})/)
    const icao = match?.[1] ?? ''
    return mockFetch(icao)
  })
})

// ── Auto-location on load ──────────────────────────────────────────────────

describe('app startup', () => {
  it('shows a loading spinner on mount', () => {
    render(<App />)
    expect(document.querySelector('.spinner')).toBeInTheDocument()
  })

  it('auto-loads the nearest airport on startup', async () => {
    render(<App />)
    await waitFor(() => screen.getByText('KSFO'), { timeout: 5000 })
    expect(screen.getByText('KSFO')).toBeInTheDocument()
  })

  it('displays the airport name after load', async () => {
    render(<App />)
    await waitFor(() => screen.getByText('KSFO'), { timeout: 5000 })
    // airports.json has name/city for KSFO
    expect(screen.getByText(/San Francisco/i)).toBeInTheDocument()
  })
})

// ── Weather data rendering ─────────────────────────────────────────────────

describe('weather card', () => {
  async function loadKJFK() {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'jfk')
    await waitFor(() => screen.getByText('JFK'), { timeout: 3000 })
    const firstResult = screen.getAllByRole('option')[0]
    await user.click(firstResult)
    await waitFor(() => screen.getByText('KJFK'), { timeout: 5000 })
  }

  it('renders temperature in °F', async () => {
    await loadKJFK()
    // 27°C = 81°F
    expect(screen.getByText('81°F')).toBeInTheDocument()
  })

  it('renders dew point in °F', async () => {
    await loadKJFK()
    // 11°C = 52°F
    expect(screen.getByText('52°F')).toBeInTheDocument()
  })

  it('renders wind information', async () => {
    await loadKJFK()
    expect(screen.getByText(/mph/)).toBeInTheDocument()
  })

  it('renders visibility', async () => {
    await loadKJFK()
    expect(screen.getByText(/10 miles/)).toBeInTheDocument()
  })

  it('renders altimeter reading', async () => {
    await loadKJFK()
    expect(screen.getByText(/29.96 inHg/)).toBeInTheDocument()
  })

  it('renders flight category badge', async () => {
    await loadKJFK()
    expect(screen.getByText('VFR')).toBeInTheDocument()
  })

  it('renders raw METAR in the collapsible section', async () => {
    await loadKJFK()
    const summary = screen.getByText('Raw METAR')
    expect(summary).toBeInTheDocument()
  })
})

// ── Flight category colors ─────────────────────────────────────────────────

describe('flight category display', () => {
  it('shows green badge for VFR conditions', async () => {
    render(<App />)
    await waitFor(() => screen.getByText('KSFO'), { timeout: 5000 })
    const badge = document.querySelector('.flight-cat')
    // VFR color is #16a34a → jsdom normalises to rgb(22, 163, 74)
    expect(badge?.style.background).toMatch(/rgb\(22,\s*163,\s*74\)/)
  })
})

// ── Error handling ─────────────────────────────────────────────────────────

describe('error handling', () => {
  it('shows an error card when the airport is not found', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'ZZZZ')
    await user.keyboard('{Enter}')

    await waitFor(() => document.querySelector('.error-card'), { timeout: 10000 })
    expect(document.querySelector('.error-card')).toBeInTheDocument()
  })
})

// ── Airport search UI ──────────────────────────────────────────────────────

describe('airport search', () => {
  it('opens the dropdown when typing', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    await user.type(screen.getByRole('textbox'), 'bos')
    await waitFor(() => document.querySelector('.dropdown'), { timeout: 3000 })
    expect(document.querySelector('.dropdown')).toBeInTheDocument()
  })

  it('shows a "no airports found" message for unrecognised input', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    await user.type(screen.getByRole('textbox'), 'xqz')
    await waitFor(() => screen.getByText(/No airports found/), { timeout: 3000 })
    expect(screen.getByText(/No airports found/)).toBeInTheDocument()
  })

  it('clears the input when the × button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    const input = screen.getByRole('textbox')
    await user.type(input, 'jfk')
    const clearBtn = document.querySelector('.clear-btn')
    expect(clearBtn).toBeInTheDocument()
    await user.click(clearBtn)
    expect(input.value).toBe('')
  })

  it('navigates dropdown with arrow keys', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    await user.type(screen.getByRole('textbox'), 'new')
    await waitFor(() => document.querySelector('.dropdown'), { timeout: 3000 })
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{ArrowDown}')
    const highlighted = document.querySelector('.dropdown-item.highlighted')
    expect(highlighted).toBeInTheDocument()
  })

  it('closes dropdown on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    await user.type(screen.getByRole('textbox'), 'bos')
    await waitFor(() => document.querySelector('.dropdown'), { timeout: 3000 })
    await user.keyboard('{Escape}')
    await waitFor(() => !document.querySelector('.dropdown'), { timeout: 1000 })
    expect(document.querySelector('.dropdown')).not.toBeInTheDocument()
  })
})

// ── International METAR rendering ──────────────────────────────────────────

describe('international airport', () => {
  it('renders hPa altimeter for ICAO format METARs', async () => {
    const user = userEvent.setup()
    render(<App />)
    await waitFor(() => screen.getByRole('textbox'), { timeout: 5000 })
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'LHR')
    await waitFor(() => document.querySelector('.dropdown'), { timeout: 3000 })
    const options = screen.getAllByRole('option')
    await user.click(options[0])
    await waitFor(() => screen.getByText('EGLL'), { timeout: 5000 })
    expect(screen.getByText(/1018 hPa/)).toBeInTheDocument()
  })
})
