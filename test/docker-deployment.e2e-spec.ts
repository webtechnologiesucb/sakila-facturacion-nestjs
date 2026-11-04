import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * Pruebas de despliegue Docker.
 *
 * La primera parte valida el contrato estático de despliegue sin necesidad de
 * un daemon Docker: Dockerfile, entrypoint, compose, .dockerignore y plantillas
 * de entorno. La segunda parte usa `docker compose config` (que solo valida y
 * normaliza el archivo, no arranca contenedores) cuando la CLI está disponible.
 *
 * Para una prueba real de build + arranque + healthchecks use:
 *   npm run test:docker:live
 */
jest.setTimeout(60000);

const rootDir = resolve(__dirname, '..');

function read(file: string): string {
  return readFileSync(join(rootDir, file), 'utf8');
}

function stage(dockerfile: string, name: string): string {
  const lines = dockerfile.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    new RegExp(`^FROM\\s+\\S+\\s+AS\\s+${name}\\s*$`, 'i').test(line),
  );
  if (start === -1) {
    return '';
  }
  const end = lines.findIndex((line, index) => index > start && /^FROM\s+/i.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function service(compose: string, name: string): string {
  const lines = compose.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^  ${name}:\\s*$`).test(line));
  if (start === -1) {
    return '';
  }
  const end = lines.findIndex(
    (line, index) => index > start && /^  [A-Za-z0-9_.-]+:\s*$/.test(line),
  );
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

function networksOf(composeService: string): string[] {
  const match = composeService.match(/^\s+networks:\s*\n((?:\s+- .+\n?)+)/m);
  if (!match) {
    return [];
  }
  return match[1]
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^- /, ''))
    .filter(Boolean);
}

function envValue(envFile: string, key: string): string | undefined {
  const line = envFile
    .split(/\r?\n/)
    .find((candidate) => candidate.trim().startsWith(`${key}=`));
  if (!line) {
    return undefined;
  }
  return line.slice(line.indexOf('=') + 1).trim();
}

function docker(args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('docker', args, {
    cwd: rootDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
}

function dockerComposeAvailable(): boolean {
  try {
    docker(['compose', 'version']);
    return true;
  } catch {
    return false;
  }
}

type ComposeConfig = {
  name: string;
  services: Record<string, any>;
  networks: Record<string, any>;
  volumes: Record<string, any>;
};

function composeConfig(file: string, env: NodeJS.ProcessEnv): ComposeConfig {
  return JSON.parse(docker(['compose', '-f', file, 'config', '--format', 'json'], env));
}

const dockerfile = read('Dockerfile');
const entrypoint = read('docker-entrypoint.sh');
const composeProduction = read('docker-compose.yml');
const composeDevelopment = read('docker-compose.dev.yml');
const dockerignore = read('.dockerignore');
const envExample = read('.env.example');
const envProductionExample = read('.env.production.example');

describe('Dockerfile: etapas de build', () => {
  const base = stage(dockerfile, 'base');
  const builder = stage(dockerfile, 'builder');
  const dev = stage(dockerfile, 'dev');
  const runner = stage(dockerfile, 'runner');

  it('define las etapas base, builder, dev y runner', () => {
    expect(base).not.toBe('');
    expect(builder).not.toBe('');
    expect(dev).not.toBe('');
    expect(runner).not.toBe('');
  });

  it('fija una versión reproducible de Node sobre Alpine', () => {
    expect(base).toMatch(/^FROM node:\d+\.\d+\.\d+-alpine\d+\.\d+ AS base$/m);
    expect(base).toContain('apk add --no-cache libc6-compat openssl');
  });

  it('instala dependencias con npm ci en la etapa base', () => {
    expect(base).toContain('COPY package.json package-lock.json ./');
    expect(base).toContain('RUN npm ci --no-audit --no-fund');
  });

  it('genera Prisma Client y compila TypeScript en builder', () => {
    expect(builder).toContain('COPY . .');
    expect(builder).toContain('RUN npx prisma generate');
    expect(builder).toContain('RUN npm run build');
    expect(dockerfile.indexOf('RUN npm run build')).toBeGreaterThan(
      dockerfile.indexOf('RUN npx prisma generate'),
    );
  });

  it('la etapa dev aplica migraciones, seed opcional y recarga en caliente', () => {
    expect(dev).toContain('ENV NODE_ENV=development');
    expect(dev).toContain('COPY . .');
    expect(dev).toContain('RUN npx prisma generate');
    expect(dev).toContain('EXPOSE 3000');
    expect(dev).toContain('npx prisma migrate deploy');
    expect(dev).toContain('$RUN_SEED');
    expect(dev).toContain('npm run start:dev');
  });
});

describe('Dockerfile: imagen de producción', () => {
  const runner = stage(dockerfile, 'runner');

  it('solo copia artefactos compilados y el entrypoint', () => {
    expect(runner).toContain('ENV NODE_ENV=production');
    expect(runner).toContain('COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules');
    expect(runner).toContain('COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist');
    expect(runner).toContain('COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma');
    expect(runner).toContain('COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json');
    expect(runner).toContain('docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh');
    expect(runner).not.toMatch(/^COPY\s+(--from=\S+\s+)?\.\s+\.\s*$/m);
    expect(runner).not.toMatch(/^COPY[^\n]*(?:test|tests|\.env|coverage)/m);
  });

  it('ejecuta con usuario no-root de UID/GID fijos', () => {
    expect(runner).toContain('addgroup --system --gid 1001 nodejs');
    expect(runner).toContain('adduser --system --uid 1001 --ingroup nodejs nestjs');
    expect(runner).toMatch(/^USER nestjs$/m);
    expect(runner.indexOf('USER nestjs')).toBeLessThan(runner.indexOf('ENTRYPOINT'));
  });

  it('declara healthcheck contra /api/health y el entrypoint de arranque', () => {
    expect(runner).toContain('EXPOSE 3000');
    expect(runner).toMatch(
      /HEALTHCHECK[\s\S]*?CMD wget -qO- http:\/\/127\.0\.0\.1:3000\/api\/health/,
    );
    expect(runner).toContain('ENTRYPOINT ["docker-entrypoint.sh"]');
  });

  it('no incorpora secretos en la imagen', () => {
    expect(dockerfile).not.toMatch(/^(?:ENV|ARG)\s+\w*(?:SECRET|PASSWORD|TOKEN)\s*=/im);
    expect(dockerfile).not.toContain('JWT_ACCESS_SECRET=');
    expect(dockerfile).not.toContain('POSTGRES_PASSWORD=');
    expect(dockerfile).not.toContain('SIAT_CLIENT_SECRET=');
  });
});

describe('docker-entrypoint.sh', () => {
  it('falla rápido y aplica migraciones antes de arrancar', () => {
    expect(entrypoint.startsWith('#!/bin/sh')).toBe(true);
    expect(entrypoint).toContain('set -eu');
    expect(entrypoint).toContain('npx prisma migrate deploy');
    expect(entrypoint.indexOf('npx prisma migrate deploy')).toBeLessThan(
      entrypoint.indexOf('exec node dist/src/main.js'),
    );
  });

  it('solo ejecuta el seed cuando RUN_SEED=true', () => {
    expect(entrypoint).toMatch(/if \[ "\$\{RUN_SEED:-false\}" = "true" \]; then/);
    expect(entrypoint).toContain('node dist/prisma/seed.js');
  });

  it('delega el proceso principal a node con exec', () => {
    expect(entrypoint).toMatch(/^exec node dist\/src\/main\.js$/m);
  });

  it('no imprime secretos ni activa trazas de shell', () => {
    expect(entrypoint).not.toMatch(/set\s+-[a-z]*x/);
    expect(entrypoint).not.toMatch(/\$\{?(?:JWT|POSTGRES_PASSWORD|SIAT_CLIENT_SECRET|SIAT_PRIVATE_KEY)/);
  });
});

describe('aislamiento de proyectos Compose', () => {
  it('usa proyectos distintos para producción y desarrollo', () => {
    expect(composeProduction).toMatch(/^name: sakila-facturacion-prod$/m);
    expect(composeDevelopment).toMatch(/^name: sakila-facturacion-dev$/m);
  });

  it('deja los volúmenes bajo el prefijo de cada proyecto', () => {
    const productionVolumes = composeProduction.slice(composeProduction.lastIndexOf('\nvolumes:'));
    const developmentVolumes = composeDevelopment.slice(
      composeDevelopment.lastIndexOf('\nvolumes:'),
    );
    // Un `name` explícito compartiría el volumen entre entornos y haría que la
    // suite live pudiera montar/borrar datos reales.
    expect(productionVolumes).not.toMatch(/^\s+name:/m);
    expect(developmentVolumes).not.toMatch(/^\s+name:/m);
  });
});

describe('docker-compose.yml (producción)', () => {
  const db = service(composeProduction, 'db');
  const api = service(composeProduction, 'api');

  it('define los servicios db y api', () => {
    expect(service(composeProduction, 'db')).not.toBe('');
    expect(service(composeProduction, 'api')).not.toBe('');
  });

  it('usa PostgreSQL fijado y persistente, sin publicar el puerto en el host', () => {
    expect(db).toContain('image: postgres:17.2-alpine3.20');
    expect(db).toContain('sakila_pgdata:/var/lib/postgresql/data');
    expect(db).toContain('pg_isready');
    expect(db).toContain('no-new-privileges:true');
    expect(db).not.toMatch(/^\s+ports:/m);
  });

  it('construye el target runner y espera a que la base esté sana', () => {
    expect(api).toContain('target: runner');
    expect(api).toContain('container_name: sakila-facturacion-api');
    expect(api).toContain('restart: unless-stopped');
    expect(api).toMatch(/depends_on:\s*\n\s+db:\s*\n\s+condition:\s*service_healthy/);
    expect(api).toContain('no-new-privileges:true');
    expect(api).not.toMatch(/^\s+volumes:/m);
  });

  it('configura producción con parámetros seguros por defecto', () => {
    expect(api).toContain('NODE_ENV: production');
    expect(api).toContain(
      'DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public',
    );
    expect(api).toContain('RUN_SEED: ${RUN_SEED:-false}');
    expect(api).toContain('SIAT_MODE: ${SIAT_MODE:-simulated}');
    expect(api).toContain('SIGNATURE_PROVIDER: ${SIGNATURE_PROVIDER:-simulated}');
    expect(api).toContain('SIAT_CONTRACTS_VERIFIED: ${SIAT_CONTRACTS_VERIFIED:-false}');
    expect(api).not.toMatch(/CORS_ORIGIN:\s*\*/);
  });

  it('exige secretos mediante interpolación obligatoria', () => {
    expect(composeProduction).toContain('${POSTGRES_USER:?Defina POSTGRES_USER}');
    expect(composeProduction).toContain('${POSTGRES_PASSWORD:?Defina POSTGRES_PASSWORD}');
    expect(composeProduction).toContain('${POSTGRES_DB:?Defina POSTGRES_DB}');
    expect(composeProduction).toContain(
      '${JWT_ACCESS_SECRET:?Defina JWT_ACCESS_SECRET de al menos 32 caracteres}',
    );
    expect(composeProduction).toContain(
      '${JWT_REFRESH_SECRET:?Defina JWT_REFRESH_SECRET de al menos 32 caracteres}',
    );
  });

  it('separa la red interna de la red de acceso publicada', () => {
    // La red `internal` no permite publicar puertos, por lo que la API necesita
    // una segunda red. PostgreSQL permanece aislado en la red interna.
    expect(networksOf(db)).toEqual(['internal']);
    expect(networksOf(api)).toEqual(['internal', 'edge']);
    expect(composeProduction).toMatch(/networks:\s*\n\s+internal:\s*\n\s+internal:\s*true/);
    expect(composeProduction).toMatch(/^  edge:\s*$/m);
    expect(composeProduction).toContain('internal: false');
  });

  it('declara healthcheck de la API y sin privilegios extra', () => {
    expect(api).toContain('wget -qO- http://127.0.0.1:3000/api/health');
    expect(composeProduction).not.toMatch(/privileged:\s*true/);
    expect(composeProduction).not.toMatch(/network_mode:\s*host/);
    expect(composeProduction).not.toContain('/var/run/docker.sock');
    expect(composeProduction).not.toContain('sakila-demo-pw-change-me');
    expect(composeProduction).not.toContain('demo-access-secret-change-me-min-32-chars');
    expect(composeProduction).not.toContain('demo-refresh-secret-change-me-min-32-chars');
  });
});

describe('docker-compose.dev.yml (desarrollo)', () => {
  const db = service(composeDevelopment, 'db');
  const api = service(composeDevelopment, 'api');

  it('expone PostgreSQL en un puerto local configurable', () => {
    expect(db).toContain('image: postgres:17.2-alpine3.20');
    expect(db).toContain('${POSTGRES_PORT:-55432}:5432');
    expect(db).toContain('pg_isready');
    expect(db).toContain('sakila_pgdata_dev:/var/lib/postgresql/data');
  });

  it('construye el target dev con código montado y recarga en caliente', () => {
    expect(api).toContain('target: dev');
    expect(api).toContain('NODE_ENV: development');
    expect(api).toContain('.:/app');
    expect(api).toContain('/app/node_modules');
    expect(api).toContain('CHOKIDAR_USEPOLLING');
    expect(api).toContain('RUN_SEED: ${RUN_SEED:-true}');
    expect(api).not.toContain('npm run start:prod');
  });

  it('mantiene healthchecks y permite publicar puertos hacia el host', () => {
    expect(api).toContain('wget -qO- http://127.0.0.1:3000/api/health');
    expect(api).toContain('no-new-privileges:true');
    expect(api).toMatch(/depends_on:\s*\n\s+db:\s*\n\s+condition:\s*service_healthy/);
    expect(networksOf(db)).toEqual(['internal', 'edge']);
    expect(networksOf(api)).toEqual(['internal', 'edge']);
    expect(composeDevelopment).toMatch(/networks:\s*\n\s+internal:\s*\n\s+internal:\s*true/);
    expect(composeDevelopment).toMatch(/^  edge:\s*$/m);
    expect(composeDevelopment).toContain('internal: false');
  });
});

describe('.dockerignore', () => {
  it('excluye dependencias, artefactos y metadatos innecesarios', () => {
    for (const entry of ['node_modules', 'dist', 'coverage', '.git', '.gitignore', 'tmp', '.vscode', '.idea']) {
      expect(dockerignore).toMatch(new RegExp(`^${entry.replace('.', '\\.')}$`, 'm'));
    }
  });

  it('excluye archivos .env reales pero conserva las plantillas', () => {
    expect(dockerignore).toMatch(/^\.env$/m);
    expect(dockerignore).toMatch(/^\.env\.\*$/m);
    expect(dockerignore).toMatch(/^!\.env\.example$/m);
    expect(dockerignore).toMatch(/^!\.env\.production\.example$/m);
  });
});

describe('plantillas de entorno', () => {
  it('.env.production.example contiene las variables obligatorias', () => {
    const required = [
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'CORS_ORIGIN',
      'RUN_SEED',
      'SIAT_MODE',
      'SIGNATURE_PROVIDER',
      'SIAT_CONTRACTS_VERIFIED',
    ];
    for (const key of required) {
      expect(envValue(envProductionExample, key)).toBeDefined();
    }
  });

  it('.env.production.example no trae secretos reales ni valores inseguros', () => {
    expect(envValue(envProductionExample, 'RUN_SEED')).toBe('false');
    expect(envValue(envProductionExample, 'SIAT_MODE')).toBe('simulated');
    expect(envValue(envProductionExample, 'SIGNATURE_PROVIDER')).toBe('simulated');
    expect(envValue(envProductionExample, 'SIAT_CONTRACTS_VERIFIED')).toBe('false');

    const accessSecret = envValue(envProductionExample, 'JWT_ACCESS_SECRET') || '';
    const refreshSecret = envValue(envProductionExample, 'JWT_REFRESH_SECRET') || '';
    expect(accessSecret).toMatch(/^REEMPLACE_/);
    expect(refreshSecret).toMatch(/^REEMPLACE_/);
    expect(accessSecret.length).toBeGreaterThanOrEqual(32);
    expect(refreshSecret.length).toBeGreaterThanOrEqual(32);
    expect(accessSecret).not.toBe(refreshSecret);

    const cors = envValue(envProductionExample, 'CORS_ORIGIN') || '';
    expect(cors).toMatch(/^https:\/\//);
    expect(cors).not.toBe('*');
    expect(envProductionExample).not.toContain('sakila-demo-pw-change-me');
  });

  it('.env.example documenta el flujo local con PostgreSQL en 55432', () => {
    expect(envValue(envExample, 'POSTGRES_PORT')).toBe('55432');
    expect(envValue(envExample, 'RUN_SEED')).toBe('true');
    expect(envValue(envExample, 'DATABASE_URL')).toContain('@localhost:55432/');
    expect(envValue(envExample, 'SIAT_MODE')).toBe('simulated');
  });
});

const composeAvailable = dockerComposeAvailable();

(composeAvailable ? describe : describe.skip)('docker compose config', () => {
  const productionEnv: NodeJS.ProcessEnv = {
    POSTGRES_USER: 'sakila_ci',
    POSTGRES_PASSWORD: 'ci-test-password-0123456789',
    POSTGRES_DB: 'sakila_ci',
    JWT_ACCESS_SECRET: 'a'.repeat(48),
    JWT_REFRESH_SECRET: 'b'.repeat(48),
    BACKEND_PORT: '39001',
    CORS_ORIGIN: 'https://facturacion.example.test',
    RUN_SEED: 'false',
  };
  const developmentEnv: NodeJS.ProcessEnv = {
    POSTGRES_USER: 'sakila_dev',
    POSTGRES_PASSWORD: 'dev-test-password-0123456789',
    POSTGRES_DB: 'sakila_dev',
    JWT_ACCESS_SECRET: 'c'.repeat(48),
    JWT_REFRESH_SECRET: 'd'.repeat(48),
    BACKEND_PORT: '39002',
    POSTGRES_PORT: '39003',
    RUN_SEED: 'true',
  };

  let production: ComposeConfig;
  let development: ComposeConfig;

  beforeAll(() => {
    production = composeConfig('docker-compose.yml', productionEnv);
    development = composeConfig('docker-compose.dev.yml', developmentEnv);
  });

  it('normaliza el compose de producción con target runner y red interna', () => {
    expect(production.name).toBe('sakila-facturacion-prod');
    expect(production.services.api.build.target).toBe('runner');
    expect(production.services.api.environment.NODE_ENV).toBe('production');
    expect(production.services.api.environment.RUN_SEED).toBe('false');
    expect(production.services.api.environment.DATABASE_URL).toContain('@db:5432/sakila_ci');
    expect(production.services.api.depends_on.db.condition).toBe('service_healthy');
    expect(production.services.api.ports[0].published).toBe('39001');
    expect(production.services.db.ports).toBeUndefined();
    expect(Object.keys(production.services.db.networks)).toEqual(['internal']);
    expect(Object.keys(production.services.api.networks).sort()).toEqual(['edge', 'internal']);
    expect(production.networks.internal.internal).toBe(true);
    expect(production.networks.edge).toBeDefined();
    expect(production.networks.edge.internal).not.toBe(true);
    expect(production.volumes.sakila_pgdata.name).toBe(
      'sakila-facturacion-prod_sakila_pgdata',
    );
  });

  it('normaliza el compose de desarrollo con código montado y seed habilitado', () => {
    expect(development.name).toBe('sakila-facturacion-dev');
    expect(development.services.api.build.target).toBe('dev');
    expect(development.services.api.environment.NODE_ENV).toBe('development');
    expect(development.services.api.environment.RUN_SEED).toBe('true');
    expect(development.services.db.ports[0].published).toBe('39003');
    expect(
      development.services.api.volumes.some(
        (volume: any) => volume.type === 'bind' && volume.target === '/app',
      ),
    ).toBe(true);
    expect(
      development.services.api.volumes.some(
        (volume: any) => volume.type === 'volume' && volume.target === '/app/node_modules',
      ),
    ).toBe(true);
    expect(Object.keys(development.services.db.networks).sort()).toEqual(['edge', 'internal']);
    expect(Object.keys(development.services.api.networks).sort()).toEqual(['edge', 'internal']);
    expect(development.networks.internal.internal).toBe(true);
    expect(development.networks.edge).toBeDefined();
    expect(development.networks.edge.internal).not.toBe(true);
    expect(development.volumes.sakila_pgdata_dev.name).toBe(
      'sakila-facturacion-dev_sakila_pgdata_dev',
    );
  });
});
