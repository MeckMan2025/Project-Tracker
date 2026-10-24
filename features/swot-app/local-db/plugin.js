// Temporary local database for development. Runs inside the Vite dev/preview
// server, persists to a JSON file, and pushes state to browsers over SSE.
// Will be replaced by the production Supabase backend at merge time.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CATEGORIES = ['strengths', 'weaknesses', 'opportunities', 'threats'];
const MAX_TEXT_LENGTH = 500;

const emptyState = () => ({
  swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
  activeSection: 'strengths',
  suggestions: {}
});

const normalize = (raw) => {
  const state = emptyState();
  for (const cat of CATEGORIES) {
    if (Array.isArray(raw?.swot?.[cat])) state.swot[cat] = raw.swot[cat];
  }
  if (raw?.activeSection === null || CATEGORIES.includes(raw?.activeSection)) state.activeSection = raw.activeSection;
  if (raw?.suggestions && typeof raw.suggestions === 'object') state.suggestions = raw.suggestions;
  return state;
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const requireCategory = (value) => {
  if (!CATEGORIES.includes(value)) throw new HttpError(400, `Unknown category: ${value}`);
  return value;
};

const requireText = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new HttpError(400, 'Text is required');
  if (text.length > MAX_TEXT_LENGTH) throw new HttpError(400, `Text is limited to ${MAX_TEXT_LENGTH} characters`);
  return text;
};

const readBody = async (req) => {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
};

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

export default function localDb({ file }) {
  const load = () => {
    try {
      return normalize(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch {
      return emptyState();
    }
  };

  let state = load();
  const clients = new Set();

  const broadcast = () => {
    const message = `data: ${JSON.stringify(state)}\n\n`;
    for (const client of clients) client.write(message);
  };

  // Write to a temp file then rename so a crash never leaves a half-written db.
  const commit = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, file);
    broadcast();
  };

  const openEventStream = (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(state)}\n\n`);
    clients.add(res);
    const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), 25000);
    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(res);
    });
  };

  const routes = [
    ['GET', /^\/api\/state$/, (req, res) => sendJson(res, 200, state)],
    ['GET', /^\/api\/events$/, openEventStream],
    ['PUT', /^\/api\/active-section$/, async (req, res) => {
      const { section } = await readBody(req);
      // null unlocks every section for members
      state.activeSection = section === null ? null : requireCategory(section);
      commit();
      sendJson(res, 200, { ok: true });
    }],
    ['POST', /^\/api\/swot\/(\w+)$/, async (req, res, [category]) => {
      const { text } = await readBody(req);
      state.swot[requireCategory(category)].push(requireText(text));
      commit();
      sendJson(res, 201, { ok: true });
    }],
    ['DELETE', /^\/api\/swot\/(\w+)\/(\d+)$/, (req, res, [category, index]) => {
      const items = state.swot[requireCategory(category)];
      const i = Number(index);
      if (i >= items.length) throw new HttpError(404, 'Item not found');
      items.splice(i, 1);
      commit();
      sendJson(res, 200, { ok: true });
    }],
    ['POST', /^\/api\/suggestions$/, async (req, res) => {
      const { section, text, author } = await readBody(req);
      const id = crypto.randomUUID();
      state.suggestions[id] = {
        text: requireText(text),
        section: requireCategory(section),
        author: typeof author === 'string' ? author.trim().slice(0, 80) : '',
        createdAt: Date.now()
      };
      commit();
      sendJson(res, 201, { id });
    }],
    ['POST', /^\/api\/suggestions\/([\w-]+)\/approve$/, (req, res, [id]) => {
      const suggestion = state.suggestions[id];
      if (!suggestion) throw new HttpError(404, 'Suggestion not found');
      state.swot[suggestion.section].push(suggestion.text);
      delete state.suggestions[id];
      commit();
      sendJson(res, 200, { ok: true });
    }],
    ['DELETE', /^\/api\/suggestions\/([\w-]+)$/, (req, res, [id]) => {
      if (!state.suggestions[id]) throw new HttpError(404, 'Suggestion not found');
      delete state.suggestions[id];
      commit();
      sendJson(res, 200, { ok: true });
    }]
  ];

  const middleware = async (req, res, next) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (!pathname.startsWith('/api/')) return next();

    for (const [method, pattern, handler] of routes) {
      const match = pathname.match(pattern);
      if (!match || req.method !== method) continue;
      try {
        await handler(req, res, match.slice(1));
      } catch (err) {
        sendJson(res, err.status || 500, { error: err.message });
      }
      return;
    }
    sendJson(res, 404, { error: 'Not found' });
  };

  return {
    name: 'local-db',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}
