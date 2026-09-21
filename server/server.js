/* ==========================================================================
   StyleSense AI — key-hiding proxy
   --------------------------------------------------------------------------
   A tiny, zero-dependency Node.js server that sits between the browser and any
   OpenAI-compatible /chat/completions endpoint. The real API key stays HERE,
   on the machine — it is never shipped to the front end.

   The browser posts a normal OpenAI-style request body to
     POST http://localhost:8787/v1/chat/completions
   and this proxy forwards it upstream, adding the secret key.

   QUICK START
     cd server
     npm start                 # or: node server.js

   CONFIGURE (environment variables)
     UPSTREAM_URL    full URL of the upstream chat completions endpoint
                     (default: OpenAI)
     UPSTREAM_KEY    your real API key (required unless the upstream needs none)
     UPSTREAM_MODEL  default model to use if the client does not send one
     UPSTREAM_AUTH   "bearer" (default) | "x-api-key" | "none"
     PROXY_TOKEN     shared secret the browser must send in x-proxy-token
                     (default: "proxy" — change this for anything non-local)
     PORT            port to listen on (default 8787)
     ALLOW_ORIGIN    CORS origin to allow (default "*")

   WINDOWS (cmd) EXAMPLE
     set UPSTREAM_URL=https://api.groq.com/openai/v1/chat/completions
     set UPSTREAM_KEY=gsk_your_real_key
     set UPSTREAM_MODEL=llama-3.1-8b-instant
     set PROXY_TOKEN=proxy
     npm start

   Then in js/config.js:
     api: {
       enabled: true,
       baseUrl: "http://localhost:8787/v1/chat/completions",
       apiKey: "proxy",                 // must match PROXY_TOKEN
       authStyle: "x-proxy-token",
       model: "llama-3.1-8b-instant"
     }
   ========================================================================== */

"use strict";

const http = require("http");
const https = require("https");

/* ------------------------------- Config -------------------------------- */
const CONFIG = {
  port: process.env.PORT || 8787,
  upstreamUrl:
    process.env.UPSTREAM_URL ||
    "https://api.openai.com/v1/chat/completions",
  upstreamKey: process.env.UPSTREAM_KEY || "",
  upstreamModel: process.env.UPSTREAM_MODEL || "",
  upstreamAuth: (process.env.UPSTREAM_AUTH || "bearer").toLowerCase(),
  proxyToken: process.env.PROXY_TOKEN || "proxy",
  allowOrigin: process.env.ALLOW_ORIGIN || "*",
  timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS || 60000)
};

/* ------------------------------ Helpers -------------------------------- */

/** Merge the incoming OpenAI-style body with our server-side defaults. */
function normaliseBody(raw) {
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch (e) {
    parsed = {};
  }

  // Never let the client dictate the model if we were told to pin one.
  if (CONFIG.upstreamModel) parsed.model = CONFIG.upstreamModel;
  if (!parsed.model) parsed.model = CONFIG.upstreamModel || "gpt-4o-mini";

  // Sensible defaults; the client's values win if present.
  if (typeof parsed.temperature !== "number") parsed.temperature = 0.8;
  if (typeof parsed.max_tokens !== "number") parsed.max_tokens = 900;
  if (typeof parsed.top_p !== "number") parsed.top_p = 0.95;
  parsed.stream = false; // keep it simple and safe

  return JSON.stringify(parsed);
}

/** Build the upstream auth header according to UPSTREAM_AUTH. */
function upstreamAuthHeaders() {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  if (CONFIG.upstreamKey && CONFIG.upstreamAuth === "bearer") {
    headers.Authorization = "Bearer " + CONFIG.upstreamKey;
  } else if (CONFIG.upstreamKey && CONFIG.upstreamAuth === "x-api-key") {
    headers["x-api-key"] = CONFIG.upstreamKey;
  }
  return headers;
}

/** Write a JSON response with CORS headers. */
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": CONFIG.allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type, x-proxy-token, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

