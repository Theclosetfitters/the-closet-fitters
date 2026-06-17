// Loads the catalog seed data and exposes it as a typed object.
import catalogJson from '@/catalog/closet-options.json';
import type { Catalog } from '@/types';

export const catalog = catalogJson as Catalog;
