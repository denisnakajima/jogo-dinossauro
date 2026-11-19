const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_SCORES_FILE = path.join(__dirname, 'data', 'scores.json');
const MAX_LEADERBOARD_SIZE = 10;
const MAX_BODY_BYTES = 8 * 1024;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function createScoreStore(scoresFile = DEFAULT_SCORES_FILE) {
  let writeQueue = Promise.resolve();

  async function ensureFile() {
    const dir = path.dirname(scoresFile);
    await fsp.mkdir(dir, { recursive: true });
    if (!fs.existsSync(scoresFile)) {
      const seed = [
        { name: 'REX-PRO', score: 1200, createdAt: new Date().toISOString() },
        { name: 'VELOCI', score: 850, createdAt: new Date().toISOString() },
        { name: 'METEORO', score: 500, createdAt: new Date().toISOString() },
      ];
      await fsp.writeFile(scoresFile, JSON.stringify(seed, null, 2), 'utf8');
    }
  }

  async function readScores() {
    await ensureFile();
    try {
      const raw = await fsp.readFile(scoresFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item.name === 'string' && Number.isFinite(item.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_LEADERBOARD_SIZE);
    } catch {
      return [];
    }
  }

  function addScore(name, score) {
    const run = async () => {
      const current = await readScores();
      const entry = {
        name,
        score,
        createdAt: new Date().toISOString(),
      };
      const updated = [...current, entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_LEADERBOARD_SIZE);

      await fsp.writeFile(scoresFile, JSON.stringify(updated, null, 2), 'utf8');
      const rank = updated.findIndex(
        (item) => item.createdAt === entry.createdAt && item.name === entry.name && item.score === entry.score
      );
      return {
        scores: updated,
        rank: rank === -1 ? null : rank + 1,
        saved: rank !== -1,
      };
    };

    writeQueue = writeQueue.then(run, run);
    return writeQueue;
  }

  return { readScores, addScore };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;

    req.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      body += chunk.toString('utf8');
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sanitizeName(rawName) {
  if (typeof rawName !== 'string') return '';
  return rawName
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .slice(0, 16);
}

function createAppServer(options = {}) {
  const store = createScoreStore(options.scoresFile || DEFAULT_SCORES_FILE);

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      // API: Ranking de pontuação
      if (pathname === '/api/scores') {
        if (req.method === 'GET') {
          const scores = await store.readScores();
          return sendJson(res, 200, { scores });
        }

        if (req.method === 'POST') {
          let parsed;
          try {
            const rawBody = await readRequestBody(req);
            parsed = JSON.parse(rawBody || '{}');
          } catch (err) {
            if (err && err.message === 'PAYLOAD_TOO_LARGE') {
              return sendJson(res, 413, { error: 'Payload muito grande.' });
            }
            return sendJson(res, 400, { error: 'JSON inválido.' });
          }

          const cleanName = sanitizeName(parsed.name);
          const numericScore = Math.floor(Number(parsed.score));

          if (!cleanName) {
            return sendJson(res, 400, { error: 'Informe um nome válido (1 a 16 caracteres).' });
          }
          if (!Number.isFinite(numericScore) || numericScore <= 0 || numericScore > 999999) {
            return sendJson(res, 400, { error: 'Pontuação inválida.' });
          }

          const result = await store.addScore(cleanName, numericScore);
          return sendJson(res, 201, result);
        }

        return sendJson(res, 405, { error: 'Método não permitido.' });
      }

      // Arquivos estáticos (apenas GET / HEAD)
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return sendJson(res, 405, { error: 'Método não permitido.' });
      }

      const relativeTarget = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const resolvedPath = path.resolve(PUBLIC_DIR, relativeTarget);

      if (!resolvedPath.startsWith(PUBLIC_DIR + path.sep) && resolvedPath !== path.join(PUBLIC_DIR, 'index.html')) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Acesso negado.');
      }

      const stat = await fsp.stat(resolvedPath).catch(() => null);
      if (!stat || !stat.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Arquivo não encontrado.');
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') {
        return res.end();
      }

      fs.createReadStream(resolvedPath).pipe(res);
    } catch (err) {
      console.error('Erro interno no servidor:', err);
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'Erro interno do servidor.' });
      } else {
        res.end();
      }
    }
  });
}

if (require.main === module) {
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`🦖 Jogo do Dinossauro rodando em http://localhost:${PORT}`);
  });
}

module.exports = { createAppServer };
