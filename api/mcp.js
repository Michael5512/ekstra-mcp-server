/* ══════════════════════════════════════════════════════════════
   EKSTRA MCP SERVER
   ─────────────────────────────────────────────────────────────
   Model Context Protocol server for Ekstra's real-time
   city intelligence API.

   Exposes 4 tools to any MCP-compatible AI assistant:
   ┌─────────────────────────┬──────────────────────────────────┐
   │ ekstra_get_curb_rules   │ Live NYC parking rules near coord│
   │ ekstra_get_network_stats│ Active devices, operators, pkts  │
   │ ekstra_get_devices      │ Live device list with trust score│
   │ ekstra_get_facts        │ Rotating platform facts          │
   └─────────────────────────┴──────────────────────────────────┘

   Protocol : MCP JSON-RPC 2.0 over HTTP POST
   Deploy   : Vercel serverless (api/mcp.js)
   Auth     : None required (Ekstra public endpoints)
   Base URL : https://ekstra.ai

   Built by @Myke_Kript — github.com/Michael5512/ekstra-mcp-server
══════════════════════════════════════════════════════════════ */

const EKSTRA_BASE = 'https://ekstra.ai';

/* ── TOOL DEFINITIONS ─────────────────────────────────────── */
const TOOLS = [
  {
    name: 'ekstra_get_curb_rules',
    description: `Get live NYC curb/parking rules near a location.
Returns active restrictions and legal parking spots with countdowns
to state changes. Data covers 45,000+ NYC rules in real time.
Use this when a user asks about parking, standing, or curb rules
near any New York City location.`,
    inputSchema: {
      type: 'object',
      properties: {
        lat: {
          type: 'number',
          description: 'Latitude of the location (e.g. 40.7308 for Greenwich Village, NYC)',
        },
        lng: {
          type: 'number',
          description: 'Longitude of the location (e.g. -73.9973 for Greenwich Village, NYC)',
        },
        radius_m: {
          type: 'number',
          description: 'Search radius in meters. Default 200. Max 1000.',
          default: 200,
        },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'ekstra_get_network_stats',
    description: `Get live Ekstra network statistics.
Returns the current count of active devices, operators, and
total packets processed across the Ekstra network.
Use this when a user asks about the Ekstra network health,
size, or activity.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'ekstra_get_devices',
    description: `Get live Ekstra network devices.
Returns active cameras, screens, and phone IMU devices
on the Ekstra network with trust scores and location hints.
Optionally filter by device type.
Use this when a user asks about devices, cameras, or sensors
on the Ekstra network.`,
    inputSchema: {
      type: 'object',
      properties: {
        device_type: {
          type: 'string',
          enum: ['camera', 'screen', 'phone_imu'],
          description: 'Optional filter by device type.',
        },
        limit: {
          type: 'number',
          description: 'Max number of devices to return. Default 20.',
          default: 20,
        },
      },
      required: [],
    },
  },
  {
    name: 'ekstra_get_facts',
    description: `Get rotating facts from the Ekstra platform.
Returns editorial facts about the Ekstra network and
real-world data coverage.
Use this when a user wants to learn about Ekstra's data
or network coverage.`,
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Type of fact to retrieve. Default: fact.',
          default: 'fact',
        },
      },
      required: [],
    },
  },
];

/* ── EKSTRA API CALLS ─────────────────────────────────────── */
async function getCurbRules(lat, lng, radius_m = 200) {
  const r = radius_m > 1000 ? 1000 : radius_m < 50 ? 50 : radius_m;
  const url = `${EKSTRA_BASE}/api/v1/curb-rules/near?lat=${lat}&lng=${lng}&radius_m=${r}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ekstra API error: ${res.status}`);
  const { rules } = await res.json();

  if (!rules?.length) {
    return `No curb rules found within ${r}m of (${lat}, ${lng}). This area may not have Ekstra coverage yet.`;
  }

  const active = rules.filter(r => r.active_now);
  const legal  = rules.filter(r => !r.active_now);

  const formatCountdown = (rule) => {
    if (!rule.next_state_change_at) return '';
    const diff = Math.max(0, Math.floor(
      (new Date(rule.next_state_change_at) - Date.now()) / 60000
    ));
    return diff < 60 ? `${diff} min` : `${Math.floor(diff/60)}h ${diff % 60}m`;
  };

  let output = `📍 Curb rules within ${r}m of (${lat.toFixed(4)}, ${lng.toFixed(4)})\n`;
  output += `🔴 Restricted now: ${active.length}  |  🟢 Legal now: ${legal.length}\n\n`;

  if (active.length) {
    output += `── ACTIVE RESTRICTIONS ──\n`;
    active.slice(0, 8).forEach(rule => {
      const cd = formatCountdown(rule);
      output += `• ${rule.kind?.replace(/_/g, ' ') || 'Rule'}: ${rule.raw_text || rule.details?.on_street || '—'}`;
      if (cd) output += ` (changes in ${cd})`;
      output += '\n';
    });
    output += '\n';
  }

  if (legal.length) {
    output += `── LEGAL PARKING ──\n`;
    legal.slice(0, 5).forEach(rule => {
      const cd = formatCountdown(rule);
      output += `• ${rule.kind?.replace(/_/g, ' ') || 'Rule'}: ${rule.raw_text || rule.details?.on_street || '—'}`;
      if (cd) output += ` (until ${cd})`;
      output += '\n';
    });
  }

  return output;
}

async function getNetworkStats() {
  const url = `${EKSTRA_BASE}/api/v1/network/stats`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ekstra API error: ${res.status}`);
  const { stats } = await res.json();

  return `📡 Ekstra Network — Live Stats
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Active Devices  : ${parseInt(stats.active_devices || 0).toLocaleString()}
Operators       : ${parseInt(stats.operators || 0).toLocaleString()}
Total Packets   : ${parseInt(stats.total_packets || 0).toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data as of: ${new Date().toUTCString()}`;
}

async function getDevices(device_type, limit = 20) {
  const cap = Math.min(limit, 100);
  let url = `${EKSTRA_BASE}/api/v1/network/devices?limit=${cap}`;
  if (device_type) url += `&device_type=${device_type}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ekstra API error: ${res.status}`);
  const { devices } = await res.json();

  if (!devices?.length) {
    return `No ${device_type || ''} devices found on the Ekstra network right now.`;
  }

  const filtered = device_type
    ? devices.filter(d => d.device_type === device_type)
    : devices;

  let output = `📡 Ekstra Devices (${filtered.length} found${device_type ? `, type: ${device_type}` : ''})\n\n`;

  filtered.slice(0, limit).forEach((d, i) => {
    const trust = ((d.trust_score || 0) * 100).toFixed(0);
    const icon = { camera: '📷', screen: '🖥', phone_imu: '📱' }[d.device_type] || '📡';
    output += `${i + 1}. ${icon} ${d.location_hint || d.device_id?.slice(0, 16) || 'Unknown'}\n`;
    output += `   Type: ${d.device_type || '—'} | Trust: ${trust}% | Attestation: ${d.attestation_level || '—'}\n`;
    if (d.latitude && d.longitude) {
      output += `   Location: (${d.latitude.toFixed(4)}, ${d.longitude.toFixed(4)})\n`;
    }
  });

  return output;
}

async function getFacts(kind = 'fact') {
  const url = `${EKSTRA_BASE}/api/v1/platform/facts?kind=${kind}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ekstra API error: ${res.status}`);
  const { facts } = await res.json();

  if (!facts?.length) return 'No facts available right now.';

  let output = `💡 Ekstra Platform Facts\n\n`;
  facts.forEach((f, i) => {
    output += `${i + 1}. ${f.body || f.text || JSON.stringify(f)}\n`;
  });
  return output;
}