/* ------------------------------- Server -------------------------------- */
const server = http.createServer((req, res) => {
  // --- CORS preflight ---------------------------------------------------
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": CONFIG.allowOrigin,
      "Access-Control-Allow-Headers": "Content-Type, x-proxy-token, authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400"
    });
    res.end();
    return;
  }

  // --- Health check -----------------------------------------------------
  if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
    sendJson(res, 200, {
      ok: true,
      service: "StyleSense AI proxy",
      upstream: CONFIG.upstreamUrl,
      model: CONFIG.upstreamModel || "(client decides)",
      auth: CONFIG.upstreamAuth,
      keyConfigured: Boolean(CONFIG.upstreamKey) || CONFIG.upstreamAuth === "none"
    });
    return;
  }

  // --- Only accept POSTs to the completions path ------------------------
  if (req.method !== "POST") {
    sendJson(res, 405, { error: { message: "Method not allowed. Use POST." } });
    return;
  }

  const pathOk = req.url === "/v1/chat/completions" || req.url === "/chat/completions";
  if (!pathOk) {
    sendJson(res, 404, {
      error: { message: "Not found. POST to /v1/chat/completions." }
    });
    return;
  }

  // --- Shared-secret check ---------------------------------------------
  // Keeps a random page on the internet from burning your API quota.
  const supplied = req.headers["x-proxy-token"];
  if (CONFIG.proxyToken && supplied !== CONFIG.proxyToken) {
    sendJson(res, 401, {
      error: { message: "Unauthorised. Missing or incorrect x-proxy-token." }
    });
    return;
  }

  // --- Collect the request body ----------------------------------------
  let raw = "";
  let tooLarge = false;

  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 1000000) {
      tooLarge = true;
      req.destroy();
    }
  });

  req.on("end", () => {
    if (tooLarge) {
      sendJson(res, 413, { error: { message: "Request body too large." } });
      return;
    }

    const body = normaliseBody(raw);
    let target;

    try {
      target = new URL(CONFIG.upstreamUrl);
    } catch (e) {
      sendJson(res, 500, { error: { message: "Invalid UPSTREAM_URL configured." } });
      return;
    }

    const transport = target.protocol === "http:" ? http : https;
    const headers = upstreamAuthHeaders();
    headers["Content-Length"] = Buffer.byteLength(body);

    const upstreamReq = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: target.pathname + (target.search || ""),
        method: "POST",
        headers,
        timeout: CONFIG.timeoutMs
      },
      (upstreamRes) => {
        let data = "";
        upstreamRes.setEncoding("utf8");
        upstreamRes.on("data", (c) => { data += c; });
        upstreamRes.on("end", () => {
          res.writeHead(upstreamRes.statusCode || 502, {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": CONFIG.allowOrigin,
            "Cache-Control": "no-store"
          });
          res.end(data || JSON.stringify({ error: { message: "Empty upstream response" } }));
        });
      }
    );

    upstreamReq.on("timeout", () => {
      upstreamReq.destroy(new Error("Upstream timed out"));
    });

    upstreamReq.on("error", (err) => {
      // The front end treats a non-2xx as "fall back to the offline engine".
      if (!res.headersSent) {
        sendJson(res, 502, {
          error: { message: "Upstream request failed: " + (err && err.message) }
        });
      }
    });

    upstreamReq.write(body);
    upstreamReq.end();
  });
});

server.listen(CONFIG.port, () => {
  const keyState = CONFIG.upstreamKey ? "configured" : "NOT configured";
  console.log("");
  console.log("  StyleSense AI proxy is running");
  console.log("  --------------------------------");
  console.log("  Local endpoint : http://localhost:" + CONFIG.port + "/v1/chat/completions");
  console.log("  Upstream       : " + CONFIG.upstreamUrl);
  console.log("  Model          : " + (CONFIG.upstreamModel || "(client decides)"));
  console.log("  Upstream auth  : " + CONFIG.upstreamAuth);
  console.log("  Upstream key   : " + keyState);
  console.log("  Proxy token    : " + (CONFIG.proxyToken ? "(set)" : "(disabled)"));
  console.log("");
  console.log("  Point js/config.js at the local endpoint above,");
  console.log("  set authStyle: \"x-proxy-token\" and apiKey to your PROXY_TOKEN.");
  console.log("");
});