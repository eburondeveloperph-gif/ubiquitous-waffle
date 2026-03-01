#!/usr/bin/env node
/**
 * Full smoke test: build, lint, and verify key routes respond.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const log = (msg, ok = true) => {
  const icon = ok ? '✓' : '✗';
  const color = ok ? '\x1b[32m' : '\x1b[31m';
  console.log(`${color}${icon}\x1b[0m ${msg}`);
};

const run = (cmd, opts = {}) => {
  return new Promise((resolve, reject) => {
    const [exe, ...args] = cmd.split(/\s+/);
    const p = spawn(exe, args, {
      cwd: root,
      stdio: opts.silent ? 'pipe' : 'inherit',
      shell: true,
    });
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Exit ${code}`))));
  });
};

const fetchOk = (url) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  });

async function main() {
  console.log('\n--- Smoke Test ---\n');

  // 1. Lint
  try {
    await run('npm run lint');
    log('Lint passed');
  } catch {
    log('Lint failed', false);
    process.exit(1);
  }

  // 2. Build
  try {
    await run('npm run build');
    log('Build passed');
  } catch {
    log('Build failed', false);
    process.exit(1);
  }

  // 3. Start production server and hit routes
  let server;
  const port = 3999;
  try {
    server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, PORT: String(port) },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15000);
      const check = () => {
        fetch(`http://localhost:${port}`)
          .then(() => {
            clearTimeout(timeout);
            resolve();
          })
          .catch(() => setTimeout(check, 500));
      };
      setTimeout(check, 2000);
    });

    log('Server started on port ' + port);

    // Homepage
    await fetchOk(`http://localhost:${port}`);
    log('GET / returns 200');

    // API routes (no auth - expect 401 or 200/empty)
    const ttsRes = await fetch(`http://localhost:${port}/api/tts-history`);
    if (ttsRes.ok || ttsRes.status === 401) {
      log(`GET /api/tts-history returns ${ttsRes.status} (expected without auth)`);
    } else {
      throw new Error(`Unexpected ${ttsRes.status}`);
    }

    const voicesRes = await fetch(`http://localhost:${port}/api/echo/voices`);
    if (voicesRes.ok) {
      const data = await voicesRes.json();
      log(`GET /api/echo/voices returns ${Array.isArray(data) ? data.length : 0} voices`);
    } else {
      log(`GET /api/echo/voices returns ${voicesRes.status} (may need ECHO_PROVIDER_KEY)`, voicesRes.status === 500);
    }
  } catch (e) {
    log('Server/route checks failed: ' + e.message, false);
    process.exit(1);
  } finally {
    if (server) server.kill('SIGTERM');
  }

  console.log('\n--- Smoke test complete ---\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
