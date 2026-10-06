import { randomUUID } from 'node:crypto';
import { DemoTenantSeed } from '@ciadelivery/branding';
import { APP_CONFIG, AppConfig, JsonLogger } from '@ciadelivery/shared';
import {
  STORES,
  Stores,
  TENANT_REPOSITORY,
  TenantRepository,
  runWithTenant,
} from '@ciadelivery/tenancy';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  CatalogScope,
  CategoryRecord,
  OptionGroupRecord,
  OptionRecord,
  ProductRecord,
} from './domain/catalog';
import { CATALOG, CatalogRepository } from './domain/catalog-repository';

const PIZZA_SLUG = 'pizzariadoze';

interface DemoOption {
  name: string;
  priceCents: number;
  sortOrder: number;
}

interface DemoGroup {
  name: string;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: readonly DemoOption[];
}

interface DemoProduct {
  name: string;
  priceCents: number;
  available: boolean;
  sortOrder: number;
  groups: readonly DemoGroup[];
}

const PIZZAS: readonly DemoProduct[] = [
  {
    name: 'Calabresa',
    priceCents: 4990,
    available: true,
    sortOrder: 0,
    groups: [
      {
        name: 'Tamanho',
        minSelect: 1,
        maxSelect: 1,
        sortOrder: 0,
        options: [
          { name: 'Média', priceCents: 0, sortOrder: 0 },
          { name: 'Grande', priceCents: 1000, sortOrder: 1 },
        ],
      },
      {
        name: 'Adicionais',
        minSelect: 0,
        maxSelect: 3,
        sortOrder: 1,
        options: [
          { name: 'Borda', priceCents: 800, sortOrder: 0 },
          { name: 'Extra queijo', priceCents: 600, sortOrder: 1 },
        ],
      },
    ],
  },
  {
    name: 'Esgotado',
    priceCents: 2990,
    available: false,
    sortOrder: 1,
    groups: [],
  },
];

