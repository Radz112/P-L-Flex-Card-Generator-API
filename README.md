# P&L Flex Card Generator API

Generate beautiful P&L (Profit & Loss) flex card images for crypto trading. Perfect for sharing trading wins (or losses) on social media.

![Card Example](https://via.placeholder.com/1200x630/1a1a2e/00ff88?text=+400%25+PEPE)

## Features

- **Three Themes**: Dark, Light, and Degen (neon/meme style)
- **Meme Coin Support**: Handles tiny decimals like `$0.0{5}2400`
- **Twitter Optimized**: 1200x630 cards perfect for social sharing
- **APIX402 Compatible**: Works with nested body format
- **Production Ready**: Docker & Railway deployment configured

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

## API Reference

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-27T12:00:00.000Z",
  "uptime": 123.45,
  "version": "1.0.0",
  "environment": "production",
  "fonts": {
    "loaded": 1,
    "failed": 0,
    "status": "ok"
  }
}
```

### Get Endpoint Info

```bash
GET /api/v1/generate-card
```

Returns documentation for the POST endpoint including all parameters and examples.

### Generate Card

```bash
POST /api/v1/generate-card
Content-Type: application/json
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Token symbol (e.g., "PEPE", "MOG") |
| `entry_price` | number | Yes | Entry price of the trade |
| `current_price` | number | Yes | Current/exit price |
| `theme` | string | No | `dark` (default), `light`, or `degen` |
| `wallet_tag` | string | No | Wallet address or username to display |
| `timestamp` | string | No | Custom timestamp (defaults to current time) |

**Example Request (Direct):**

```bash
curl -X POST http://localhost:3000/api/v1/generate-card \
  -H "Content-Type: application/json" \
  -d '{
    "ticker": "PEPE",
    "entry_price": 0.0000024,
    "current_price": 0.0000120,
    "theme": "degen",
    "wallet_tag": "@degen_trader"
  }'
```

**Example Request (APIX402 Nested):**

```bash
curl -X POST http://localhost:3000/api/v1/generate-card \
  -H "Content-Type: application/json" \
  -d '{
    "body": {
      "ticker": "MOG",
      "entry_price": 0.0000024,
      "current_price": 0.0000120,
      "theme": "dark",
      "wallet_tag": "@whale"
    }
  }'
```

**Success Response:**

```json
{
  "success": true,
  "image": "data:image/png;base64,iVBORw0KGgo...",
  "metadata": {
    "ticker": "PEPE",
    "gain_percentage": 400,
    "formatted_gain": "+400.0%",
    "is_profit": true,
    "theme": "degen"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "entry_price is required",
    "current_price is required"
  ]
}
```

## Themes

### Dark Theme
- Black/dark gray gradient background
- Green for profit, red for loss
- Clean, professional look

### Light Theme
- White/light gray background
- Subtle border
- Professional, clean aesthetic

### Degen Theme
- Purple/black gradient with neon accents
- Scan line effect
- Glowing text for percentages
- Corner accent decorations
- Perfect for meme coins

## Card Layout

```
┌──────────────────────────────────────────────┐
│  $PEPE                           P&L CARD    │
│                                              │
│              +400.0%                         │
│                                              │
│  ┌─────────────┐    →    ┌─────────────┐    │
│  │   ENTRY     │         │  CURRENT    │    │
│  │ $0.0{5}2400 │         │ $0.000012   │    │
│  └─────────────┘         └─────────────┘    │
│                                              │
│  0x1234...abcd    Jan 27, 2024    FLEX CARD │
└──────────────────────────────────────────────┘
```

## Price Formatting

The API intelligently formats prices:

| Price | Display |
|-------|---------|
| `50000` | `$50,000` |
| `1.50` | `$1.50` |
| `0.0500` | `$0.0500` |
| `0.000012` | `$0.000012` |
| `0.0000024` | `$0.0{5}2400` |

## Deployment

### Railway (Recommended)

1. Push code to GitHub
2. Connect repository to Railway
3. Railway auto-detects Dockerfile
4. Deploy!

```bash
# Or use Railway CLI
railway login
railway init
railway up
```

### Docker

```bash
# Build image
docker build -t pl-card-api .

# Run container
docker run -p 3000:3000 pl-card-api
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |

## APIX402 Integration

This API is compatible with APIX402 payment gateway. Register your endpoint:

```json
{
  "endpoint": "https://your-domain.railway.app/api/v1/generate-card",
  "method": "POST",
  "price": "$0.02",
  "description": "Generate P&L flex card image",
  "parameters": {
    "ticker": "string (required)",
    "entry_price": "number (required)",
    "current_price": "number (required)",
    "theme": "dark|light|degen (optional)",
    "wallet_tag": "string (optional)"
  }
}
```

**Pricing:** `$0.02` per API call

## Development

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Run Docker locally
npm run docker:build
npm run docker:run
```

## Project Structure

```
pl-flex-card-api/
├── src/
│   ├── index.ts              # Express server entry
│   ├── routes/
│   │   ├── cardRoutes.ts     # GET & POST handlers
│   │   └── debugRoutes.ts    # Debug endpoints (dev only)
│   ├── services/
│   │   └── cardRenderer.ts   # Canvas rendering logic
│   ├── utils/
│   │   ├── pnlCalculator.ts  # P/L calculations
│   │   ├── fontLoader.ts     # Font registration
│   │   ├── errorHandler.ts   # Error handling middleware
│   │   └── logger.ts         # Request logging
│   └── assets/
│       └── fonts/
│           └── Roboto-Bold.ttf
├── Dockerfile
├── .dockerignore
├── .gitignore
├── package.json
├── tsconfig.json
├── railway.json
├── nixpacks.toml
└── README.md
```

## License

ISC
