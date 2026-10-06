import { randomUUID } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { TransactionContext, UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import {
  CatalogImportError,
  CatalogImportPlan,
  parseCatalogCsv,
} from '../domain/catalog-import';
import {
  CatalogScope,
  CategoryRecord,
  OptionGroupRecord,
  OptionRecord,
  ProductRecord,
} from '../domain/catalog';
import { CatalogRepository } from '../domain/catalog-repository';
import { requireActorStore } from './actor-store';

export interface CatalogCsvFile {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  size: number;
}

export interface CatalogImportSummary {
  rows: number;
  categories: number;
  products: number;
  optionGroups: number;
  options: number;
}

type StepMarker = {
  markDone(
    input: { tenantId: string; code: string; actorId: string | null },
    tx?: TransactionContext,
  ): Promise<void>;
};

export class ImportCatalog {
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly stores: CurrentStore,
    private readonly unitOfWork: UnitOfWork,
    private readonly steps: StepMarker,
  ) {}

  async execute(
    actor: RequestActor,
    file: CatalogCsvFile | undefined,
  ): Promise<CatalogImportSummary> {
    const content = csvContent(file);
    const parsed = parseCatalogCsv(content);
    if (!parsed.ok) {
      throw importFailed(parsed.errors);
    }
    if (parsed.plan.categories.length === 0) {
      throw importFailed([
        { line: 2, code: 'CSV_EMPTY', message: 'The CSV has no catalog rows' },
      ]);
    }
    const store = await requireActorStore(actor, this.stores);
    const scope = { tenantId: store.tenantId, storeId: store.id };
    return this.unitOfWork.run(async (tx) => {
      const summary = await this.persist(scope, parsed.plan, tx);
      await this.steps.markDone(
        {
          tenantId: store.tenantId,
          code: 'import_catalog',
          actorId: actor.userId,
        },
        tx,
      );
      return summary;
    });
  }

  private async persist(
    scope: CatalogScope,
    plan: CatalogImportPlan,
    tx: TransactionContext,
  ): Promise<CatalogImportSummary> {
    const now = new Date();
    const summary: CatalogImportSummary = {
      rows: plan.rowCount,
      categories: 0,
      products: 0,
      optionGroups: 0,
      options: 0,
    };
    let categorySort = await this.catalog.nextCategorySort(scope, tx);
    for (const importedCategory of plan.categories) {
      const category: CategoryRecord = {
        id: randomUUID(),
        tenantId: scope.tenantId,
        storeId: scope.storeId,
        name: importedCategory.name,
        description: null,
        sortOrder: categorySort,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      categorySort += 1;
      await this.catalog.insertCategory(category, tx);
      summary.categories += 1;

      let productSort = await this.catalog.nextProductSort(scope, category.id, tx);
      for (const importedProduct of importedCategory.products) {
        const product: ProductRecord = {
          id: randomUUID(),
          tenantId: scope.tenantId,
          storeId: scope.storeId,
          categoryId: category.id,
          name: importedProduct.name,
          description: importedProduct.description,
          priceCents: importedProduct.priceCents,
          sku: importedProduct.sku,
          imageKey: null,
          active: true,
          available: true,
          sortOrder: productSort,
          createdAt: now,
          updatedAt: now,
        };
        productSort += 1;
        await this.catalog.insertProduct(product, tx);
        summary.products += 1;

        let groupSort = 0;
        for (const importedGroup of importedProduct.optionGroups) {
          const group: OptionGroupRecord = {
            id: randomUUID(),
            tenantId: scope.tenantId,
            storeId: scope.storeId,
            productId: product.id,
            name: importedGroup.name,
            minSelect: importedGroup.minSelect,
            maxSelect: importedGroup.maxSelect,
            sortOrder: groupSort,
            createdAt: now,
            updatedAt: now,
          };
          groupSort += 1;
          await this.catalog.insertGroup(group, tx);
          summary.optionGroups += 1;

          let optionSort = 0;
          for (const importedOption of importedGroup.options) {
            const option: OptionRecord = {
              id: randomUUID(),
              tenantId: scope.tenantId,
              storeId: scope.storeId,
              groupId: group.id,
              name: importedOption.name,
              priceCents: importedOption.priceCents,
              available: true,
              sortOrder: optionSort,
              createdAt: now,
              updatedAt: now,
            };
            optionSort += 1;
            await this.catalog.insertOption(option, tx);
            summary.options += 1;
          }
        }
      }
    }
    return summary;
  }
}

function csvContent(file: CatalogCsvFile | undefined): string {
  if (
    file === undefined ||
    !Buffer.isBuffer(file.buffer) ||
    file.originalName.toLowerCase().endsWith('.xlsx') ||
    file.buffer.subarray(0, 2).toString('binary') === 'PK'
  ) {
    throw new DomainException('CSV_REQUIRED', 'A UTF-8 CSV file is required', 400);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
  } catch {
    throw new DomainException('CSV_REQUIRED', 'A UTF-8 CSV file is required', 400);
  }
}

function importFailed(errors: CatalogImportError[]): DomainException {
  return new DomainException(
    'CATALOG_IMPORT_INVALID',
    'The catalog CSV contains invalid rows',
    422,
    errors,
  );
}
