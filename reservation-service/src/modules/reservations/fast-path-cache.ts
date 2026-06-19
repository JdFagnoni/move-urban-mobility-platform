import type {
  CategoryBehaviorConfig,
  CategoryDTO,
  CategoryPricingConfig,
  CompanyLocationKind,
  GeoPoint,
} from "@move/shared";
import { query, redisClient } from "@move/shared";
import {
  CategoryModel,
  CompanyLocationModel,
  CompanyProductModel,
  FrequentClientRankingModel,
} from "../../db/models";
import { sequelize } from "../../db/sequelize";
import {
  normalizeCategoryBehaviorConfig,
  normalizeCategoryDescriptions,
  normalizeCategoryPricingConfig,
} from "../categories/config";

const FREQUENT_CLIENT_LIMIT = 20;
const FREQUENT_CLIENT_WINDOW_DAYS = 7;
const FREQUENT_CLIENT_REFRESH_MS = 10 * 60 * 1000;

const FREQUENT_CLIENTS_KEY = "reservations:r1:frequent-clients";
const CATEGORY_QUOTES_KEY = "reservations:r1:category-quotes";

interface FrequentClientAggregateRow {
  client_id: string;
  reservation_count: string;
  last_reservation_at: Date;
}

interface CachedCompanyLocationRecord {
  kind: CompanyLocationKind;
  location: GeoPoint;
}

interface CachedCategoryQuoteRecord {
  id: string;
  name: string;
  spanishName: string;
  descriptions: string[];
  pricing: CategoryPricingConfig;
  behavior: CategoryBehaviorConfig;
  active: boolean;
}

function companyProductsCacheKey(clientId: string): string {
  return `reservations:r1:company-products:${clientId}`;
}

function companyLocationsCacheKey(clientId: string): string {
  return `reservations:r1:company-locations:${clientId}`;
}

function logRedisError(context: string, error: unknown): void {
  console.error(`[reservations] redis ${context} error:`, error);
}

function mapCategoryToCachedQuote(category: CategoryModel): CachedCategoryQuoteRecord {
  return {
    id: category.id,
    name: category.name,
    spanishName: category.spanishName ?? category.name,
    descriptions: normalizeCategoryDescriptions(category.descriptions),
    pricing: normalizeCategoryPricingConfig(category.pricing),
    behavior: normalizeCategoryBehaviorConfig(category.behavior),
    active: category.active,
  };
}

function mapCachedQuoteToDTO(record: CachedCategoryQuoteRecord): CategoryDTO {
  return {
    id: record.id,
    name: record.name,
    spanishName: record.spanishName,
    descriptions: record.descriptions,
    pricing: record.pricing,
    behavior: record.behavior,
    active: record.active,
  };
}

async function syncFrequentClientsSet(clientIds: string[]): Promise<void> {
  const pipeline = redisClient.multi();
  pipeline.del(FREQUENT_CLIENTS_KEY);
  if (clientIds.length > 0) {
    pipeline.sadd(FREQUENT_CLIENTS_KEY, ...clientIds);
  }
  await pipeline.exec();
}

async function writeHashEntries(
  key: string,
  entries: Array<[field: string, value: string]>
): Promise<void> {
  const pipeline = redisClient.multi();
  pipeline.del(key);

  if (entries.length > 0) {
    const flattenedEntries = entries.flatMap(([field, value]) => [field, value]);
    pipeline.hset(key, ...flattenedEntries);
  }

  await pipeline.exec();
}

export async function refreshCompanyProductCacheForClient(clientId: string): Promise<void> {
  try {
    const companyProducts = await CompanyProductModel.findAll({
      where: { clientId },
      order: [["created_at", "ASC"]],
    });

    await writeHashEntries(
      companyProductsCacheKey(clientId),
      companyProducts.map((companyProduct) => [companyProduct.id, companyProduct.categoryId])
    );
  } catch (error) {
    logRedisError("company product cache refresh", error);
  }
}

export async function refreshCompanyLocationCacheForClient(clientId: string): Promise<void> {
  try {
    const companyLocations = await CompanyLocationModel.findAll({
      where: { clientId },
      order: [["created_at", "ASC"]],
    });

    await writeHashEntries(
      companyLocationsCacheKey(clientId),
      companyLocations.map((companyLocation) => [
        companyLocation.id,
        JSON.stringify({
          kind: companyLocation.kind,
          location: companyLocation.location,
        } satisfies CachedCompanyLocationRecord),
      ])
    );
  } catch (error) {
    logRedisError("company location cache refresh", error);
  }
}

export async function refreshCategoryQuoteCache(): Promise<void> {
  try {
    const categories = await CategoryModel.findAll({
      order: [["name", "ASC"]],
    });

    await writeHashEntries(
      CATEGORY_QUOTES_KEY,
      categories.map((category) => [
        category.id,
        JSON.stringify(mapCategoryToCachedQuote(category)),
      ])
    );
  } catch (error) {
    logRedisError("category quote cache refresh", error);
  }
}

