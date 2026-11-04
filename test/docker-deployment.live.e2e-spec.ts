import { execFileSync } from 'child_process';
import { randomBytes } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { createServer } from 'net';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

/**
 * Prueba de despliegue Docker real.
 *
 * Solo se ejecuta con `npm run test:docker:live` (o definiendo
 * RUN_DOCKER_DEPLOYMENT_TESTS=true). Construye la imagen de producción,
 * levanta PostgreSQL + API con docker compose, espera los healthchecks,
 * verifica /api/health, /api/ready y el login del seed, y limpia todo.
 *
 * Puede tardar varios minutos la primera vez porque compila la imagen.
 */
const liveEnabled = process.env.RUN_DOCKER_DEPLOYMENT_TESTS === 'true';
const describeLive = liveEnabled ? describe : describe.skip;

const rootDir = resolve(__dirname, '..');
const runId = `sakila-dep-${Date.now().toString(36)}`;
const dbContainer = `${runId}-db`;
const apiContainer = `${runId}-api`;

function runDocker(args: string[], timeout = 60000): string {
  return execFileSync('docker', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout,
    maxBuffer: 20 * 1024 * 1024,
  });
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('No se pudo reservar un puerto libre')));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function getJson(url: string): Promise<{ status: number; body: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const text = await response.text();
    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Se conserva el cuerpo como texto para el mensaje de error.
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForHttp(
  url: string,
  timeoutMs: number,
): Promise<{ status: number; body: any }> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const response = await getJson(url);
      if (response.status === 200) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(3000);
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timeout esperando ${url}: ${detail}`);
}

function containerStatus(container: string): string {
  return runDocker([
    'inspect',
    '--format',
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
    container,
  ]).trim();
}

async function waitForHealthy(container: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 'desconocido';
  while (Date.now() < deadline) {
    try {
      lastStatus = containerStatus(container);
    } catch {
      lastStatus = 'no-iniciado';
    }
    if (lastStatus === 'healthy') {
      return;
    }
    if (lastStatus === 'unhealthy') {
      break;
    }
    await sleep(3000);
  }
  throw new Error(`El contenedor ${container} no quedó healthy (estado: ${lastStatus})`);
}

describeLive('despliegue Docker real (build + compose + smoke)', () => {
  jest.setTimeout(900000);

  let tempDir = '';
  let composeArgs: string[] = [];
  let baseUrl = '';

  beforeAll(async () => {
    try {
      runDocker(['info', '--format', '{{.ServerVersion}}'], 30000);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `RUN_DOCKER_DEPLOYMENT_TESTS=true requiere un daemon Docker activo. Detalle: ${detail}`,
      );
    }

    tempDir = mkdtempSync(join(tmpdir(), 'sakila-docker-deploy-'));
    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;

    const envFile = join(tempDir, '.env');
    writeFileSync(
      envFile,
      [
        'POSTGRES_USER=sakila_deploy',
        `POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}`,
        'POSTGRES_DB=sakila_deploy',
        `BACKEND_PORT=${port}`,
        `JWT_ACCESS_SECRET=${randomBytes(48).toString('hex')}`,
        `JWT_REFRESH_SECRET=${randomBytes(48).toString('hex')}`,
        `CORS_ORIGIN=${baseUrl}`,
        'RUN_SEED=true',
        'SIAT_MODE=simulated',
        'SIGNATURE_PROVIDER=simulated',
        'SIAT_CONTRACTS_VERIFIED=false',
        '',
      ].join('\n'),
      'utf8',
    );

    const overrideFile = join(tempDir, 'compose.override.yml');
    writeFileSync(
      overrideFile,
      [
        'services:',
        '  db:',
        `    container_name: ${dbContainer}`,
        '    restart: "no"',
        '  api:',
        `    container_name: ${apiContainer}`,
        '    restart: "no"',
        '',
      ].join('\n'),
      'utf8',
    );

    composeArgs = [
      'compose',
      '--project-name',
      runId,
      '--env-file',
      envFile,
      '-f',
      'docker-compose.yml',
      '-f',
      overrideFile,
    ];

    runDocker([...composeArgs, 'up', '-d', '--build'], 600000);
    await waitForHealthy(dbContainer, 120000);
    await waitForHealthy(apiContainer, 300000);
  });

  afterAll(() => {
    if (composeArgs.length > 0) {
      try {
        runDocker([...composeArgs, 'down', '-v', '--remove-orphans', '--rmi', 'local'], 180000);
      } catch {
        // La limpieza no debe ocultar el resultado de las pruebas.
      }
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('deja los contenedores sanos y ejecuta la API como usuario no-root', () => {
    expect(containerStatus(dbContainer)).toBe('healthy');
    expect(containerStatus(apiContainer)).toBe('healthy');

    const configuredUser = runDocker([
      'inspect',
      '--format',
      '{{.Config.User}}',
      apiContainer,
    ]).trim();
    expect(configuredUser).toBe('nestjs');

    const uid = runDocker(['exec', apiContainer, 'id', '-u']).trim();
    expect(uid).not.toBe('0');
  });

  it('usa un volumen de datos aislado para el proyecto de prueba', () => {
    const dataVolume = runDocker([
      'inspect',
      '--format',
      '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}',
      dbContainer,
    ]).trim();
    expect(dataVolume).toBe(`${runId}_sakila_pgdata`);
  });

  it('responde health y readiness con la base de datos conectada', async () => {
    const health = await waitForHttp(`${baseUrl}/api/health`, 30000);
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');
    expect(health.body.data.service).toBe('sakila-facturacion-api');
    expect(health.body.data.certified).toBe(false);

    const ready = await waitForHttp(`${baseUrl}/api/ready`, 30000);
    expect(ready.status).toBe(200);
    expect(ready.body.data.ready).toBe(true);
    expect(ready.body.data.database).toBe('connected');
  });

  it('aplica migraciones y permite iniciar sesión con el seed', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@sakila.demo',
          password: 'Admin123!Demo',
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.data.access_token).toEqual(expect.any(String));
    expect(body.data.refresh_token).toEqual(expect.any(String));
  });
});
