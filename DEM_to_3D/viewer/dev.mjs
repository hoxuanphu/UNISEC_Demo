import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const viewer = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(viewer, '..', '..');
const python = process.env.TERRAIN_PYTHON || path.join(root, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python');
const children = new Set();
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}

function launch(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: 'inherit' });
  children.add(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on('exit', (code) => {
    children.delete(child);
    if (!stopping) stop(code ?? 1);
  });
  return child;
}

async function checkPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(5175, '127.0.0.1', resolve);
  });
  await new Promise((resolve) => server.close(resolve));
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

try {
  if (!existsSync(python)) throw new Error(`Python not found: ${python}. Create the repository .venv or set TERRAIN_PYTHON to a Python executable.`);
  try {
    await checkPort();
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw new Error('Port 5175 is already in use. Stop its service before running npm run dev.');
    throw error;
  }
  const backend = launch(python, ['-m', 'uvicorn', 'DEM_to_3D.api:app', '--host', '127.0.0.1', '--port', '5175'], root);
  const deadline = Date.now() + 30000;
  let ready = false;
  while (!stopping && Date.now() < deadline) {
    if (backend.exitCode !== null) break;
    try {
      const response = await fetch('http://127.0.0.1:5175/api/health', { signal: AbortSignal.timeout(1000) });
      const health = await response.json();
      if (response.ok && health.local_only === true && Array.isArray(health.missing_dependencies)) {
        if (health.missing_dependencies.length) throw new Error(`Missing processing dependencies: ${health.missing_dependencies.join(', ')}. Install DEM_to_3D/requirements-api.txt first.`);
        ready = true;
        break;
      }
    } catch (error) {
      if (error.message.startsWith('Missing processing dependencies:')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!stopping) {
    if (!ready) throw new Error('Terrain backend did not become ready on port 5175 within 30 seconds. Check the backend output above.');
    console.log('Terrain API ready: http://127.0.0.1:5175/docs');
    launch(process.execPath, [path.join(viewer, 'node_modules', 'vite', 'bin', 'vite.js'), ...process.argv.slice(2)], viewer);
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
