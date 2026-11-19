const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { createAppServer } = require('../server');

async function startTestServer() {
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dino-test-'));
  const scoresFile = path.join(tmpDir, 'scores.json');
  const server = createAppServer({ scoresFile });

  const socketPath =
    process.platform === 'win32'
      ? `\\\\.\\pipe\\dino-test-${crypto.randomUUID()}`
      : path.join(tmpDir, 'server.sock');

  await new Promise((resolve) => server.listen(socketPath, resolve));

  function request(urlPath, { method = 'GET', body } = {}) {
    return new Promise((resolve, reject) => {
      const payload = body !== undefined ? JSON.stringify(body) : null;
      const req = http.request(
        {
          socketPath,
          path: urlPath,
          method,
          headers: payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {},
        },
        (res) => {
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            resolve({
              status: res.statusCode,
              headers: res.headers,
              text,
              json: () => JSON.parse(text),
            });
          });
        }
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    request,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await fsp.rm(tmpDir, { recursive: true, force: true });
    },
  };
}

test('serve os arquivos estáticos principais (HTML, CSS e JS)', async () => {
  const app = await startTestServer();
  try {
    const htmlRes = await app.request('/');
    assert.equal(htmlRes.status, 200);
    assert.match(htmlRes.headers['content-type'] || '', /text\/html/);
    assert.match(htmlRes.text, /DINO RUNNER/);

    const jsRes = await app.request('/game.js');
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers['content-type'] || '', /javascript/);

    const notFound = await app.request('/nao-existe.txt');
    assert.equal(notFound.status, 404);
  } finally {
    await app.close();
  }
});

test('API /api/scores lê ranking inicial, valida entrada e salva novo recorde no topo', async () => {
  const app = await startTestServer();
  try {
    const initialRes = await app.request('/api/scores');
    assert.equal(initialRes.status, 200);
    const initialData = initialRes.json();
    assert.equal(initialData.scores.length, 3);
    assert.equal(initialData.scores[0].score, 1200);

    // Rejeita pontuação inválida
    const badRes = await app.request('/api/scores', {
      method: 'POST',
      body: { name: 'Teste', score: -10 },
    });
    assert.equal(badRes.status, 400);

    // Insere novo recorde #1
    const postRes = await app.request('/api/scores', {
      method: 'POST',
      body: { name: 'Denis', score: 2450 },
    });
    assert.equal(postRes.status, 201);
    const postData = postRes.json();
    assert.equal(postData.saved, true);
    assert.equal(postData.rank, 1);
    assert.equal(postData.scores[0].name, 'Denis');
    assert.equal(postData.scores[0].score, 2450);
  } finally {
    await app.close();
  }
});
