<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import AppModal from '../components/AppModal.vue';
import JsonBlock from '../components/JsonBlock.vue';
import PaginationBar from '../components/PaginationBar.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, errorMessage, type CreateProductPayload } from '../lib/api';
import { formatMoney } from '../lib/format';
import { canWrite } from '../lib/session';
import { notify } from '../lib/toast';
import type { Pagination, Product, ProductCategory } from '../types';

const tab = ref<'products' | 'categories'>('products');
const writable = computed(() => canWrite());

const products = ref<Product[]>([]);
const categories = ref<ProductCategory[]>([]);
const pagination = ref<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 1 });
const loading = ref(false);
const loadingCategories = ref(false);
const error = ref('');
const search = ref('');
const categoryFilter = ref('');
const activeFilter = ref('');

const productModal = ref(false);
const productSaving = ref(false);
const editingProduct = ref<Product | null>(null);
const selectedProduct = ref<Product | null>(null);

const categoryModal = ref(false);
const categorySaving = ref(false);
const editingCategory = ref<ProductCategory | null>(null);

const productForm = reactive({
  categoryId: '',
  sku: '',
  name: '',
  description: '',
  unitOfMeasure: 'UNIDAD',
  unitPrice: '',
  taxCode: 'IVA',
  taxRate: '0.130000',
  taxIncluded: false,
  sakilaFilmId: '',
  active: true,
});

const categoryForm = reactive({
  name: '',
  sakilaCategoryId: '',
  active: true,
});

function resetProductForm(): void {
  productForm.categoryId = categories.value[0]?.id ?? '';
  productForm.sku = '';
  productForm.name = '';
  productForm.description = '';
  productForm.unitOfMeasure = 'UNIDAD';
  productForm.unitPrice = '';
  productForm.taxCode = 'IVA';
  productForm.taxRate = '0.130000';
  productForm.taxIncluded = false;
  productForm.sakilaFilmId = '';
  productForm.active = true;
}

function openCreateProduct(): void {
  editingProduct.value = null;
  resetProductForm();
  productModal.value = true;
}

function openEditProduct(product: Product): void {
  editingProduct.value = product;
  productForm.categoryId = product.categoryId;
  productForm.sku = product.sku;
  productForm.name = product.name;
  productForm.description = product.description || '';
  productForm.unitOfMeasure = product.unitOfMeasure;
  productForm.unitPrice = product.unitPrice;
  productForm.taxCode = product.taxCode || '';
  productForm.taxRate = product.taxRate;
  productForm.taxIncluded = product.taxIncluded;
  productForm.sakilaFilmId = product.sakilaFilmId ? String(product.sakilaFilmId) : '';
  productForm.active = product.active;
  productModal.value = true;
}

async function loadProducts(page = pagination.value.page): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const result = await api.products.list({
      page,
      limit: pagination.value.limit,
      search: search.value.trim() || undefined,
      categoryId: categoryFilter.value || undefined,
      active: activeFilter.value || undefined,
    });
    products.value = result.data;
    pagination.value = result.pagination;
  } catch (caught) {
    error.value = errorMessage(caught);
    notify(error.value, 'error');
  } finally {
    loading.value = false;
  }
}

async function loadCategories(): Promise<void> {
  loadingCategories.value = true;
  try {
    categories.value = await api.categories.list();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    loadingCategories.value = false;
  }
}

