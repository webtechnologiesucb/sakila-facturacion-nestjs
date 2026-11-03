import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from '../src/common/interceptors/timeout.interceptor';

describe('API de facturación (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let viewerToken: string;

  const ids: {
    issuerId?: string;
    branchId?: string;
    pointOfSaleId?: string;
    configurationId?: string;
    customerId?: string;
    productId?: string;
  } = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(json({ limit: '1mb' }));
    app.use(urlencoded({ extended: true, limit: '1mb' }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor(), new TimeoutInterceptor());
    await app.init();

    adminToken = await login('admin@sakila.demo', 'Admin123!Demo');
    viewerToken = await login('consulta@sakila.demo', 'Consulta123!Demo');

    const issuers = await request(app.getHttpServer())
      .get('/api/issuers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const issuer = issuers.body.data.find((item: any) => item.nit === '1234567890');
    expect(issuer).toBeDefined();
    ids.issuerId = issuer.id;
    ids.branchId = issuer.branches.find((branch: any) => branch.code === 'SUC-01').id;
    ids.pointOfSaleId = issuer.branches
      .find((branch: any) => branch.code === 'SUC-01')
      .pointsOfSale.find((pos: any) => pos.code === 'PV-01').id;

    const configurations = await request(app.getHttpServer())
      .get(`/api/tax-configurations?issuerId=${ids.issuerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    ids.configurationId = configurations.body.data.find((item: any) => item.version === 1).id;

    const customers = await request(app.getHttpServer())
      .get('/api/customers?search=9876543210')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    ids.customerId = customers.body.data.data[0].id;

    const products = await request(app.getHttpServer())
      .get('/api/products?search=SRV-001')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    ids.productId = products.body.data.data[0].id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function login(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.access_token;
  }

  function invoicePayload(overrides: Record<string, unknown> = {}) {
    return {
      issuerId: ids.issuerId,
      branchId: ids.branchId,
      pointOfSaleId: ids.pointOfSaleId,
      configurationId: ids.configurationId,
      customerId: ids.customerId,
      serie: 'A',
      idempotencyKey: `e2e-${randomUUID()}`,
      items: [{ productId: ids.productId, quantity: '2' }],
      ...overrides,
    };
  }

  it('expone health y readiness', async () => {
    const health = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(health.body.data.status).toBe('ok');
    const ready = await request(app.getHttpServer()).get('/api/ready').expect(200);
    expect(ready.body.data.ready).toBe(true);
  });

  it('protege endpoints sin token', async () => {
    await request(app.getHttpServer()).get('/api/invoices').expect(401);
    await request(app.getHttpServer()).post('/api/invoices').send({}).expect(401);
  });

  it('rechaza la creación de facturas a un usuario VIEWER', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send(invoicePayload())
      .expect(403);
  });

  it('crea una factura con cálculo correcto y respeta la idempotencia', async () => {
    const payload = invoicePayload();
    const first = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', payload.idempotencyKey)
      .send(payload)
      .expect(201);

    const created = first.body.data.invoice;
    expect(first.body.data.idempotent).toBe(false);
    expect(created.subtotal).toBe('200');
    expect(created.taxTotal).toBe('26');
    expect(created.total).toBe('226');
    expect(created.status).toBe('BORRADOR');
    expect(created.items).toHaveLength(1);

    const duplicate = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', payload.idempotencyKey)
      .send(payload)
      .expect(201);
    expect(duplicate.body.data.idempotent).toBe(true);
    expect(duplicate.body.data.invoice.id).toBe(created.id);
  });

  it('emite, genera XML firmado simulado y autoriza', async () => {
    const payload = invoicePayload();
    const created = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    const invoice = created.body.data.invoice;

    const emitted = await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/emit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(emitted.body.data.invoice.status).toBe('PENDIENTE_DE_ENVIO');
    expect(emitted.body.data.invoice.cuf).toMatch(/^SIM-CUF-/);
    expect(emitted.body.data.invoice.document.signatureStatus).toBe('FIRMADA_SIMULADA');
    expect(emitted.body.data.invoice.frozenAt).toBeTruthy();

    // Emitir de nuevo es idempotente y no regenera el documento.
    const emittedAgain = await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/emit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(emittedAgain.body.data.idempotent).toBe(true);

    const xml = await request(app.getHttpServer())
      .get(`/api/invoices/${invoice.id}/xml`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(xml.body.data.xml).toContain('<facturaSimulada');
    expect(xml.body.data.xml).toContain('firmaSimulada');
    expect(xml.body.data.xml).toContain('NO ES UN XML OFICIAL DEL SIN');
    expect(xml.body.data.hash).toMatch(/^[a-f0-9]{64}$/);

    const sent = await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/send`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(sent.body.data.result.success).toBe(true);
    expect(sent.body.data.invoice.status).toBe('AUTORIZADA');
    expect(sent.body.data.invoice.authorizationCode).toMatch(/^SIM-AUT-/);

    const resent = await request(app.getHttpServer())
      .post(`/api/invoices/${invoice.id}/send`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(resent.body.data.idempotent).toBe(true);
    expect(resent.body.data.invoice.status).toBe('AUTORIZADA');

    const detail = await request(app.getHttpServer())
      .get(`/api/invoices/${invoice.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.data.status).toBe('AUTORIZADA');
    expect(detail.body.data.events.length).toBeGreaterThanOrEqual(3);
  });

  it('anula y revierte una factura autorizada', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invoicePayload())
      .expect(201);
    const invoiceId = created.body.data.invoice.id;

    await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/emit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/send`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const cancellation = await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/cancellation-requests`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Anulación de prueba end-to-end por error en los datos' })
      .expect(201);
    expect(cancellation.body.data.request.status).toBe('APROBADA');
    const cancellationId = cancellation.body.data.request.id;

    const cancelled = await request(app.getHttpServer())
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(cancelled.body.data.status).toBe('ANULADA');

    const reversal = await request(app.getHttpServer())
      .post(`/api/cancellation-requests/${cancellationId}/reverse`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Reversión de prueba end-to-end autorizada por administración' })
      .expect(201);
    expect(reversal.body.data.reversal).toBeTruthy();

    const restored = await request(app.getHttpServer())
      .get(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(restored.body.data.status).toBe('AUTORIZADA');
  });

  it('reserva números únicos bajo creación concurrente', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/api/invoices')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(invoicePayload()),
      ),
    );
    responses.forEach((response) => expect(response.status).toBe(201));
    const numbers = responses.map((response) => response.body.data.invoice.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('rechaza facturas inválidas', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(
        invoicePayload({
          items: [{ productId: randomUUID(), quantity: '1' }],
        }),
      )
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invoicePayload({ items: [] }))
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invoicePayload({ items: [{ productId: ids.productId, quantity: '-1' }] }))
      .expect(400);
  });

  it('gestiona un evento de contingencia completo', async () => {
    const open = await request(app.getHttpServer())
      .get(`/api/contingencies?issuerId=${ids.issuerId}&status=ABIERTA`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    for (const event of open.body.data) {
      await request(app.getHttpServer())
        .post(`/api/contingencies/${event.id}/close`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);
    }

    const created = await request(app.getHttpServer())
      .post('/api/contingencies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        issuerId: ids.issuerId,
        type: 'CORTE_DE_INTERNET',
        description: 'Evento de contingencia de prueba end-to-end',
      })
      .expect(201);
    const eventId = created.body.data.id;

    const invoice = await request(app.getHttpServer())
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(invoicePayload({ contingencyId: eventId }))
      .expect(201);
    expect(invoice.body.data.invoice.status).toBe('EN_CONTINGENCIA');

    const closed = await request(app.getHttpServer())
      .post(`/api/contingencies/${eventId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    expect(closed.body.data.event.status).toBe('CERRADA');

    const reported = await request(app.getHttpServer())
      .post(`/api/contingencies/${eventId}/report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    expect(reported.body.data.event.status).toBe('REGULARIZADA');
  });

  it('proporciona reportes internos', async () => {
    const summary = await request(app.getHttpServer())
      .get(`/api/reports/summary?issuerId=${ids.issuerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(summary.body.data.allInvoices.count).toBeGreaterThan(0);

    const tax = await request(app.getHttpServer())
      .get(`/api/reports/tax?issuerId=${ids.issuerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(tax.body.data.rates)).toBe(true);

    const daily = await request(app.getHttpServer())
      .get(`/api/reports/daily?issuerId=${ids.issuerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(daily.body.data.days)).toBe(true);
  });

  it('registra auditoría de operaciones críticas', async () => {
    const audit = await request(app.getHttpServer())
      .get('/api/audit-logs?limit=100')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const actions = audit.body.data.data.map((entry: any) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['INVOICE_CREATE', 'INVOICE_EMIT', 'INVOICE_AUTHORIZED']),
    );
  });
});
