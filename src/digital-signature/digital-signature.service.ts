import { Inject, Injectable } from '@nestjs/common';
import { SIGNATURE_PROVIDER, SignatureProvider, SignatureResult } from './signature.types';

@Injectable()
export class DigitalSignatureService {
  constructor(
    @Inject(SIGNATURE_PROVIDER) private readonly provider: SignatureProvider,
  ) {}

  info() {
    return {
      name: this.provider.name,
      simulated: this.provider.simulated,
      disclaimer: this.provider.simulated
        ? 'Firma simulada. No es XMLDSig ni tiene validez legal.'
        : 'Firma real no configurada.',
    };
  }

  sign(xml: string): Promise<SignatureResult> {
    return this.provider.sign(xml);
  }
}
