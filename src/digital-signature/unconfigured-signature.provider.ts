import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SignatureProvider, SignatureResult } from './signature.types';

/**
 * Proveedor de firma real deshabilitado. No se inventan claves ni formatos
 * XMLDSig. Requiere certificado, clave privada y contrato oficial verificado.
 */
@Injectable()
export class UnconfiguredSignatureProvider implements SignatureProvider {
  readonly name = 'unconfigured-signature';
  readonly simulated = false;

  async sign(_xml: string): Promise<SignatureResult> {
    throw new ServiceUnavailableException(
      'La firma digital real no está configurada. Use SIGNATURE_PROVIDER=simulated para el prototipo. ' +
        'La implementación XMLDSig oficial requiere certificado y contrato verificado.',
    );
  }
}
