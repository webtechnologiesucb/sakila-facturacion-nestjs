-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BILLING', 'ANALYST', 'VIEWER');

-- CreateEnum
CREATE TYPE "TaxEnvironment" AS ENUM ('SIMULATED', 'TEST', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "TaxModality" AS ENUM ('ELECTRONICA_EN_LINEA', 'COMPUTARIZADA_EN_LINEA', 'PORTAL_WEB_EN_LINEA');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('BORRADOR', 'PENDIENTE_DE_VALIDACION', 'PENDIENTE_DE_ENVIO', 'EN_PROCESAMIENTO', 'AUTORIZADA', 'RECHAZADA', 'PENDIENTE_DE_ANULACION', 'ANULADA', 'EN_CONTINGENCIA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "ContingencyStatus" AS ENUM ('ABIERTA', 'CERRADA', 'REGULARIZADA');

-- CreateEnum
CREATE TYPE "CancellationStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'REVERTIDA');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('NO_REQUERIDA', 'PENDIENTE', 'FIRMADA_SIMULADA', 'FIRMADA');

-- CreateTable
CREATE TABLE "actor" (
    "actor_id" SERIAL NOT NULL,
    "first_name" VARCHAR(45) NOT NULL,
    "last_name" VARCHAR(45) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "actor_pkey" PRIMARY KEY ("actor_id")
);

-- CreateTable
CREATE TABLE "language" (
    "language_id" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_pkey" PRIMARY KEY ("language_id")
);

-- CreateTable
CREATE TABLE "category" (
    "category_id" SERIAL NOT NULL,
    "name" VARCHAR(25) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "country" (
    "country_id" SERIAL NOT NULL,
    "country" VARCHAR(50) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "country_pkey" PRIMARY KEY ("country_id")
);

-- CreateTable
CREATE TABLE "city" (
    "city_id" SERIAL NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "country_id" INTEGER NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "city_pkey" PRIMARY KEY ("city_id")
);

-- CreateTable
CREATE TABLE "address" (
    "address_id" SERIAL NOT NULL,
    "address" VARCHAR(50) NOT NULL,
    "address2" VARCHAR(50),
    "district" VARCHAR(20) NOT NULL,
    "city_id" INTEGER NOT NULL,
    "postal_code" VARCHAR(10),
    "phone" VARCHAR(20) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "address_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "store" (
    "store_id" SERIAL NOT NULL,
    "manager_staff_id" INTEGER,
    "address_id" INTEGER NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_pkey" PRIMARY KEY ("store_id")
);

-- CreateTable
CREATE TABLE "staff" (
    "staff_id" SERIAL NOT NULL,
    "first_name" VARCHAR(45) NOT NULL,
    "last_name" VARCHAR(45) NOT NULL,
    "address_id" INTEGER NOT NULL,
    "email" VARCHAR(50),
    "store_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "username" VARCHAR(16) NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "customer" (
    "customer_id" SERIAL NOT NULL,
    "store_id" INTEGER NOT NULL,
    "first_name" VARCHAR(45) NOT NULL,
    "last_name" VARCHAR(45) NOT NULL,
    "email" VARCHAR(50),
    "address_id" INTEGER NOT NULL,
    "activebool" BOOLEAN NOT NULL DEFAULT true,
    "create_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "film" (
    "film_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "release_year" INTEGER,
    "language_id" INTEGER NOT NULL,
    "rental_duration" INTEGER NOT NULL DEFAULT 3,
    "rental_rate" DECIMAL(5,2) NOT NULL DEFAULT 4.99,
    "length" INTEGER,
    "replacement_cost" DECIMAL(5,2) NOT NULL DEFAULT 19.99,
    "rating" VARCHAR(10) NOT NULL DEFAULT 'G',
    "special_features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "film_pkey" PRIMARY KEY ("film_id")
);

-- CreateTable
CREATE TABLE "film_actor" (
    "actor_id" INTEGER NOT NULL,
    "film_id" INTEGER NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "film_actor_pkey" PRIMARY KEY ("actor_id","film_id")
);

-- CreateTable
CREATE TABLE "film_category" (
    "film_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "film_category_pkey" PRIMARY KEY ("film_id","category_id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "inventory_id" SERIAL NOT NULL,
    "film_id" INTEGER NOT NULL,
    "store_id" INTEGER NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("inventory_id")
);

-- CreateTable
CREATE TABLE "rental" (
    "rental_id" SERIAL NOT NULL,
    "rental_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventory_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "return_date" TIMESTAMP(3),
    "staff_id" INTEGER NOT NULL,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_pkey" PRIMARY KEY ("rental_id")
);

-- CreateTable
CREATE TABLE "payment" (
    "payment_id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "rental_id" INTEGER,
    "amount" DECIMAL(8,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'VIEWER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_issuers" (
    "id" UUID NOT NULL,
    "nit" VARCHAR(20) NOT NULL,
    "legal_name" VARCHAR(250) NOT NULL,
    "business_name" VARCHAR(250),
    "economic_activity_code" VARCHAR(20),
    "address" TEXT NOT NULL,
    "phone" VARCHAR(40),
    "email" VARCHAR(150),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_branches" (
    "id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address" TEXT NOT NULL,
    "municipality" VARCHAR(120),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_points_of_sale" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_points_of_sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_customers" (
    "id" UUID NOT NULL,
    "sakila_customer_id" INTEGER,
    "document_type" VARCHAR(10) NOT NULL,
    "document_number" VARCHAR(30) NOT NULL,
    "business_name" VARCHAR(250) NOT NULL,
    "email" VARCHAR(150),
    "phone" VARCHAR(40),
    "address" TEXT,
    "taxpayer_type" VARCHAR(30),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_product_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "sakila_category_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_products" (
    "id" UUID NOT NULL,
    "sakila_film_id" INTEGER,
    "category_id" UUID NOT NULL,
    "sku" VARCHAR(60) NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "description" TEXT,
    "unit_of_measure" VARCHAR(20) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "tax_code" VARCHAR(40),
    "tax_rate" DECIMAL(9,6) NOT NULL,
    "tax_included" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_configurations" (
    "id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "version" INTEGER NOT NULL,
    "environment" "TaxEnvironment" NOT NULL DEFAULT 'SIMULATED',
    "modality" "TaxModality" NOT NULL DEFAULT 'ELECTRONICA_EN_LINEA',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BOB',
    "price_includes_tax" BOOLEAN NOT NULL DEFAULT false,
    "default_tax_rate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "rounding_mode" VARCHAR(30) NOT NULL DEFAULT 'ROUND_HALF_UP',
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "source_reference" TEXT NOT NULL,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verified_by" VARCHAR(150),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rules" (
    "id" UUID NOT NULL,
    "configuration_id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "tax_type" VARCHAR(30) NOT NULL,
    "rate" DECIMAL(9,6) NOT NULL,
    "source_reference" TEXT NOT NULL,
    "validation_status" "ValidationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoices" (
    "id" UUID NOT NULL,
    "public_id" VARCHAR(60) NOT NULL,
    "idempotency_key" VARCHAR(120) NOT NULL,
    "issuer_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "point_of_sale_id" UUID NOT NULL,
    "configuration_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_snapshot" JSONB NOT NULL,
    "contingency_id" UUID,
    "document_type" "DocumentType" NOT NULL DEFAULT 'FACTURA',
    "modality" "TaxModality" NOT NULL DEFAULT 'ELECTRONICA_EN_LINEA',
    "document_sector" VARCHAR(10) NOT NULL DEFAULT '1',
    "serie" VARCHAR(20) NOT NULL,
    "number" INTEGER NOT NULL,
    "cuf" VARCHAR(120),
    "cufd" VARCHAR(160),
    "cuis" VARCHAR(160),
    "control_code" VARCHAR(120),
    "issue_date" TIMESTAMP(3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BOB',
    "exchange_rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxable_base" DECIMAL(18,4) NOT NULL,
    "tax_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,4) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'BORRADOR',
    "tax_status" VARCHAR(60),
    "reception_code" VARCHAR(120),
    "authorization_code" VARCHAR(120),
    "document_hash" VARCHAR(128),
    "original_invoice_id" UUID,
    "simulated" BOOLEAN NOT NULL DEFAULT true,
    "frozen_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoice_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "product_id" UUID,
    "line_number" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "product_code" VARCHAR(80),
    "unit_of_measure" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "line_subtotal" DECIMAL(18,4) NOT NULL,
    "tax_rate" DECIMAL(9,6) NOT NULL,
    "tax_amount" DECIMAL(18,4) NOT NULL,
    "line_total" DECIMAL(18,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoice_events" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "from_status" "InvoiceStatus",
    "to_status" "InvoiceStatus",
    "actor_id" UUID,
    "correlation_id" VARCHAR(80),
    "message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_invoice_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoice_sequences" (
    "id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "point_of_sale_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "serie" VARCHAR(20) NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_invoice_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_invoice_documents" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "profile_id" VARCHAR(80) NOT NULL,
    "xml" TEXT NOT NULL,
    "xml_hash" VARCHAR(128) NOT NULL,
    "xsd_version" VARCHAR(60),
    "xsd_validated" BOOLEAN NOT NULL DEFAULT false,
    "signature_status" "SignatureStatus" NOT NULL DEFAULT 'PENDIENTE',
    "signed_at" TIMESTAMP(3),
    "signature_provider" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_invoice_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_cancellation_requests" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CancellationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "requested_by" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "response_code" VARCHAR(60),
    "response_message" TEXT,
    "reversal_of_id" UUID,

    CONSTRAINT "tax_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_siat_credentials" (
    "id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "environment" "TaxEnvironment" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "secret_ref" VARCHAR(200) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_siat_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_siat_requests" (
    "id" UUID NOT NULL,
    "invoice_id" UUID,
    "operation" VARCHAR(80) NOT NULL,
    "correlation_id" VARCHAR(80) NOT NULL,
    "idempotency_key" VARCHAR(120),
    "request_payload" JSONB,
    "response_payload" JSONB,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_code" VARCHAR(60),
    "message" TEXT,
    "http_status" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_siat_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_contingency_events" (
    "id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ContingencyStatus" NOT NULL DEFAULT 'ABIERTA',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "reported_at" TIMESTAMP(3),
    "event_code" VARCHAR(80),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_contingency_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(80),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(60),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "city_country_id_idx" ON "city"("country_id");

-- CreateIndex
CREATE INDEX "address_city_id_idx" ON "address"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "store_manager_staff_id_key" ON "store"("manager_staff_id");

-- CreateIndex
CREATE INDEX "store_address_id_idx" ON "store"("address_id");

-- CreateIndex
CREATE INDEX "staff_address_id_idx" ON "staff"("address_id");

-- CreateIndex
CREATE INDEX "staff_store_id_idx" ON "staff"("store_id");

-- CreateIndex
CREATE INDEX "customer_store_id_idx" ON "customer"("store_id");

-- CreateIndex
CREATE INDEX "customer_last_name_idx" ON "customer"("last_name");

-- CreateIndex
CREATE INDEX "film_title_idx" ON "film"("title");

-- CreateIndex
CREATE INDEX "inventory_film_id_idx" ON "inventory"("film_id");

-- CreateIndex
CREATE INDEX "inventory_store_id_idx" ON "inventory"("store_id");

-- CreateIndex
CREATE INDEX "rental_inventory_id_idx" ON "rental"("inventory_id");

-- CreateIndex
CREATE INDEX "rental_customer_id_idx" ON "rental"("customer_id");

-- CreateIndex
CREATE INDEX "rental_staff_id_idx" ON "rental"("staff_id");

-- CreateIndex
CREATE INDEX "payment_customer_id_idx" ON "payment"("customer_id");

-- CreateIndex
CREATE INDEX "payment_staff_id_idx" ON "payment"("staff_id");

-- CreateIndex
CREATE INDEX "payment_rental_id_idx" ON "payment"("rental_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "tax_issuers_nit_key" ON "tax_issuers"("nit");

-- CreateIndex
CREATE INDEX "tax_branches_issuer_id_idx" ON "tax_branches"("issuer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_branches_issuer_id_code_key" ON "tax_branches"("issuer_id", "code");

-- CreateIndex
CREATE INDEX "tax_points_of_sale_branch_id_idx" ON "tax_points_of_sale"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_points_of_sale_branch_id_code_key" ON "tax_points_of_sale"("branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_customers_sakila_customer_id_key" ON "tax_customers"("sakila_customer_id");

-- CreateIndex
CREATE INDEX "tax_customers_business_name_idx" ON "tax_customers"("business_name");

-- CreateIndex
CREATE UNIQUE INDEX "tax_customers_document_type_document_number_key" ON "tax_customers"("document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "tax_product_categories_sakila_category_id_key" ON "tax_product_categories"("sakila_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_products_sakila_film_id_key" ON "tax_products"("sakila_film_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_products_sku_key" ON "tax_products"("sku");

-- CreateIndex
CREATE INDEX "tax_products_category_id_idx" ON "tax_products"("category_id");

-- CreateIndex
CREATE INDEX "tax_products_name_idx" ON "tax_products"("name");

-- CreateIndex
CREATE INDEX "tax_configurations_issuer_id_active_idx" ON "tax_configurations"("issuer_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "tax_configurations_issuer_id_version_key" ON "tax_configurations"("issuer_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rules_configuration_id_code_key" ON "tax_rules"("configuration_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoices_public_id_key" ON "tax_invoices"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoices_idempotency_key_key" ON "tax_invoices"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoices_cuf_key" ON "tax_invoices"("cuf");

-- CreateIndex
CREATE INDEX "tax_invoices_issuer_id_issue_date_idx" ON "tax_invoices"("issuer_id", "issue_date");

-- CreateIndex
CREATE INDEX "tax_invoices_status_idx" ON "tax_invoices"("status");

-- CreateIndex
CREATE INDEX "tax_invoices_customer_id_idx" ON "tax_invoices"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoices_issuer_id_branch_id_point_of_sale_id_document__key" ON "tax_invoices"("issuer_id", "branch_id", "point_of_sale_id", "document_type", "serie", "number");

-- CreateIndex
CREATE INDEX "tax_invoice_items_invoice_id_idx" ON "tax_invoice_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoice_items_invoice_id_line_number_key" ON "tax_invoice_items"("invoice_id", "line_number");

-- CreateIndex
CREATE INDEX "tax_invoice_events_invoice_id_created_at_idx" ON "tax_invoice_events"("invoice_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoice_sequences_issuer_id_branch_id_point_of_sale_id__key" ON "tax_invoice_sequences"("issuer_id", "branch_id", "point_of_sale_id", "document_type", "serie");

-- CreateIndex
CREATE UNIQUE INDEX "tax_invoice_documents_invoice_id_key" ON "tax_invoice_documents"("invoice_id");

-- CreateIndex
CREATE INDEX "tax_cancellation_requests_invoice_id_requested_at_idx" ON "tax_cancellation_requests"("invoice_id", "requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "tax_siat_credentials_issuer_id_environment_label_key" ON "tax_siat_credentials"("issuer_id", "environment", "label");

-- CreateIndex
CREATE INDEX "tax_siat_requests_invoice_id_created_at_idx" ON "tax_siat_requests"("invoice_id", "created_at");

-- CreateIndex
CREATE INDEX "tax_siat_requests_correlation_id_idx" ON "tax_siat_requests"("correlation_id");

-- CreateIndex
CREATE INDEX "tax_siat_requests_operation_idx" ON "tax_siat_requests"("operation");

-- CreateIndex
CREATE INDEX "tax_contingency_events_issuer_id_status_idx" ON "tax_contingency_events"("issuer_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "city" ADD CONSTRAINT "city_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "country"("country_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "address_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "city"("city_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_manager_staff_id_fkey" FOREIGN KEY ("manager_staff_id") REFERENCES "staff"("staff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store" ADD CONSTRAINT "store_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "address"("address_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film" ADD CONSTRAINT "film_language_id_fkey" FOREIGN KEY ("language_id") REFERENCES "language"("language_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_actor" ADD CONSTRAINT "film_actor_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "actor"("actor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_actor" ADD CONSTRAINT "film_actor_film_id_fkey" FOREIGN KEY ("film_id") REFERENCES "film"("film_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_category" ADD CONSTRAINT "film_category_film_id_fkey" FOREIGN KEY ("film_id") REFERENCES "film"("film_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "film_category" ADD CONSTRAINT "film_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_film_id_fkey" FOREIGN KEY ("film_id") REFERENCES "film"("film_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "store"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental" ADD CONSTRAINT "rental_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "inventory"("inventory_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental" ADD CONSTRAINT "rental_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental" ADD CONSTRAINT "rental_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rental"("rental_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_branches" ADD CONSTRAINT "tax_branches_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "tax_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_points_of_sale" ADD CONSTRAINT "tax_points_of_sale_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tax_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_customers" ADD CONSTRAINT "tax_customers_sakila_customer_id_fkey" FOREIGN KEY ("sakila_customer_id") REFERENCES "customer"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_product_categories" ADD CONSTRAINT "tax_product_categories_sakila_category_id_fkey" FOREIGN KEY ("sakila_category_id") REFERENCES "category"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_products" ADD CONSTRAINT "tax_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "tax_product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_products" ADD CONSTRAINT "tax_products_sakila_film_id_fkey" FOREIGN KEY ("sakila_film_id") REFERENCES "film"("film_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configurations" ADD CONSTRAINT "tax_configurations_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "tax_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "tax_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "tax_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tax_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "tax_points_of_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "tax_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "tax_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_contingency_id_fkey" FOREIGN KEY ("contingency_id") REFERENCES "tax_contingency_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoices" ADD CONSTRAINT "tax_invoices_original_invoice_id_fkey" FOREIGN KEY ("original_invoice_id") REFERENCES "tax_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_items" ADD CONSTRAINT "tax_invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_items" ADD CONSTRAINT "tax_invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "tax_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_events" ADD CONSTRAINT "tax_invoice_events_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_events" ADD CONSTRAINT "tax_invoice_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_sequences" ADD CONSTRAINT "tax_invoice_sequences_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "tax_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_sequences" ADD CONSTRAINT "tax_invoice_sequences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "tax_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_sequences" ADD CONSTRAINT "tax_invoice_sequences_point_of_sale_id_fkey" FOREIGN KEY ("point_of_sale_id") REFERENCES "tax_points_of_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_invoice_documents" ADD CONSTRAINT "tax_invoice_documents_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_cancellation_requests" ADD CONSTRAINT "tax_cancellation_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_cancellation_requests" ADD CONSTRAINT "tax_cancellation_requests_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "tax_cancellation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_siat_credentials" ADD CONSTRAINT "tax_siat_credentials_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "tax_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_siat_requests" ADD CONSTRAINT "tax_siat_requests_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tax_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_contingency_events" ADD CONSTRAINT "tax_contingency_events_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "tax_issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
