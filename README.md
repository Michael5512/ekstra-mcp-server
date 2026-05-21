# Ekstra MCP Server

> The MCP server Ekstra's docs said wasn't live yet.
> Built by [@Myke_Kript](https://x.com/Myke_Kript)

Connect any MCP-compatible AI assistant — Claude, Cursor, Windsurf — to Ekstra's real-time city intelligence API. Ask Claude "Can I park here right now?" and get a live answer.

---

## What It Does

Exposes 4 tools to any AI assistant via the Model Context Protocol:

| Tool | Description |
|---|---|
| `ekstra_get_curb_rules` | Live NYC parking rules near any lat/lng |
| `ekstra_get_network_stats` | Active devices, operators, total packets |
| `ekstra_get_devices` | Live device list with trust scores |
| `ekstra_get_facts` | Rotating Ekstra platform facts |

---

## Live Demo

Once deployed, visit your Vercel URL directly to confirm it's running:

```
GET https://your-project.vercel.app/api/mcp
```

Returns:
```json
{
  "name": "ekstra-mcp-server",
  "version": "1.0.0",
  "status": "live",
  "tools": [
    "ekstra_get_curb_rules",
    "ekstra_get_network_stats",
    "ekstra_get_devices",
    "ekstra_get_facts"
  ]
}
```

---

## Deploy to Vercel

### Option A — Vercel Dashboard (No CLI)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import your GitHub repo
4. Hit **Deploy** — no environment variables needed
5. Your MCP endpoint is live at:
   `https://your-project.vercel.app/api/mcp`

### Option B — Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## Connect to Claude Desktop

Add this to your Claude Desktop config file:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ekstra": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://your-project.vercel.app/api/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop. You'll see Ekstra tools available in Claude.

---

## Connect to Cursor / Windsurf

Add to your MCP config:

```json
{
  "mcpServers": {
    "ekstra": {
      "url": "https://your-project.vercel.app/api/mcp"
    }
  }
}
```

---

## Example Conversations With Claude

Once connected, Claude can answer questions like:

**User:** Can I park on Greenwich Village right now?
**Claude:** *(calls ekstra_get_curb_rules with lat: 40.7308, lng: -73.9973)*
> There are 66 active restrictions near Greenwich Village right now.
> The nearest legal spot opens in 2 hours 31 minutes.

---

**User:** How big is the Ekstra network?
**Claude:** *(calls ekstra_get_network_stats)*
> The Ekstra network currently has 8,363 active devices
> across 3 operators, having processed 9,508 total packets.

---

**User:** Show me active cameras on the Ekstra network
**Claude:** *(calls ekstra_get_devices with device_type: camera)*
> Found 12 active cameras. Here are the top results...

---

## Protocol Details

| Detail | Value |
|---|---|
| Protocol | MCP JSON-RPC 2.0 over HTTP POST |
| Auth | None required |
| Ekstra endpoints used | Public (no API key needed) |
| Max response time | 30 seconds (Vercel limit) |
| CORS | Open (`*`) |

---

## File Structure

```
ekstra-mcp-server/
├── api/
│   └── mcp.js       ← Vercel serverless function (MCP handler)
├── package.json
├── vercel.json      ← Vercel config + CORS headers
└── README.md        ← This file
```

---

## How It Works

```
AI Assistant (Claude / Cursor)
        │
        │  POST /api/mcp
        │  { method: "tools/call", params: { name: "ekstra_get_curb_rules", ... } }
        ▼
Vercel Serverless Function (api/mcp.js)
        │
        │  GET https://ekstra.ai/api/v1/curb-rules/near?lat=...
        ▼
Ekstra Public API
        │
        │  { rules: [...] }
        ▼
Formatted plain-text response
        │
        ▼
AI Assistant renders answer to user
```

No database. No auth. No config. Pure API proxy with MCP protocol on top.

---

## Extending This

### Add more Ekstra endpoints
When Ekstra ships new endpoints (spaces, director AI, observer), add them as new tools in `api/mcp.js` following the same pattern.

### Add the MCP server to Option 1 dashboard
The city intelligence dashboard and the MCP server share the same Ekstra API calls. They can be linked — the dashboard becomes a visual layer on top of the same data the MCP server exposes.

### Add authentication
When Ekstra's authenticated endpoints ship (device management, private data), add an `EKSTRA_API_KEY` environment variable in Vercel and pass it as a Bearer token.

---

## Built For

- [Ekstra Build Contest](https://x.com/EkstraAi) — 5 SOL prize
- Submission by [@Myke_Kript](https://x.com/Myke_Kript)

> Ekstra's own docs state: *"MCP server is a known follow-up — not live."*
> This is that server.

---

## License

Apache-2.0 — Same as the Ekstra SDK ecosystem.
Free to fork and submit as a PR to `build-with-ekstra`.