@Injectable()
export class DemoCatalogSeed implements OnModuleInit {
  private readonly logger = new JsonLogger();

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TENANT_REPOSITORY) private readonly tenants: TenantRepository,
    @Inject(STORES) private readonly stores: Stores,
    @Inject(CATALOG) private readonly catalog: CatalogRepository,
    private readonly demoTenants: DemoTenantSeed,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.seedDemo) {
      return;
    }
    await this.demoTenants.ensureReady();

    const tenant = await this.tenants.findBySlug(PIZZA_SLUG);
    if (tenant === null) {
      throw new Error(`Demo tenant ${PIZZA_SLUG} was not created`);
    }
    const store = await this.stores.findByTenantId(tenant.id);
    if (store === null) {
      throw new Error(`Demo store for ${PIZZA_SLUG} was not created`);
    }

    await runWithTenant(tenant, () =>
      this.ensureMenu({ tenantId: tenant.id, storeId: store.id }),
    );
    this.logger.log(`Demo catalog ready ${PIZZA_SLUG}`, 'DemoCatalogSeed');
  }

  private async ensureMenu(scope: CatalogScope): Promise<void> {
    const category = await this.ensureCategory(scope);
    for (const product of PIZZAS) {
      await this.ensureProduct(scope, category.id, product);
    }
  }

  private async ensureCategory(scope: CatalogScope): Promise<CategoryRecord> {
    const existing = await this.findNamed(
      (page) => this.catalog.listCategories(scope, page),
      'Pizzas',
    );
    if (existing !== null) {
      if (existing.active) {
        return existing;
      }
      const active = { ...existing, active: true, updatedAt: new Date() };
      await this.catalog.updateCategory(active);
      return active;
    }

    const now = new Date();
    const category: CategoryRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      name: 'Pizzas',
      description: null,
      sortOrder: await this.catalog.nextCategorySort(scope),
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertCategory(category);
    return category;
  }

  private async ensureProduct(
    scope: CatalogScope,
    categoryId: string,
    demo: DemoProduct,
  ): Promise<void> {
    const found = await this.findNamed(
      (page) =>
        this.catalog.listProducts(scope, page, { nameQuery: demo.name }),
      demo.name,
    );
    const product =
      found === null
        ? await this.insertProduct(scope, categoryId, demo)
        : await this.alignProduct(found, categoryId, demo);

    const groups = await this.catalog.listGroups(scope, product.id);
    for (const demoGroup of demo.groups) {
      const current = groups.find((group) => group.name === demoGroup.name);
      const group =
        current === undefined
          ? await this.insertGroup(scope, product.id, demoGroup)
          : await this.alignGroup(current, demoGroup);
      const options = await this.catalog.listOptions(scope, group.id);
      for (const demoOption of demoGroup.options) {
        const option = options.find((candidate) => candidate.name === demoOption.name);
        if (option === undefined) {
          await this.insertOption(scope, group.id, demoOption);
        } else {
          await this.alignOption(option, demoOption);
        }
      }
    }
  }

  private async insertProduct(
    scope: CatalogScope,
    categoryId: string,
    demo: DemoProduct,
  ): Promise<ProductRecord> {
    const now = new Date();
    const product: ProductRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      categoryId,
      name: demo.name,
      description: null,
      priceCents: demo.priceCents,
      sku: null,
      imageKey: null,
      active: true,
      available: demo.available,
      sortOrder: demo.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertProduct(product);
    return product;
  }

  private async alignProduct(
    product: ProductRecord,
    categoryId: string,
    demo: DemoProduct,
  ): Promise<ProductRecord> {
    if (
      product.categoryId === categoryId &&
      product.priceCents === demo.priceCents &&
      product.active &&
      product.available === demo.available
    ) {
      return product;
    }
    const next = {
      ...product,
      categoryId,
      priceCents: demo.priceCents,
      active: true,
      available: demo.available,
      updatedAt: new Date(),
    };
    await this.catalog.updateProduct(next);
    return next;
  }

  private async insertGroup(
    scope: CatalogScope,
    productId: string,
    demo: DemoGroup,
  ): Promise<OptionGroupRecord> {
    const now = new Date();
    const group: OptionGroupRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      productId,
      name: demo.name,
      minSelect: demo.minSelect,
      maxSelect: demo.maxSelect,
      sortOrder: demo.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertGroup(group);
    return group;
  }

  private async alignGroup(
    group: OptionGroupRecord,
    demo: DemoGroup,
  ): Promise<OptionGroupRecord> {
    if (
      group.minSelect === demo.minSelect &&
      group.maxSelect === demo.maxSelect
    ) {
      return group;
    }
    const next = {
      ...group,
      minSelect: demo.minSelect,
      maxSelect: demo.maxSelect,
      updatedAt: new Date(),
    };
    await this.catalog.updateGroup(next);
    return next;
  }

  private async insertOption(
    scope: CatalogScope,
    groupId: string,
    demo: DemoOption,
  ): Promise<void> {
    const now = new Date();
    const option: OptionRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      storeId: scope.storeId,
      groupId,
      name: demo.name,
      priceCents: demo.priceCents,
      available: true,
      sortOrder: demo.sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    await this.catalog.insertOption(option);
  }

  private async alignOption(option: OptionRecord, demo: DemoOption): Promise<void> {
    if (option.priceCents === demo.priceCents && option.available) {
      return;
    }
    await this.catalog.updateOption({
      ...option,
      priceCents: demo.priceCents,
      available: true,
      updatedAt: new Date(),
    });
  }

  private async findNamed<T extends { name: string }>(
    load: (page: { page: number; pageSize: number }) => Promise<{
      data: T[];
      meta: { page: number; totalPages: number };
    }>,
    name: string,
  ): Promise<T | null> {
    let page = 1;
    for (;;) {
      const listed = await load({ page, pageSize: 100 });
      const found = listed.data.find((row) => row.name === name);
      if (found !== undefined) {
        return found;
      }
      if (page >= listed.meta.totalPages) {
        return null;
      }
      page += 1;
    }
  }
}