/* ── TOOL ROUTER ──────────────────────────────────────────── */
async function callTool(name, args = {}) {
  switch (name) {
    case 'ekstra_get_curb_rules':
      if (!args.lat || !args.lng) throw new Error('lat and lng are required');
      return getCurbRules(args.lat, args.lng, args.radius_m);

    case 'ekstra_get_network_stats':
      return getNetworkStats();

    case 'ekstra_get_devices':
      return getDevices(args.device_type, args.limit);

    case 'ekstra_get_facts':
      return getFacts(args.kind);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/* ── MCP JSON-RPC HANDLER ─────────────────────────────────── */
function mcpResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function mcpError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/* ── VERCEL SERVERLESS HANDLER ────────────────────────────── */
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      name: 'ekstra-mcp-server',
      version: '1.0.0',
      status: 'live',
      tools: TOOLS.map(t => t.name),
      built_by: '@Myke_Kript',
      repo: 'github.com/Michael5512/ekstra-mcp-server',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;
  const { jsonrpc, id, method, params } = body || {};

  if (jsonrpc !== '2.0') {
    return res.status(400).json(mcpError(id, -32600, 'Invalid JSON-RPC version'));
  }

  try {
    switch (method) {

      // MCP handshake
      case 'initialize':
        return res.json(mcpResponse(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'ekstra-mcp-server',
            version: '1.0.0',
            description: 'Real-time Ekstra city intelligence — parking rules, network devices, live stats',
          },
        }));

      case 'notifications/initialized':
        return res.status(200).end();

      case 'ping':
        return res.json(mcpResponse(id, {}));

      // List available tools
      case 'tools/list':
        return res.json(mcpResponse(id, { tools: TOOLS }));

      // Execute a tool
      case 'tools/call': {
        const { name, arguments: args } = params || {};
        if (!name) {
          return res.json(mcpError(id, -32602, 'Tool name is required'));
        }
        const result = await callTool(name, args || {});
        return res.json(mcpResponse(id, {
          content: [{ type: 'text', text: result }],
        }));
      }

      default:
        return res.json(mcpError(id, -32601, `Method not found: ${method}`));
    }
  } catch (err) {
    console.error('[ekstra-mcp]', err.message);
    return res.json(mcpError(id, -32000, err.message || 'Internal server error'));
  }
};

