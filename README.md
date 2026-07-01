# ✈️ METAR Reader

A React web application that fetches live METAR weather reports from any airport in the world and translates the cryptic aviation format into plain English that anyone can understand.

![METAR Reader screenshot](https://i.imgur.com/placeholder.png)

## What is a METAR?

A METAR is a standardized weather observation issued by airports around the world. They look like this:

```
METAR KJFK 241551Z VRB06KT 10SM FEW060 27/11 A2996
```

This app decodes that into something readable:

> **John F. Kennedy International · New York, NY**
> Variable direction winds at 7 mph · Visibility 10 miles · Few clouds at 6,000 ft · 81°F (27°C) · Humidity 37% · Pressure 29.96 inHg · **VFR**

## Features

- **Searchable airport dropdown** — search by IATA code (JFK), ICAO code (KJFK), city name, or airport name across ~300 major airports worldwide
- **Auto-location on load** — detects your nearest airport via IP geolocation so you see local weather immediately
- **Full METAR decoding**
  - Wind speed (knots → mph) and direction with a compass rose
  - Visibility in statute miles (US) and kilometers (international)
  - Weather phenomena: rain, snow, fog, thunderstorms, hail, and more
  - Sky conditions and cloud layers with altitudes
  - Temperature and dew point in °F and °C
  - Relative humidity (derived from dew point)
  - Altimeter setting in inHg (US) or hPa (international)
- **Flight category badge** — color-coded VFR / MVFR / IFR / LIFR classification
- **International support** — handles both US and ICAO metric METAR formats
- **Raw METAR toggle** — expandable panel shows the original source string
- **Responsive dark UI** — works on desktop and mobile

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Weather data | [aviationweather.gov](https://aviationweather.gov/api/data/metar) |
| Geolocation | [ipinfo.io](https://ipinfo.io) (free tier, no API key needed) |
| Styling | Plain CSS (no UI library) |
| METAR parsing | Custom parser (`src/metarParser.js`) |
| Testing | Vitest + React Testing Library |

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/EReutova/METAR-reader
cd metar-reader

# Install dependencies
npm install

# Start the development server
npm run dev
```

Then open **http://localhost:5173** in your browser.

### Build for production

```bash
npm run build
```

The production-ready files are output to the `dist/` folder and can be served by any static host.

> **Note:** The Vite dev server includes a proxy that forwards `/api/metar` requests to `aviationweather.gov` to work around browser CORS restrictions. For production deployments you will need to replicate this with a reverse proxy (nginx, Caddy) or a small serverless function (Vercel, Netlify Edge, Cloudflare Workers).

## Testing

The project has 92 automated tests split across two files.

| File | What it tests |
|---|---|
| `src/metarParser.test.js` | Pure unit tests for the METAR parser — every field, format, and edge case |
| `src/App.test.jsx` | React component integration tests — rendering, search UI, error states |

### Coverage

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `metarParser.js` | 97% | 89% | 100% | 99% |
| `App.jsx` | 89% | 78% | 92% | 96% |
| `AirportSearch.jsx` | 87% | 83% | 96% | 86% |
| **All files** | **93%** | **85%** | **96%** | **95%** |

The main parser (`metarParser.js`) is the most thoroughly covered at 97% statements and 100% function coverage. The small gaps across all files are edge cases: network failure fallbacks, arrow-key boundary clamping at the top/bottom of the dropdown, and the focus-while-typing race condition handler.

### Run the tests

```bash
# Run all tests once and exit
npm test

# Watch mode — re-runs on every file save (great during development)
npm run test:watch

# Run with coverage report
npm run test:coverage
```

### What the parser tests cover

- **Wind** — calm (`00000KT`), directional with knots→mph conversion, variable direction (`VRB`), gusts, varying wind range (`280V350`)
- **Visibility** — US statute miles (`10SM`, `1/2SM`, `1 1/2SM`, `P6SM`), CAVOK, ICAO metric (`9999`, `0800`)
- **Weather phenomena** — light/moderate/heavy rain, thunderstorms, freezing fog, blowing snow, mist, nearby thunderstorm (`VCTS`), multiple simultaneous codes
- **Sky conditions** — CLR, SKC, NCD, NSC, FEW/SCT/BKN/OVC with heights, cumulonimbus (CB) and towering cumulus (TCU) flags
- **Temperature & dew point** — positive and negative (M-prefix) values, °C→°F conversion
- **Humidity** — Magnus formula derivation from dew point, 100% when temp equals dew point
- **Altimeter** — US A-format (inHg) and ICAO Q-format (hPa), bidirectional conversion
- **Flight category** — VFR, MVFR, IFR, LIFR classification with ceiling and visibility thresholds
- **International METARs** — European and Asian stations with ICAO format differences

### What the component tests cover

- Auto-location loads on startup
- Temperature, dew point, wind, visibility, and altimeter values render correctly
- Flight category badge appears with the right color
- Dropdown opens, navigates with arrow keys, selects on Enter, closes on Escape
- Clear (×) button empties the input
- "No airports found" message appears for unrecognised input
- Error card appears for invalid airport codes
- International airports show hPa altimeter

## Project structure

```
src/
├── App.jsx                # Root component, location detection, METAR fetch logic
├── App.test.jsx           # React component integration tests
├── AirportSearch.jsx      # Searchable combobox with keyboard navigation
├── metarParser.js         # Standalone METAR string parser
├── metarParser.test.js    # Parser unit tests (74 tests)
├── airports.json          # ~300 airports with ICAO, IATA, name, city, and coordinates
├── App.css                # Component styles
├── index.css              # Global CSS variables and reset
└── test-setup.js          # Vitest setup (jest-dom matchers)
```

## Data sources

- **Weather** — [Aviation Weather Center API](https://aviationweather.gov/api/data/metar) (US government, public domain, no API key required)
- **Geolocation** — [ipinfo.io](https://ipinfo.io) free tier (50,000 requests/month, no API key required)

## License

MIT