async function saveProduct(): Promise<void> {
  if (!productForm.categoryId) {
    notify('Seleccione una categoría fiscal.', 'warning');
    return;
  }
  if (!productForm.sku.trim() || !productForm.name.trim() || !productForm.unitPrice) {
    notify('SKU, nombre y precio unitario son obligatorios.', 'warning');
    return;
  }
  const payload: CreateProductPayload = {
    categoryId: productForm.categoryId,
    sku: productForm.sku.trim(),
    name: productForm.name.trim(),
    unitOfMeasure: productForm.unitOfMeasure.trim() || 'UNIDAD',
    unitPrice: productForm.unitPrice,
    taxRate: productForm.taxRate || '0',
    taxIncluded: productForm.taxIncluded,
    active: productForm.active,
  };
  if (productForm.description.trim()) payload.description = productForm.description.trim();
  if (productForm.taxCode.trim()) payload.taxCode = productForm.taxCode.trim();
  if (productForm.sakilaFilmId.trim()) payload.sakilaFilmId = Number(productForm.sakilaFilmId);

  productSaving.value = true;
  try {
    if (editingProduct.value) {
      await api.products.update(editingProduct.value.id, payload);
      notify('Producto actualizado.', 'success');
    } else {
      await api.products.create(payload);
      notify('Producto fiscal creado.', 'success');
    }
    productModal.value = false;
    await loadProducts(editingProduct.value ? pagination.value.page : 1);
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    productSaving.value = false;
  }
}

function openCreateCategory(): void {
  editingCategory.value = null;
  categoryForm.name = '';
  categoryForm.sakilaCategoryId = '';
  categoryForm.active = true;
  categoryModal.value = true;
}

function openEditCategory(category: ProductCategory): void {
  editingCategory.value = category;
  categoryForm.name = category.name;
  categoryForm.sakilaCategoryId = category.sakilaCategoryId
    ? String(category.sakilaCategoryId)
    : '';
  categoryForm.active = category.active;
  categoryModal.value = true;
}

async function saveCategory(): Promise<void> {
  if (!categoryForm.name.trim()) {
    notify('El nombre de la categoría es obligatorio.', 'warning');
    return;
  }
  const payload = {
    name: categoryForm.name.trim(),
    active: categoryForm.active,
    ...(categoryForm.sakilaCategoryId.trim()
      ? { sakilaCategoryId: Number(categoryForm.sakilaCategoryId) }
      : {}),
  };
  categorySaving.value = true;
  try {
    if (editingCategory.value) {
      await api.categories.update(editingCategory.value.id, payload);
      notify('Categoría actualizada.', 'success');
    } else {
      await api.categories.create(payload);
      notify('Categoría creada.', 'success');
    }
    categoryModal.value = false;
    await loadCategories();
    await loadProducts();
  } catch (caught) {
    notify(errorMessage(caught), 'error');
  } finally {
    categorySaving.value = false;
  }
}

onMounted(async () => {
  await loadCategories();
  await loadProducts(1);
});
</script>

