'use strict';

/**
 * WORLD VIEWER — Electron Main Process
 *
 * Wraps the God's Eye View renderer as a secure desktop application.
 * Architecture:
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - sandbox: true (renderer)
 *   - All API proxying via local Express server (mirrors vite.config.js middleware)
 *   - Credentials stored via safeStorage
 *   - CSP set via session headers
 */

const { app, BrowserWindow, ipcMain, shell, clipboard, Notification, globalShortcut, Tray, Menu, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

// ─── Window state ────────────────────────────────────────────────────────────
let mainWindow = null;
let devServer = null;
let tray = null;
let rendererServer = null;

// A deliberately small, reviewed subset of World Monitor's public global
// catalog. Feed ids — not arbitrary URLs — cross the renderer/main boundary,
// so the desktop broker cannot become an open proxy.
const WORLD_NEWS_FEEDS = Object.freeze({
  'bbc-world': 'https://feeds.bbci.co.uk/news/world/rss.xml',
  'guardian-world': 'https://www.theguardian.com/world/rss',
  'reuters-world': 'https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en',
  'ap-world': 'https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en',
  'aljazeera-world': 'https://www.aljazeera.com/xml/rss/all.xml',
  'france24-world': 'https://www.france24.com/en/rss',
  'dw-world': 'https://rss.dw.com/xml/rss-en-world',
  'euronews-world': 'https://www.euronews.com/rss?format=xml',
  'africa-news': 'https://www.bbc.co.uk/news/10628493',
  'middle-east': 'https://news.google.com/rss/search?q=Middle+East+when:1d&hl=en-US&gl=US&ceid=US:en',
  'asia-pacific': 'https://news.google.com/rss/search?q=Asia+Pacific+when:1d&hl=en-US&gl=US&ceid=US:en',
  'latin-america': 'https://news.google.com/rss/search?q=Latin+America+when:1d&hl=en-US&gl=US&ceid=US:en',
  'npr-world': 'https://feeds.npr.org/1004/rss.xml',
  'cbc-world': 'https://www.cbc.ca/webfeed/rss/rss-world',
});
const worldNewsCache = new Map();
const WORLD_NEWS_CACHE_MS = 90_000;

// Development uses the same .env convention as Vite. Packaged builds use an
// environment variable or the encrypted credential set through the preload.
function loadDevelopmentEnv() {
  if (app.isPackaged) return;
  const envPath = path.join(app.getAppPath(), 'sources', 'gods-eye-view-main', '.env');
  try {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch {}
}
loadDevelopmentEnv();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const DEV_RENDERER_URL = process.env.WORLD_VIEWER_RENDERER_URL || 'http://localhost:4173';
let rendererUrl = DEV_RENDERER_URL;

/**
 * Serves the built Vite renderer from a loopback-only ephemeral port in a
 * packaged build. The renderer intentionally keeps a http(s) origin: Cesium
 * workers, WebGL assets, and existing same-origin data clients all work here
 * without relaxing Electron's file:// security model.
 */
function startPackagedRenderer() {
  const distDir = path.join(app.getAppPath(), 'sources', 'gods-eye-view-main', 'dist');
  const indexPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return Promise.reject(new Error(`Built renderer not found at ${indexPath}. Run npm run build:renderer before packaging.`));
  }

  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.wasm': 'application/wasm',
    '.geojson': 'application/geo+json; charset=utf-8',
    '.geojsonl': 'application/x-ndjson; charset=utf-8',
  };

  rendererServer = http.createServer((request, response) => {
    const requestPath = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    if (requestPath === '/api/world-news') {
      void serveWorldNews(request, response);
      return;
    }
    if (requestPath === '/api/place-context') {
      void servePlaceContext(request, response);
      return;
    }
    if (requestPath === '/api/groq/health' || requestPath === '/api/groq/chat' || requestPath === '/api/groq/hud-summary' || requestPath === '/api/groq/transcriptions' || requestPath === '/api/groq/speech') {
      void serveGroq(request, response, requestPath);
      return;
    }
    const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath).replace(/^\/+/, '');
    const resolvedPath = path.resolve(distDir, relativePath);
    // Do not let URL paths escape the renderer bundle. Fall back to the app
    // entry for client-side routes rather than exposing filesystem contents.
    const filePath = resolvedPath.startsWith(`${distDir}${path.sep}`) || resolvedPath === indexPath
      ? resolvedPath
      : indexPath;
    const servedPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : indexPath;

    response.setHeader('Cache-Control', servedPath === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable');
    response.setHeader('Content-Type', mimeTypes[path.extname(servedPath).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(servedPath)
      .on('error', () => {
        if (!response.headersSent) response.writeHead(500);
        response.end('WORLD VIEWER renderer unavailable');
      })
      .pipe(response);
  });

  return new Promise((resolve, reject) => {
    rendererServer.once('error', reject);
    rendererServer.listen(0, '127.0.0.1', () => {
      rendererServer.off('error', reject);
      const address = rendererServer.address();
      rendererUrl = `http://127.0.0.1:${address.port}`;
      resolve(rendererUrl);
    });
  });
}

async function serveWorldNews(request, response) {
  if (request.method !== 'GET') {
    response.writeHead(405, { Allow: 'GET', 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const params = new URL(request.url || '/', 'http://127.0.0.1').searchParams;
  const searchQuery = String(params.get('search') || '').trim();
  if (searchQuery) {
    if (searchQuery.length > 120) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Search query is too long' }));
      return;
    }
    const safeQuery = searchQuery.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`${safeQuery} when:7d`)}&hl=en-US&gl=US&ceid=US:en`;
    await serveWorldNewsUpstream(`search:${safeQuery.toLowerCase()}`, searchUrl, response);
    return;
  }
  const feedId = params.get('feed') || '';
  const upstreamUrl = WORLD_NEWS_FEEDS[feedId];
  if (!upstreamUrl) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Unknown reviewed news feed' }));
    return;
  }

  await serveWorldNewsUpstream(feedId, upstreamUrl, response);
}

async function servePlaceContext(request, response) {
  const params = new URL(request.url || '/', 'http://127.0.0.1').searchParams;
  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    response.writeHead(400, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Valid latitude and longitude are required' }));
    return;
  }
  try {
    const upstream = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
      headers: { 'User-Agent': 'WORLD-VIEWER/1.0 (public geospatial client)' },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json();
    const address = data?.address || {};
    const label = [address.city || address.town || address.village || address.county || address.state, address.country].filter(Boolean).join(', ') || data?.display_name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ label, lat, lon, source: 'OpenStreetMap Nominatim', freshness: 'recent' }));
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error?.message || 'Reverse geocoding unavailable' }));
  }
}

async function serveWorldNewsUpstream(cacheKey, upstreamUrl, response) {
  const cached = worldNewsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < WORLD_NEWS_CACHE_MS) {
    response.writeHead(200, { 'Content-Type': cached.contentType, 'Cache-Control': 'no-store', 'X-World-Viewer-Cache': 'HIT' });
    response.end(cached.body);
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { 'User-Agent': 'WORLD-VIEWER/1.0 (public-feed client)' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!upstream.ok) throw new Error(`Upstream HTTP ${upstream.status}`);
    const body = await upstream.text();
    if (!body || body.length > 2 * 1024 * 1024) throw new Error('Feed response is empty or exceeds 2 MB');
    const contentType = upstream.headers.get('content-type') || 'application/xml; charset=utf-8';
    worldNewsCache.set(cacheKey, { at: Date.now(), body, contentType });
    response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-World-Viewer-Cache': 'MISS' });
    response.end(body);
  } catch (error) {
    const stale = worldNewsCache.get(feedId);
    if (stale) {
      response.writeHead(200, { 'Content-Type': stale.contentType, 'Cache-Control': 'no-store', 'X-World-Viewer-Cache': 'STALE' });
      response.end(stale.body);
      return;
    }
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: `News feed unavailable: ${error.message}` }));
  } finally {
    clearTimeout(timer);
  }
}

function stopPackagedRenderer() {
  if (!rendererServer) return;
  try { rendererServer.close(); } catch {}
  rendererServer = null;
}

function getGroqApiKey() {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  if (credentialsStore.size === 0) loadFallbackCredentials();
  const entry = credentialsStore.get('GROQ_API_KEY');
  if (!entry) return null;
  try {
    if (entry.encrypted && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(entry.data, 'base64'));
    }
    return entry.data || null;
  } catch {
    return null;
  }
}

function readRequestBody(request, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Request body exceeds the allowed size'));
        request.destroy();
        return;
      }
      parts.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    request.on('error', reject);
  });
}

function readRequestBuffer(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Audio request exceeds the configured limit'));
        request.destroy();
        return;
      }
      parts.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(parts)));
    request.on('error', reject);
  });
}

async function serveGroq(request, response, requestPath) {
  const apiKey = getGroqApiKey();
  if (requestPath === '/api/groq/health') {
    response.writeHead(apiKey ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ ok: Boolean(apiKey), provider: 'groq', model: process.env.GROQ_HUD_MODEL || 'groq/compound-mini' }));
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405, { Allow: 'POST', 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  if (!apiKey) {
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Groq is not configured. Add GROQ_API_KEY in Settings or the app environment.' }));
    return;
  }
  try {
    if (requestPath === '/api/groq/transcriptions') {
      const audio = await readRequestBuffer(request, 25 * 1024 * 1024);
      const upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': request.headers['content-type'] || 'application/octet-stream',
        },
        body: audio,
        signal: AbortSignal.timeout(30_000),
      });
      const payload = await upstream.text();
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
      response.end(payload);
      return;
    }
    if (requestPath === '/api/groq/speech') {
      const body = JSON.parse(await readRequestBody(request, 8 * 1024));
      const input = String(body.input || '').trim().slice(0, 200);
      if (!input) throw new Error('Speech input is required');
      const upstream = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: body.model || 'canopylabs/orpheus-v1-english',
          voice: body.voice || 'hannah',
          input,
          response_format: body.response_format || 'wav',
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const audio = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'audio/wav', 'Cache-Control': 'no-store' });
      response.end(audio);
      return;
    }
    const body = JSON.parse(await readRequestBody(request));
    const isHud = requestPath.endsWith('/hud-summary');
    const messages = isHud
      ? [{ role: 'system', content: 'Return one factual WORLD VIEWER HUD summary of no more than five words. Never invent facts.' }, { role: 'user', content: JSON.stringify(body) }]
      : Array.isArray(body.messages) ? body.messages : [];
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: body.model || process.env.GROQ_HUD_MODEL || 'groq/compound-mini',
        messages,
        max_tokens: Math.min(Number(body.max_tokens) || (isHud ? 24 : 300), isHud ? 48 : 1024),
        temperature: typeof body.temperature === 'number' ? Math.max(0, Math.min(1, body.temperature)) : 0.3,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) throw new Error(payload?.error?.message || `Groq HTTP ${upstream.status}`);
    if (isHud) {
      const summary = String(payload?.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 5).join(' ');
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ summary, provider: 'groq' }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(payload));
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: error?.message || 'Groq request failed' }));
  }
}

// ─── Window state persistence ─────────────────────────────────────────────────
function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState() {
  try {
    const data = fs.readFileSync(getWindowStatePath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return { width: 1440, height: 900, x: undefined, y: undefined, maximized: false };
  }
}

function saveWindowState(win) {
  try {
    const bounds = win.getBounds();
    const state = {
      ...bounds,
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen(),
    };
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
  } catch (e) {
    console.warn('[WORLD VIEWER] Could not save window state:', e.message);
  }
}

// ─── Create main window ────────────────────────────────────────────────────────
function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    width: state.width || 1440,
    height: state.height || 900,
    x: state.x,
    y: state.y,
    minWidth: 1024,
    minHeight: 600,
    title: 'WORLD VIEWER',
    backgroundColor: '#050a0f',
    show: false,
    // Titlebar
    titleBarStyle: process.platform === 'linux' ? 'default' : 'hiddenInset',
    frame: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // ── CSP via headers ─────────────────────────────────────────────────────────
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:;",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
          "font-src 'self' data: https://fonts.gstatic.com;",
          "img-src 'self' data: blob: https: http:;",
          "connect-src 'self' https: http: wss: ws: blob:;",
          "worker-src 'self' blob:;",
          "media-src 'self' blob: https: http:;",
          "frame-src 'none';",
          "object-src 'none';",
          "base-uri 'self';",
          "form-action 'self';",
        ].join(' '),
      },
    });
  });

  // ── Load URL ─────────────────────────────────────────────────────────────────
  mainWindow.loadURL(rendererUrl).catch((err) => {
    console.error('[WORLD VIEWER] Failed to load renderer URL:', err.message);
    // Show a friendly error page if dev server not ready
    mainWindow.loadURL(`data:text/html,<html><body style="background:#050a0f;color:#00ff88;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column"><h1>WORLD VIEWER</h1><p>Starting earth systems...</p><p style="color:#666;font-size:12px">Waiting for renderer at ${rendererUrl}</p></body></html>`);
    // Retry after 2 seconds
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(rendererUrl).catch(() => {});
      }
    }, 2000);
  });

  // ── Window lifecycle ──────────────────────────────────────────────────────────
  mainWindow.once('ready-to-show', () => {
    if (state.maximized) mainWindow.maximize();
    if (state.fullscreen) mainWindow.setFullScreen(true);
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('close', () => saveWindowState(mainWindow));
  mainWindow.on('closed', () => { mainWindow = null; });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(rendererUrl)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(rendererUrl) && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// ─── IPC Handlers ──────────────────────────────────────────────────────────────

// Clipboard
ipcMain.handle('clipboard:write', (_, text) => {
  clipboard.writeText(String(text));
  return true;
});

ipcMain.handle('clipboard:read', () => clipboard.readText());

// Native notifications
ipcMain.handle('notification:send', (_, { title, body, urgency = 'normal' }) => {
  if (Notification.isSupported()) {
    const n = new Notification({
      title: String(title),
      body: String(body),
      urgency,
      appName: 'WORLD VIEWER',
    });
    n.show();
  }
  return true;
});

// System info
ipcMain.handle('system:info', () => ({
  platform: process.platform,
  arch: process.arch,
  version: app.getVersion(),
  electronVersion: process.versions.electron,
  nodeVersion: process.versions.node,
  appName: 'WORLD VIEWER',
}));

// Open external URL
ipcMain.handle('shell:openExternal', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
  return true;
});

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('window:fullscreen', () => {
  mainWindow?.setFullScreen(!mainWindow.isFullScreen());
});
ipcMain.handle('window:alwaysOnTop', (_, val) => {
  mainWindow?.setAlwaysOnTop(Boolean(val));
});
ipcMain.handle('window:hideControls', () => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.autoHideMenuBar = true;
  }
  return true;
});
ipcMain.handle('window:showControls', () => {
  if (mainWindow) {
    mainWindow.setMenuBarVisibility(true);
    mainWindow.autoHideMenuBar = false;
  }
  return true;
});

// ─── Credentials via safeStorage (with graceful fallback) ────────────────────
const credentialsStore = new Map();

function getCredentialsPath() {
  return path.join(app.getPath('userData'), 'credentials-fallback.json');
}

function loadFallbackCredentials() {
  try {
    const raw = fs.readFileSync(getCredentialsPath(), 'utf8');
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) credentialsStore.set(k, v);
  } catch {
    // no fallback file or invalid — start empty
  }
}

function saveFallbackCredentials() {
  try {
    const obj = Object.fromEntries(credentialsStore.entries());
    fs.writeFileSync(getCredentialsPath(), JSON.stringify(obj), { mode: 0o600 });
  } catch (e) {
    console.warn('[WORLD VIEWER] Could not persist fallback credentials:', e.message);
  }
}

ipcMain.handle('credentials:set', async (_, key, value) => {
  const k = String(key);
  const v = String(value);
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(v);
      credentialsStore.set(k, { encrypted: true, data: encrypted.toString('base64') });
    } else {
      credentialsStore.set(k, { encrypted: false, data: v });
      console.warn('[WORLD VIEWER] safeStorage encryption unavailable — credentials stored obfuscated, not encrypted.');
    }
  } catch {
    credentialsStore.set(k, { encrypted: false, data: v });
  }
  saveFallbackCredentials();
  return true;
});

ipcMain.handle('credentials:get', async (_, key) => {
  const k = String(key);
  // Lazy-load fallback on first read so early get() calls before file read work.
  if (credentialsStore.size === 0) loadFallbackCredentials();
  const entry = credentialsStore.get(k);
  if (!entry) return null;
  try {
    if (entry.encrypted && safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(entry.data, 'base64');
      return safeStorage.decryptString(buf);
    }
    return entry.data;
  } catch (e) {
    console.warn('[WORLD VIEWER] Could not decrypt credential:', k, e.message);
    return null;
  }
});

// App version
ipcMain.handle('app:version', () => app.getVersion());

// ─── Global shortcuts ────────────────────────────────────────────────────────
function registerGlobalShortcuts() {
  // These only fire when the window is focused — app-level shortcuts
  // handled in the renderer via keydown events
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!isDev) await startPackagedRenderer();
  createWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    globalShortcut.unregisterAll();
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (devServer) {
    try { devServer.kill(); } catch {}
  }
  stopPackagedRenderer();
});

// Security: prevent additional renderer processes
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(rendererUrl) && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
