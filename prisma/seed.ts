/**
 * Seed idempotente del prototipo.
 *
 * - Crea usuarios demo, emisor, sucursal, punto de venta, configuración
 *   tributaria versionada, reglas, categorías, productos y clientes.
 * - Crea un conjunto mínimo de datos Sakila SOLO como referencia comercial.
 * - Ninguna tabla Sakila se usa como documento fiscal.
 *
 * Las tasas y reglas son datos de DEMOSTRACIÓN con estado PENDING_VERIFICATION.
 * No se presentan como constantes oficiales del SIN.
 */
import {
  PrismaClient,
  TaxEnvironment,
  TaxModality,
  UserRole,
  ValidationStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const USERS = [
  {
    email: 'admin@sakila.demo',
    name: 'Administrador Demo',
    role: UserRole.ADMIN,
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin123!Demo',
  },
  {
    email: 'facturacion@sakila.demo',
    name: 'Facturación Demo',
    role: UserRole.BILLING,
    password: process.env.SEED_BILLING_PASSWORD || 'Facturacion123!Demo',
  },
  {
    email: 'analista@sakila.demo',
    name: 'Analista Demo',
    role: UserRole.ANALYST,
    password: process.env.SEED_ANALYST_PASSWORD || 'Analista123!Demo',
  },
  {
    email: 'consulta@sakila.demo',
    name: 'Consulta Demo',
    role: UserRole.VIEWER,
    password: process.env.SEED_VIEWER_PASSWORD || 'Consulta123!Demo',
  },
];

async function seedSakila() {
  const country =
    (await prisma.sakilaCountry.findFirst({ where: { country: 'Bolivia' } })) ??
    (await prisma.sakilaCountry.create({ data: { country: 'Bolivia' } }));

  const city =
    (await prisma.sakilaCity.findFirst({
      where: { city: 'La Paz', countryId: country.countryId },
    })) ??
    (await prisma.sakilaCity.create({
      data: { city: 'La Paz', countryId: country.countryId },
    }));

  const address =
    (await prisma.sakilaAddress.findFirst({
      where: { address: 'Av. Demo 123', cityId: city.cityId },
    })) ??
    (await prisma.sakilaAddress.create({
      data: {
        address: 'Av. Demo 123',
        district: 'La Paz',
        cityId: city.cityId,
        phone: '+59170000000',
      },
    }));

  let store = await prisma.sakilaStore.findFirst({ where: { addressId: address.addressId } });
  if (!store) {
    store = await prisma.sakilaStore.create({
      data: { addressId: address.addressId, managerStaffId: null },
    });
  }

  let staff = await prisma.sakilaStaff.findFirst({ where: { username: 'demo' } });
  if (!staff) {
    staff = await prisma.sakilaStaff.create({
      data: {
        firstName: 'Personal',
        lastName: 'Demo',
        addressId: address.addressId,
        email: 'staff.demo@sakila.local',
        storeId: store.storeId,
        username: 'demo',
        active: true,
      },
    });
  }
  if (!store.managerStaffId) {
    store = await prisma.sakilaStore.update({
      where: { storeId: store.storeId },
      data: { managerStaffId: staff.staffId },
    });
  }

  const language =
    (await prisma.sakilaLanguage.findFirst({ where: { name: 'Español' } })) ??
    (await prisma.sakilaLanguage.create({ data: { name: 'Español' } }));

  const category =
    (await prisma.sakilaCategory.findFirst({ where: { name: 'Documentales' } })) ??
    (await prisma.sakilaCategory.create({ data: { name: 'Documentales' } }));

  let film = await prisma.sakilaFilm.findFirst({ where: { title: 'Sakila: Documental Demo' } });
  if (!film) {
    film = await prisma.sakilaFilm.create({
      data: {
        title: 'Sakila: Documental Demo',
        description: 'Película de ejemplo usada solo como referencia comercial.',
        languageId: language.languageId,
        rentalDuration: 3,
        rentalRate: '9.99',
        replacementCost: '19.99',
        rating: 'G',
      },
    });
  }

  await prisma.sakilaFilmCategory.upsert({
    where: {
      filmId_categoryId: { filmId: film.filmId, categoryId: category.categoryId },
    },
    create: { filmId: film.filmId, categoryId: category.categoryId },
    update: {},
  });

  const sakilaCustomer =
    (await prisma.sakilaCustomer.findFirst({
      where: { email: 'cliente.demo@sakila.local', storeId: store.storeId },
    })) ??
    (await prisma.sakilaCustomer.create({
      data: {
        storeId: store.storeId,
        firstName: 'Cliente',
        lastName: 'Demo',
        email: 'cliente.demo@sakila.local',
        addressId: address.addressId,
        activebool: true,
      },
    }));

  return { store, staff, category, film, sakilaCustomer };
}

async function main() {
  // --------------------------------------------------------------------------
  // Usuarios demo
  // --------------------------------------------------------------------------
  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
        active: true,
      },
      update: {
        name: user.name,
        role: user.role,
        active: true,
      },
    });
  }

  // --------------------------------------------------------------------------
  // Sakila (referencia comercial)
  // --------------------------------------------------------------------------
  const sakila = await seedSakila();

  // --------------------------------------------------------------------------
  // Emisor, sucursal y punto de venta
  // --------------------------------------------------------------------------
  const issuer = await prisma.issuer.upsert({
    where: { nit: '1234567890' },
    create: {
      nit: '1234567890',
      legalName: 'Sakila Emisor Demo SRL',
      businessName: 'Sakila Demo',
      economicActivityCode: '620100',
      address: 'Av. Demo 123, La Paz',
      phone: '+59170000000',
      email: 'emisor@sakila.demo',
      active: true,
    },
    update: {
      legalName: 'Sakila Emisor Demo SRL',
      address: 'Av. Demo 123, La Paz',
      active: true,
    },
  });

  const branch = await prisma.branch.upsert({
    where: { issuerId_code: { issuerId: issuer.id, code: 'SUC-01' } },
    create: {
      issuerId: issuer.id,
      code: 'SUC-01',
      name: 'Sucursal Central',
      address: 'Av. Demo 123, La Paz',
      municipality: 'La Paz',
      active: true,
    },
    update: { name: 'Sucursal Central', address: 'Av. Demo 123, La Paz', active: true },
  });

  const pointOfSale = await prisma.pointOfSale.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'PV-01' } },
    create: { branchId: branch.id, code: 'PV-01', name: 'Caja 1', active: true },
    update: { name: 'Caja 1', active: true },
  });

  // --------------------------------------------------------------------------
  // Configuración tributaria versionada (DEMO, pendiente de verificación)
  // --------------------------------------------------------------------------
  const configuration = await prisma.taxConfiguration.upsert({
    where: { issuerId_version: { issuerId: issuer.id, version: 1 } },
    create: {
      issuerId: issuer.id,
      name: 'Configuración demo 2026',
      version: 1,
      environment: TaxEnvironment.SIMULATED,
      modality: TaxModality.ELECTRONICA_EN_LINEA,
      currency: 'BOB',
      priceIncludesTax: false,
      defaultTaxRate: '0.130000',
      roundingMode: 'ROUND_HALF_UP',
      sourceReference:
        'Configuración interna de demostración. No es una regla oficial verificada del SIN.',
      validationStatus: ValidationStatus.PENDING_VERIFICATION,
      notes:
        'Las tasas, redondeo y catálogos deben contrastarse con la normativa oficial vigente antes de cualquier uso real.',
      active: true,
    },
    update: { active: true },
  });

  await prisma.taxRule.upsert({
    where: { configurationId_code: { configurationId: configuration.id, code: 'IVA' } },
    create: {
      configurationId: configuration.id,
      code: 'IVA',
      name: 'Impuesto al Valor Agregado (valor demo)',
      taxType: 'IVA',
      rate: '0.130000',
      sourceReference:
        'Valor de demostración. Verificar la alícuota vigente y su aplicación en fuentes oficiales del SIN.',
      validationStatus: ValidationStatus.PENDING_VERIFICATION,
    },
    update: {
      rate: '0.130000',
      validationStatus: ValidationStatus.PENDING_VERIFICATION,
    },
  });

  await prisma.taxRule.upsert({
    where: { configurationId_code: { configurationId: configuration.id, code: 'EXENTO' } },
    create: {
      configurationId: configuration.id,
      code: 'EXENTO',
      name: 'Operación exenta / tasa cero (demo)',
      taxType: 'EXENTO',
      rate: '0.000000',
      sourceReference:
        'Regla interna de demostración. El tratamiento de exenciones debe verificarse en la normativa oficial.',
      validationStatus: ValidationStatus.PENDING_VERIFICATION,
    },
    update: { rate: '0.000000' },
  });

  // --------------------------------------------------------------------------
  // Categorías y productos fiscales
  // --------------------------------------------------------------------------
  const category = await prisma.productCategory.upsert({
    where: { sakilaCategoryId: sakila.category.categoryId },
    create: {
      name: 'Documentales Demo',
      sakilaCategoryId: sakila.category.categoryId,
      active: true,
    },
    update: { name: 'Documentales Demo', active: true },
  });

  const digitalCategory =
    (await prisma.productCategory.findFirst({ where: { name: 'Servicios Digitales Demo' } })) ??
    (await prisma.productCategory.create({
      data: { name: 'Servicios Digitales Demo', active: true },
    }));

  const product = await prisma.product.upsert({
    where: { sku: 'SRV-001' },
    create: {
      categoryId: digitalCategory.id,
      sku: 'SRV-001',
      name: 'Suscripción mensual demo',
      description: 'Producto de demostración para facturación electrónica simulada.',
      unitOfMeasure: 'UNIDAD',
      unitPrice: '100.0000',
      taxCode: 'IVA',
      taxRate: '0.130000',
      taxIncluded: false,
      active: true,
    },
    update: { unitPrice: '100.0000', taxRate: '0.130000', active: true },
  });

  const filmProduct = await prisma.product.upsert({
    where: { sku: 'FILM-001' },
    create: {
      categoryId: category.id,
      sakilaFilmId: sakila.film.filmId,
      sku: 'FILM-001',
      name: sakila.film.title,
      description: 'Producto de referencia vinculado a una película Sakila.',
      unitOfMeasure: 'UNIDAD',
      unitPrice: '9.9900',
      taxCode: 'IVA',
      taxRate: '0.130000',
      taxIncluded: false,
      active: true,
    },
    update: { name: sakila.film.title, unitPrice: '9.9900', active: true },
  });

  // --------------------------------------------------------------------------
  // Clientes fiscales
  // --------------------------------------------------------------------------
  const companyCustomer = await prisma.customer.upsert({
    where: {
      documentType_documentNumber: { documentType: 'NIT', documentNumber: '9876543210' },
    },
    create: {
      documentType: 'NIT',
      documentNumber: '9876543210',
      businessName: 'Cliente Empresa Demo SRL',
      email: 'cliente.empresa@demo.local',
      phone: '+59171111111',
      address: 'Calle Comercio 456, La Paz',
      taxpayerType: 'EMPRESA',
      active: true,
    },
    update: { businessName: 'Cliente Empresa Demo SRL', active: true },
  });

  const personCustomer = await prisma.customer.upsert({
    where: {
      documentType_documentNumber: { documentType: 'CI', documentNumber: '7654321' },
    },
    create: {
      sakilaCustomerId: sakila.sakilaCustomer.customerId,
      documentType: 'CI',
      documentNumber: '7654321',
      businessName: 'Cliente Persona Demo',
      email: 'cliente.demo@sakila.local',
      phone: '+59172222222',
      address: 'Av. Demo 123, La Paz',
      taxpayerType: 'PERSONA',
      active: true,
    },
    update: { businessName: 'Cliente Persona Demo', active: true },
  });

  console.log('Seed completado.');
  console.log(`Emisor: ${issuer.nit} (${issuer.legalName})`);
  console.log(`Sucursal: ${branch.code} / Punto de venta: ${pointOfSale.code}`);
  console.log(`Configuración: ${configuration.name} (v${configuration.version})`);
  console.log(`Productos: ${product.sku}, ${filmProduct.sku}`);
  console.log(`Clientes: ${companyCustomer.documentNumber}, ${personCustomer.documentNumber}`);
  console.log('Usuarios demo: admin@, facturacion@, analista@, consulta@ (dominio sakila.demo)');
  console.log('Las contraseñas demo se documentan en el README y deben cambiarse.');
}

main()
  .catch((error) => {
    console.error('Fallo al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
