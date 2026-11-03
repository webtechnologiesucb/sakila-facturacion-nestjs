import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { SignatureProvider, SignatureResult } from './signature.types';

/**
 * Firma simulada: NO produce una firma XMLDSig válida ni usa certificados.
 * Añade un bloque claramente identificado con el hash del documento para que
 * el flujo sea verificable de punta a punta sin falsear una firma oficial.
 */
@Injectable()
export class SimulatedSignatureProvider implements SignatureProvider {
  readonly name = 'simulated-signature';
  readonly simulated = true;

  async sign(xml: string): Promise<SignatureResult> {
    const xmlHash = createHash('sha256').update(xml, 'utf8').digest('hex');
    const signedAt = new Date().toISOString();
    const block = `
  <firmaSimulada xmlns="urn:sakila:facturacion:simulated:signature:v1">
    <aviso>FIRMA SIMULADA. No es XMLDSig y no tiene validez legal.</aviso>
    <proveedor>${this.name}</proveedor>
    <hashDocumento>${xmlHash}</hashDocumento>
    <fechaFirma>${signedAt}</fechaFirma>
  </firmaSimulada>`;

    // Se inserta antes del cierre del documento para mantenerlo bien formado.
    const closingTag = '</facturaSimulada>';
    const insertionPoint = xml.lastIndexOf(closingTag);
    const signedXml =
      insertionPoint >= 0
        ? `${xml.slice(0, insertionPoint)}${block}\n${xml.slice(insertionPoint)}`
        : `${xml}\n${block}`;

    return {
      xml: signedXml,
      xmlHash: createHash('sha256').update(signedXml, 'utf8').digest('hex'),
      provider: this.name,
      status: 'FIRMADA_SIMULADA',
      signedAt,
      simulated: true,
      disclaimer: 'Firma simulada sin validez legal. XMLDSig oficial pendiente de implementación.',
    };
  }
}