async function warmFrequentClientCaches(clientIds: string[]): Promise<void> {
  await Promise.all([
    refreshCategoryQuoteCache(),
    ...clientIds.flatMap((clientId) => [
      refreshCompanyProductCacheForClient(clientId),
      refreshCompanyLocationCacheForClient(clientId),
    ]),
  ]);
}

export async function refreshFrequentClientRanking(): Promise<void> {
  const windowEnd = new Date();
  const windowStart = new Date(
    windowEnd.getTime() - FREQUENT_CLIENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const refreshedAt = new Date();
  const ranking = await query<FrequentClientAggregateRow>(
    `SELECT
       r.client_id,
       COUNT(*)::text AS reservation_count,
       MAX(r.created_at) AS last_reservation_at
     FROM reservations r
     JOIN users u ON u.id = r.client_id
     WHERE u.role = 'client'
       AND u.client_type = 'company'
       AND r.status <> 'cancelled'
       AND r.created_at >= $1
     GROUP BY r.client_id
     ORDER BY COUNT(*) DESC, MAX(r.created_at) DESC, r.client_id ASC
     LIMIT $2`,
    [windowStart.toISOString(), FREQUENT_CLIENT_LIMIT]
  );

  const rankingRows = ranking.rows.map((row, index) => ({
    clientId: row.client_id,
    rankPosition: index + 1,
    reservationCount: Number(row.reservation_count),
    lastReservationAt: new Date(row.last_reservation_at),
    windowStart,
    windowEnd,
    refreshedAt,
  }));

  await sequelize.transaction(async (transaction) => {
    await FrequentClientRankingModel.destroy({
      where: {},
      truncate: true,
      transaction,
    });

    if (rankingRows.length > 0) {
      await FrequentClientRankingModel.bulkCreate(rankingRows, { transaction });
    }
  });

  try {
    const clientIds = rankingRows.map((row) => row.clientId);
    await syncFrequentClientsSet(clientIds);
    await warmFrequentClientCaches(clientIds);
  } catch (error) {
    logRedisError("frequent client ranking sync", error);
  }
}

export async function isFrequentCompanyClient(clientId: string): Promise<boolean> {
  try {
    const isFrequent = await redisClient.sismember(FREQUENT_CLIENTS_KEY, clientId);
    return isFrequent === 1;
  } catch (error) {
    logRedisError("frequent client read", error);
  }

  const ranking = await FrequentClientRankingModel.findByPk(clientId);
  return ranking !== null;
}

export async function getCachedCompanyLocation(
  clientId: string,
  locationId: string
): Promise<CachedCompanyLocationRecord | null> {
  try {
    const cached = await redisClient.hget(companyLocationsCacheKey(clientId), locationId);
    return cached ? (JSON.parse(cached) as CachedCompanyLocationRecord) : null;
  } catch (error) {
    logRedisError("company location read", error);
    return null;
  }
}

export async function getCachedCompanyProductCategoryIds(
  clientId: string,
  productIds: string[]
): Promise<Map<string, string> | null> {
  if (productIds.length === 0) {
    return new Map();
  }

  try {
    const cachedValues = await redisClient.hmget(companyProductsCacheKey(clientId), ...productIds);
    if (cachedValues.some((value) => value === null)) {
      return null;
    }

    return new Map(
      productIds.map((productId, index) => [productId, cachedValues[index] as string])
    );
  } catch (error) {
    logRedisError("company product read", error);
    return null;
  }
}

export async function getCachedCategoriesForQuote(
  categoryIds: string[]
): Promise<Map<string, CategoryDTO> | null> {
  if (categoryIds.length === 0) {
    return new Map();
  }

  try {
    const cachedValues = await redisClient.hmget(CATEGORY_QUOTES_KEY, ...categoryIds);
    if (cachedValues.some((value) => value === null)) {
      return null;
    }

    return new Map(
      categoryIds.map((categoryId, index) => [
        categoryId,
        mapCachedQuoteToDTO(JSON.parse(cachedValues[index] as string) as CachedCategoryQuoteRecord),
      ])
    );
  } catch (error) {
    logRedisError("category quote read", error);
    return null;
  }
}

export async function startFrequentClientRankingRefresh(): Promise<void> {
  let refreshInProgress = false;

  const runRefresh = async (): Promise<void> => {
    if (refreshInProgress) {
      return;
    }

    refreshInProgress = true;
    try {
      await refreshFrequentClientRanking();
    } catch (error) {
      console.error("[reservations] frequent client ranking refresh failed:", error);
    } finally {
      refreshInProgress = false;
    }
  };

  await runRefresh();
  setInterval(() => {
    void runRefresh();
  }, FREQUENT_CLIENT_REFRESH_MS);
}