<template>
  <div class="section-stack">
    <div class="row">
      <div>
        <h2 style="font-size: 17px; letter-spacing: -0.02em">Productos y categorías</h2>
        <p class="hint">Precios y tasas son datos configurables del prototipo, no constantes oficiales.</p>
      </div>
      <div class="spacer" />
      <div class="tabs">
        <button class="tab" :class="{ active: tab === 'products' }" type="button" @click="tab = 'products'">
          Productos
        </button>
        <button class="tab" :class="{ active: tab === 'categories' }" type="button" @click="tab = 'categories'">
          Categorías
        </button>
      </div>
    </div>

    <template v-if="tab === 'products'">
      <section class="card">
        <div class="card-body">
          <div class="filter-bar">
            <div class="field grow">
              <label for="product-search">Buscar</label>
              <input
                id="product-search"
                v-model="search"
                placeholder="SKU o nombre"
                @keyup.enter="loadProducts(1)"
              />
            </div>
            <div class="field">
              <label for="product-category">Categoría</label>
              <select id="product-category" v-model="categoryFilter">
                <option value="">Todas</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </div>
            <div class="field">
              <label for="product-active">Estado</label>
              <select id="product-active" v-model="activeFilter">
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>
            <button class="btn btn-primary" type="button" @click="loadProducts(1)">Buscar</button>
            <button
              class="btn btn-secondary"
              type="button"
              @click="search = ''; categoryFilter = ''; activeFilter = ''; loadProducts(1)"
            >
              Limpiar
            </button>
            <div class="spacer" />
            <button v-if="writable" class="btn btn-primary" type="button" @click="openCreateProduct">
              + Nuevo producto
            </button>
          </div>
        </div>
      </section>

      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <section class="card">
        <header class="card-header">
          <div class="card-title"><h2>Catálogo fiscal</h2><p>{{ pagination.total }} producto(s)</p></div>
          <button class="btn btn-ghost btn-sm" type="button" @click="loadProducts()">↻ Recargar</button>
        </header>

        <div v-if="loading" class="loading-row"><span class="spinner" /> Consultando productos…</div>
        <div v-else-if="products.length === 0" class="empty">
          <strong>Sin productos</strong>
          Cree un producto fiscal o revise los filtros.
        </div>

        <template v-else>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th class="num">Precio</th>
                  <th class="num">Tasa</th>
                  <th>Impuesto incluido</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="product in products" :key="product.id">
                  <td class="mono">{{ product.sku }}</td>
                  <td>
                    <div>{{ product.name }}</div>
                    <div class="hint">{{ product.unitOfMeasure }}</div>
                  </td>
                  <td>{{ product.category?.name || '—' }}</td>
                  <td class="num">{{ formatMoney(product.unitPrice) }}</td>
                  <td class="num">{{ (Number(product.taxRate) * 100).toFixed(2) }} %</td>
                  <td>{{ product.taxIncluded ? 'Sí' : 'No' }}</td>
                  <td>
                    <StatusBadge
                      :status="product.active ? 'ACTIVO' : 'INACTIVO'"
                      :tone="product.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td class="actions-cell">
                    <button class="link-button" type="button" @click="selectedProduct = product">Ver</button>
                    <button v-if="writable" class="link-button" type="button" @click="openEditProduct(product)">
                      Editar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <PaginationBar
            :page="pagination.page"
            :total-pages="pagination.totalPages"
            :total="pagination.total"
            :limit="pagination.limit"
            @update:page="loadProducts"
          />
        </template>
      </section>
    </template>

    <template v-else>
      <section class="card">
        <header class="card-header">
          <div class="card-title"><h2>Categorías fiscales</h2><p>{{ categories.length }} categoría(s)</p></div>
          <div class="row">
            <button class="btn btn-ghost btn-sm" type="button" @click="loadCategories">↻ Recargar</button>
            <button v-if="writable" class="btn btn-primary btn-sm" type="button" @click="openCreateCategory">
              + Nueva categoría
            </button>
          </div>
        </header>

        <div v-if="loadingCategories" class="loading-row"><span class="spinner" /> Consultando categorías…</div>
        <div v-else-if="categories.length === 0" class="empty">
          <strong>Sin categorías</strong>
          Cree una categoría antes de registrar productos.
        </div>

        <div v-else class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Sakila</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="category in categories" :key="category.id">
                <td>{{ category.name }}</td>
                <td class="mono">{{ category.sakilaCategoryId ?? '—' }}</td>
                <td>
                  <StatusBadge
                    :status="category.active ? 'ACTIVO' : 'INACTIVO'"
                    :tone="category.active ? 'success' : 'neutral'"
                  />
                </td>
                <td class="actions-cell">
                  <button v-if="writable" class="link-button" type="button" @click="openEditCategory(category)">
                    Editar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <AppModal
      :open="productModal"
      :title="editingProduct ? 'Editar producto' : 'Nuevo producto fiscal'"
      wide
      @close="productModal = false"
    >
      <div class="form-grid cols-3">
        <div class="field span-2">
          <label for="p-name">Nombre</label>
          <input id="p-name" v-model="productForm.name" maxlength="250" />
        </div>
        <div class="field">
          <label for="p-sku">SKU</label>
          <input id="p-sku" v-model="productForm.sku" maxlength="60" placeholder="SRV-001" />
        </div>
        <div class="field span-2">
          <label for="p-category">Categoría</label>
          <select id="p-category" v-model="productForm.categoryId">
            <option value="" disabled>Seleccione categoría</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ category.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="p-unit">Unidad de medida</label>
          <input id="p-unit" v-model="productForm.unitOfMeasure" maxlength="20" />
        </div>
        <div class="field span-full">
          <label for="p-description">Descripción</label>
          <textarea id="p-description" v-model="productForm.description" maxlength="4000" />
        </div>
        <div class="field">
          <label for="p-price">Precio unitario</label>
          <input id="p-price" v-model="productForm.unitPrice" type="number" min="0" step="any" />
        </div>
        <div class="field">
          <label for="p-tax-code">Código tributario</label>
          <input id="p-tax-code" v-model="productForm.taxCode" maxlength="40" />
        </div>
        <div class="field">
          <label for="p-tax-rate">Tasa (decimal)</label>
          <input id="p-tax-rate" v-model="productForm.taxRate" type="number" min="0" max="1" step="0.000001" />
        </div>
        <div class="field">
          <label for="p-sakila">Película Sakila (opcional)</label>
          <input id="p-sakila" v-model="productForm.sakilaFilmId" type="number" min="1" />
        </div>
        <div class="field span-2">
          <div class="checkbox-row" style="margin-top: 22px">
            <input id="p-tax-included" v-model="productForm.taxIncluded" type="checkbox" />
            <label for="p-tax-included">El precio ya incluye impuesto</label>
          </div>
          <div class="checkbox-row" style="margin-top: 10px">
            <input id="p-active" v-model="productForm.active" type="checkbox" />
            <label for="p-active">Producto activo</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="productModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="productSaving" @click="saveProduct">
          <span v-if="productSaving" class="spinner" />
          {{ editingProduct ? 'Guardar cambios' : 'Crear producto' }}
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="categoryModal"
      :title="editingCategory ? 'Editar categoría' : 'Nueva categoría'"
      @close="categoryModal = false"
    >
      <div class="form-grid">
        <div class="field span-full">
          <label for="c-name">Nombre</label>
          <input id="c-name" v-model="categoryForm.name" maxlength="120" />
        </div>
        <div class="field">
          <label for="c-sakila">Categoría Sakila (opcional)</label>
          <input id="c-sakila" v-model="categoryForm.sakilaCategoryId" type="number" min="1" />
        </div>
        <div class="field">
          <div class="checkbox-row" style="margin-top: 22px">
            <input id="c-active" v-model="categoryForm.active" type="checkbox" />
            <label for="c-active">Categoría activa</label>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn btn-secondary" type="button" @click="categoryModal = false">Cancelar</button>
        <button class="btn btn-primary" type="button" :disabled="categorySaving" @click="saveCategory">
          <span v-if="categorySaving" class="spinner" />
          Guardar
        </button>
      </template>
    </AppModal>

    <AppModal
      :open="selectedProduct !== null"
      title="Producto fiscal"
      :subtitle="selectedProduct?.id"
      wide
      @close="selectedProduct = null"
    >
      <div v-if="selectedProduct">
        <dl class="kv">
          <dt>SKU</dt><dd class="mono">{{ selectedProduct.sku }}</dd>
          <dt>Nombre</dt><dd>{{ selectedProduct.name }}</dd>
          <dt>Categoría</dt><dd>{{ selectedProduct.category?.name || '—' }}</dd>
          <dt>Unidad</dt><dd>{{ selectedProduct.unitOfMeasure }}</dd>
          <dt>Precio</dt><dd>{{ formatMoney(selectedProduct.unitPrice) }}</dd>
          <dt>Tasa</dt><dd>{{ (Number(selectedProduct.taxRate) * 100).toFixed(4) }} %</dd>
          <dt>Impuesto incluido</dt><dd>{{ selectedProduct.taxIncluded ? 'Sí' : 'No' }}</dd>
          <dt>Película Sakila</dt><dd>{{ selectedProduct.sakilaFilm?.title || '—' }}</dd>
          <dt>Descripción</dt><dd>{{ selectedProduct.description || '—' }}</dd>
        </dl>
        <div class="divider" />
        <JsonBlock :value="selectedProduct" title="Respuesta JSON" />
      </div>
    </AppModal>
  </div>
</template>
