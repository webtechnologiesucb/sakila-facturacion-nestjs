import * as fs from 'fs';

/**
 * Validación de variables de entorno.
 * En producción el arranque falla ante configuración insegura o incompleta.
 * No se aceptan credenciales fiscales reales en el repositorio.
 */
export function envValidation(config: Record<string, any>): Record<string, any> {
  const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas faltantes: ${missing.join(', ')}`);
  }

  const siatMode = (config.SIAT_MODE || 'simulated').toLowerCase();
  if (!['simulated', 'real'].includes(siatMode)) {
    throw new Error('SIAT_MODE debe ser "simulated" o "real"');
  }

  const signatureProvider = (config.SIGNATURE_PROVIDER || 'simulated').toLowerCase();
  if (!['simulated', 'unconfigured'].includes(signatureProvider)) {
    throw new Error('SIGNATURE_PROVIDER debe ser "simulated" o "unconfigured"');
  }

  if (config.NODE_ENV === 'production') {
    const insecureSecrets = [
      'demo-access-secret-change-me-min-32-chars',
      'demo-refresh-secret-change-me-min-32-chars',
      'change-me',
      'secret',
    ];
    if (
      insecureSecrets.includes(config.JWT_ACCESS_SECRET) ||
      insecureSecrets.includes(config.JWT_REFRESH_SECRET) ||
      String(config.JWT_ACCESS_SECRET).length < 32 ||
      String(config.JWT_REFRESH_SECRET).length < 32
    ) {
      throw new Error('Producción requiere secretos JWT aleatorios de al menos 32 caracteres');
    }

    if (String(config.DATABASE_URL).includes('sakila-demo-pw-change-me')) {
      throw new Error('Producción no permite la contraseña de base de datos de demostración');
    }

    if (config.CORS_ORIGIN === '*') {
      throw new Error('Producción no permite CORS con origen "*"');
    }

    if (config.REQUIRE_REAL_SIAT === 'true' && siatMode !== 'real') {
      throw new Error('REQUIRE_REAL_SIAT=true exige SIAT_MODE=real');
    }
    if (siatMode === 'real') {
      const realRequired = ['SIAT_BASE_URL', 'SIAT_CLIENT_ID', 'SIAT_CLIENT_SECRET'];
      const realMissing = realRequired.filter((key) => !config[key]);
      if (realMissing.length > 0) {
        throw new Error(`SIAT_MODE=real requiere: ${realMissing.join(', ')}`);
      }
      if (config.SIAT_CONTRACTS_VERIFIED !== 'true') {
        throw new Error(
          'SIAT_MODE=real exige SIAT_CONTRACTS_VERIFIED=true con contratos oficiales verificados',
        );
      }
    }
  }

  if (siatMode === 'real' && !fs.existsSync(config.SIAT_CERTIFICATE_PATH || '')) {
    // No se usa el certificado en el adaptador actual (bloqueado), pero se avisa
    // de que la configuración está incompleta sin revelar rutas ni secretos.
    config.SIAT_CERTIFICATE_WARNING = 'Ruta de certificado no disponible';
  }

  return {
    ...config,
    SIAT_MODE: siatMode,
    SIGNATURE_PROVIDER: signatureProvider,
    NODE_ENV: config.NODE_ENV || 'development',
  };
}
