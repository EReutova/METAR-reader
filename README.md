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

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/metar-reader.git
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

## Project structure

```
src/
├── App.jsx           # Root component, location detection, METAR fetch logic
├── AirportSearch.jsx # Searchable combobox with keyboard navigation
├── metarParser.js    # Standalone METAR string parser
├── airports.json     # ~300 airports with ICAO, IATA, name, city, and coordinates
├── App.css           # Component styles
└── index.css         # Global CSS variables and reset
```

## Data sources

- **Weather** — [Aviation Weather Center API](https://aviationweather.gov/api/data/metar) (US government, public domain, no API key required)
- **Geolocation** — [ipinfo.io](https://ipinfo.io) free tier (50,000 requests/month, no API key required)

## License

MIT
