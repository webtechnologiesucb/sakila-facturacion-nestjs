import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { XMLValidator } from 'fast-xml-parser';
import { createHash } from 'crypto';

export const SIMULATED_XML_PROFILE = 'SAKILA-SIMULATED-FACTURA-V1';

export interface InvoiceXmlItem {
  lineNumber: number;
  description: string;
  productCode?: string | null;
  unitOfMeasure: string;
  quantity: string | number;
  unitPrice: string | number;
  discount: string | number;
  lineSubtotal: string | number;
  taxRate: string | number;
  taxAmount: string | number;
  lineTotal: string | number;
}

export interface InvoiceXmlData {
  publicId: string;
  documentType: string;
  documentSector: string;
  serie: string;
  number: number;
  cuf: string;
  cufd?: string | null;
  cuis?: string | null;
  controlCode?: string | null;
  issueDate: Date;
  currency: string;
  exchangeRate: string | number;
  issuer: {
    nit: string;
    legalName: string;
    businessName?: string | null;
    economicActivityCode?: string | null;
    address: string;
    phone?: string | null;
    email?: string | null;
  };
  branch: {
    code: string;
    name: string;
    address: string;
    municipality?: string | null;
  };
  pointOfSale: { code: string; name: string };
  customer: {
    documentType: string;
    documentNumber: string;
    businessName: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  items: InvoiceXmlItem[];
  subtotal: string | number;
  discountTotal: string | number;
  taxableBase: string | number;
  taxTotal: string | number;
  total: string | number;
  simulated: boolean;
  modality?: string;
  environment?: string;
}

export interface GeneratedXml {
  xml: string;
  hash: string;
  profileId: string;
  xsdVersion: string | null;
  xsdValidated: boolean;
  wellFormed: boolean;
  simulated: boolean;
}

@Injectable()
export class XmlGenerationService {
  private readonly logger = new Logger(XmlGenerationService.name);

  generate(data: InvoiceXmlData): GeneratedXml {
    if (!data.items || data.items.length === 0) {
      throw new InternalServerErrorException('No se puede generar XML sin líneas de factura');
    }

    const xml = this.buildXml(data);
    const wellFormed = XMLValidator.validate(xml) === true;
    if (!wellFormed) {
      this.logger.error('El XML generado no es bien formado');
      throw new InternalServerErrorException('El XML generado no es bien formado');
    }

    return {
      xml,
      hash: createHash('sha256').update(xml, 'utf8').digest('hex'),
      profileId: SIMULATED_XML_PROFILE,
      // No hay XSD oficial verificado en este repositorio.
      xsdVersion: null,
      xsdValidated: false,
      wellFormed,
      simulated: true,
    };
  }

  private buildXml(data: InvoiceXmlData): string {
    const lines = data.items
      .map(
        (item) => `      <detalle linea="${item.lineNumber}">
        <descripcion>${escapeXml(item.description)}</descripcion>
        <codigoProducto>${escapeXml(item.productCode ?? '')}</codigoProducto>
        <unidadMedida>${escapeXml(item.unitOfMeasure)}</unidadMedida>
        <cantidad>${item.quantity}</cantidad>
        <precioUnitario>${item.unitPrice}</precioUnitario>
        <montoDescuento>${item.discount}</montoDescuento>
        <subTotal>${item.lineSubtotal}</subTotal>
        <tasaImpuesto>${item.taxRate}</tasaImpuesto>
        <montoImpuesto>${item.taxAmount}</montoImpuesto>
        <totalLinea>${item.lineTotal}</totalLinea>
      </detalle>`,
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!-- PERFIL SIMULADO ${SIMULATED_XML_PROFILE}. NO ES UN XML OFICIAL DEL SIN. -->
<!-- Estructura académica de referencia. No usar para emitir documentos fiscales reales. -->
<facturaSimulada xmlns="urn:sakila:facturacion:simulated:factura:v1">
  <avisoLegal>Documento simulado sin validez tributaria. Falta validación contra XSD y XMLDSig oficiales.</avisoLegal>
  <cabecera>
    <identificador>${escapeXml(data.publicId)}</identificador>
    <tipoDocumento>${escapeXml(data.documentType)}</tipoDocumento>
    <codigoDocumentoSector>${escapeXml(data.documentSector)}</codigoDocumentoSector>
    <serie>${escapeXml(data.serie)}</serie>
    <numero>${data.number}</numero>
    <cuf>${escapeXml(data.cuf)}</cuf>
    <cufd>${escapeXml(data.cufd ?? '')}</cufd>
    <cuis>${escapeXml(data.cuis ?? '')}</cuis>
    <codigoControl>${escapeXml(data.controlCode ?? '')}</codigoControl>
    <fechaEmision>${escapeXml(data.issueDate.toISOString())}</fechaEmision>
    <moneda>${escapeXml(data.currency)}</moneda>
    <tipoCambio>${data.exchangeRate}</tipoCambio>
    <modalidad>${escapeXml(data.modality ?? 'SIMULADA')}</modalidad>
    <ambiente>${escapeXml(data.environment ?? 'SIMULATED')}</ambiente>
  </cabecera>
  <emisor>
    <nitEmisor>${escapeXml(data.issuer.nit)}</nitEmisor>
    <razonSocialEmisor>${escapeXml(data.issuer.legalName)}</razonSocialEmisor>
    <nombreComercial>${escapeXml(data.issuer.businessName ?? '')}</nombreComercial>
    <actividadEconomica>${escapeXml(data.issuer.economicActivityCode ?? '')}</actividadEconomica>
    <direccion>${escapeXml(data.issuer.address)}</direccion>
    <telefono>${escapeXml(data.issuer.phone ?? '')}</telefono>
    <correo>${escapeXml(data.issuer.email ?? '')}</correo>
    <sucursal>
      <codigo>${escapeXml(data.branch.code)}</codigo>
      <nombre>${escapeXml(data.branch.name)}</nombre>
      <direccion>${escapeXml(data.branch.address)}</direccion>
      <municipio>${escapeXml(data.branch.municipality ?? '')}</municipio>
    </sucursal>
    <puntoVenta>
      <codigo>${escapeXml(data.pointOfSale.code)}</codigo>
      <nombre>${escapeXml(data.pointOfSale.name)}</nombre>
    </puntoVenta>
  </emisor>
  <adquirente>
    <codigoTipoDocumentoIdentidad>${escapeXml(data.customer.documentType)}</codigoTipoDocumentoIdentidad>
    <numeroDocumento>${escapeXml(data.customer.documentNumber)}</numeroDocumento>
    <nombreRazonSocial>${escapeXml(data.customer.businessName)}</nombreRazonSocial>
    <correo>${escapeXml(data.customer.email ?? '')}</correo>
    <telefono>${escapeXml(data.customer.phone ?? '')}</telefono>
    <direccion>${escapeXml(data.customer.address ?? '')}</direccion>
  </adquirente>
  <detalles>
${lines}
  </detalles>
  <totales>
    <subTotal>${data.subtotal}</subTotal>
    <descuentoTotal>${data.discountTotal}</descuentoTotal>
    <baseImponible>${data.taxableBase}</baseImponible>
    <impuestoTotal>${data.taxTotal}</impuestoTotal>
    <total>${data.total}</total>
  </totales>
  <observaciones>XML simulado. No certificado por el SIN. No apto para producción.</observaciones>
</facturaSimulada>`;
  }
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
