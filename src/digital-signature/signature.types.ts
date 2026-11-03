import { createHash } from 'crypto';

export const SIGNATURE_PROVIDER = Symbol('SIGNATURE_PROVIDER');

export interface SignatureResult {
  xml: string;
  xmlHash: string;
  provider: string;
  status: 'FIRMADA_SIMULADA' | 'FIRMADA';
  signedAt: string;
  simulated: boolean;
  disclaimer?: string;
}

export interface SignatureProvider {
  readonly name: string;
  readonly simulated: boolean;
  sign(xml: string): Promise<SignatureResult>;
}
