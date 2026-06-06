#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const pageSize = 1000;
const publicPageSectionsTable = 'public_page_sections';
const publicPageSectionItemsTable = 'public_page_section_items';
const catalogCollectionPresentationsTable = 'catalog_collection_presentations';
const catalogThemesTable = 'catalog_themes';

const requiredEnvKeys = [
  'SUPABASE_URL_STAGING',
  'SUPABASE_SERVICE_ROLE_KEY_STAGING',
  'SUPABASE_URL_PRODUCTION',
  'SUPABASE_SERVICE_ROLE_KEY_PRODUCTION',
];

const themePresentationFields = [
  'public_display_name',
  'public_description',
  'public_image_url',
  'public_tile_image_url',
  'public_logo_url',
  'public_accent_color',
  'public_surface_color',
  'public_surface_text_color',
  'public_hero_text_color',
  'public_order',
  'public_homepage_order',
  'is_public',
  'status',
];

const collectionPresentationFields = [
  'public_display_name',
  'public_description',
  'public_image_url',
  'public_tile_image_url',
  'public_logo_url',
  'public_accent_color',
  'public_surface_color',
  'public_surface_text_color',
  'public_hero_text_color',
  'public_order',
  'public_homepage_order',
  'is_public',
  'status',
  'metadata_json',
];

const pageSectionFields = [
  'title',
  'subtitle',
  'layout',
  'sort_order',
  'enabled',
  'metadata_json',
];

const pageSectionItemFields = [
  'reference_type',
  'reference_id',
  'image_set_id',
  'image_url',
  'title_override',
  'alt_override',
  'cta_label',
  'cta_url',
  'sort_order',
  'enabled',
  'use_custom_image',
  'metadata_json',
];

function readDotenv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\n/u)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separatorIndex = line.indexOf('=');

          if (separatorIndex < 0) {
            return [line, ''];
          }

          return [
            line.slice(0, separatorIndex),
            line.slice(separatorIndex + 1).replace(/^['"]|['"]$/gu, ''),
          ];
        }),
    );
  } catch {
    return {};
  }
}

function loadEnvironment() {
  return {
    ...readDotenv('.env.local'),
    ...process.env,
  };
}

function assertRequiredEnvironment(environment) {
  const missing = requiredEnvKeys.filter((key) => !environment[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase env for CMS promotion: ${missing.join(', ')}`,
    );
  }

  if (
    environment.SUPABASE_URL_STAGING?.trim() ===
    environment.SUPABASE_URL_PRODUCTION?.trim()
  ) {
    throw new Error('Refusing to promote CMS between identical Supabase URLs.');
  }
}

function createSupabaseClient({ key, url }) {
  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
  });
}

async function readRows({ client, columns, orderBy, table }) {
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Unable to read ${table}: ${JSON.stringify(error)}`);
    }

    const pageRows = data ?? [];
    rows.push(...pageRows);

    if (pageRows.length < pageSize) {
      return rows;
    }
  }
}

async function readSnapshot(client) {
  const [pageSections, collectionPresentations, themePresentations] =
    await Promise.all([
      readRows({
        client,
        columns:
          'id, page_key, section_key, title, subtitle, layout, sort_order, enabled, metadata_json',
        orderBy: 'page_key',
        table: publicPageSectionsTable,
      }),
      readRows({
        client,
        columns:
          'collection_slug, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_order, public_homepage_order, is_public, status, metadata_json',
        orderBy: 'collection_slug',
        table: catalogCollectionPresentationsTable,
      }),
      readRows({
        client,
        columns:
          'id, slug, display_name, public_display_name, public_description, public_image_url, public_tile_image_url, public_logo_url, public_accent_color, public_surface_color, public_surface_text_color, public_hero_text_color, public_order, public_homepage_order, is_public, status',
        orderBy: 'slug',
        table: catalogThemesTable,
      }),
    ]);
  const pageSectionIds = new Set(pageSections.map((section) => section.id));
  const pageSectionItems = pageSectionIds.size
    ? (
        await readRows({
          client,
          columns:
            'id, section_id, reference_type, reference_id, image_set_id, image_url, title_override, alt_override, cta_label, cta_url, sort_order, enabled, use_custom_image, metadata_json',
          orderBy: 'section_id',
          table: publicPageSectionItemsTable,
        })
      ).filter((row) => pageSectionIds.has(row.section_id))
    : [];

  return {
    collectionPresentations,
    pageSectionItems,
    pageSections,
    themePresentations,
  };
}

function valuesAreEqual(left, right) {
  if (left === right) {
    return true;
  }

  if (left == null && right == null) {
    return true;
  }

  if (
    typeof left === 'object' &&
    left !== null &&
    typeof right === 'object' &&
    right !== null
  ) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return false;
}

function buildKey({ keyColumns, row }) {
  return keyColumns
    .map((keyColumn) => `${keyColumn}:${String(row[keyColumn] ?? '')}`)
    .join('|');
}

function indexRowsByKey({ keyColumns, rows }) {
  return new Map(
    rows.map((row) => [
      buildKey({
        keyColumns,
        row,
      }),
      row,
    ]),
  );
}

function addSample(samples, sample) {
  if (samples.length < 50) {
    samples.push(sample);
  }
}

function diffRows({
  fields,
  keyColumns,
  productionRows,
  samples,
  stagingRows,
  table,
}) {
  const productionByKey = indexRowsByKey({
    keyColumns,
    rows: productionRows,
  });
  let insertedCount = 0;
  let updatedCount = 0;

  for (const stagingRow of stagingRows) {
    const key = buildKey({
      keyColumns,
      row: stagingRow,
    });
    const productionRow = productionByKey.get(key);

    if (!productionRow) {
      insertedCount += 1;
      addSample(samples, {
        changeType: 'insert',
        changedFields: [...fields],
        key,
        table,
      });
      continue;
    }

    const changedFields = fields.filter((field) =>
      Object.prototype.hasOwnProperty.call(stagingRow, field)
        ? !valuesAreEqual(stagingRow[field], productionRow[field])
        : false,
    );

    if (changedFields.length > 0) {
      updatedCount += 1;
      addSample(samples, {
        changeType: 'update',
        changedFields,
        key,
        table,
      });
    }
  }

  return {
    insertedCount,
    readCount: stagingRows.length,
    updatedCount,
  };
}

function diffThemeRows({ productionRows, samples, stagingRows }) {
  const productionBySlug = new Map(
    productionRows.map((row) => [row.slug, row]),
  );
  let skippedMissingProductionCount = 0;
  let updatedCount = 0;

  for (const stagingRow of stagingRows) {
    const productionRow = productionBySlug.get(stagingRow.slug);
    const key = `slug:${stagingRow.slug}`;

    if (!productionRow) {
      skippedMissingProductionCount += 1;
      addSample(samples, {
        changeType: 'skip_missing_production',
        changedFields: ['slug'],
        key,
        table: catalogThemesTable,
      });
      continue;
    }

    const changedFields = themePresentationFields.filter(
      (field) => !valuesAreEqual(stagingRow[field], productionRow[field]),
    );

    if (changedFields.length > 0) {
      updatedCount += 1;
      addSample(samples, {
        changeType: 'update',
        changedFields,
        key,
        table: catalogThemesTable,
      });
    }
  }

  return {
    insertedCount: 0,
    readCount: stagingRows.length,
    skippedMissingProductionCount,
    updatedCount,
  };
}

function listAffectedCollectionSlugs({ productionRows, stagingRows }) {
  const productionBySlug = new Map(
    productionRows.map((row) => [row.collection_slug, row]),
  );

  return stagingRows
    .filter((stagingRow) => {
      const productionRow = productionBySlug.get(stagingRow.collection_slug);

      return (
        !productionRow ||
        collectionPresentationFields.some(
          (field) => !valuesAreEqual(stagingRow[field], productionRow[field]),
        )
      );
    })
    .map((row) => row.collection_slug)
    .sort((left, right) => left.localeCompare(right));
}

function listAffectedThemeSlugs({ productionRows, stagingRows }) {
  const productionBySlug = new Map(
    productionRows.map((row) => [row.slug, row]),
  );

  return stagingRows
    .filter((stagingRow) => {
      const productionRow = productionBySlug.get(stagingRow.slug);

      return (
        productionRow &&
        themePresentationFields.some(
          (field) => !valuesAreEqual(stagingRow[field], productionRow[field]),
        )
      );
    })
    .map((row) => row.slug)
    .sort((left, right) => left.localeCompare(right));
}

function buildProductionSectionIdByStagingSectionId({
  productionRows,
  stagingRows,
}) {
  const productionByPageSectionKey = new Map(
    productionRows.map((row) => [`${row.page_key}:${row.section_key}`, row.id]),
  );

  return new Map(
    stagingRows.flatMap((stagingRow) => {
      const productionId = productionByPageSectionKey.get(
        `${stagingRow.page_key}:${stagingRow.section_key}`,
      );

      return productionId ? [[stagingRow.id, productionId]] : [];
    }),
  );
}

async function buildPlan({ now, productionClient, stagingClient }) {
  const [stagingSnapshot, productionSnapshot] = await Promise.all([
    readSnapshot(stagingClient),
    readSnapshot(productionClient),
  ]);
  const samples = [];
  const tables = {
    public_page_sections: diffRows({
      fields: pageSectionFields,
      keyColumns: ['page_key', 'section_key'],
      productionRows: productionSnapshot.pageSections,
      samples,
      stagingRows: stagingSnapshot.pageSections,
      table: publicPageSectionsTable,
    }),
    public_page_section_items: {
      ...diffRows({
        fields: pageSectionItemFields,
        keyColumns: ['id'],
        productionRows: productionSnapshot.pageSectionItems,
        samples,
        stagingRows: stagingSnapshot.pageSectionItems,
        table: publicPageSectionItemsTable,
      }),
      replacedCount: productionSnapshot.pageSectionItems.length,
    },
    catalog_collection_presentations: diffRows({
      fields: collectionPresentationFields,
      keyColumns: ['collection_slug'],
      productionRows: productionSnapshot.collectionPresentations,
      samples,
      stagingRows: stagingSnapshot.collectionPresentations,
      table: catalogCollectionPresentationsTable,
    }),
    catalog_themes: diffThemeRows({
      productionRows: productionSnapshot.themePresentations,
      samples,
      stagingRows: stagingSnapshot.themePresentations,
    }),
  };
  const affectedCollectionSlugs = listAffectedCollectionSlugs({
    productionRows: productionSnapshot.collectionPresentations,
    stagingRows: stagingSnapshot.collectionPresentations,
  });
  const affectedThemeSlugs = listAffectedThemeSlugs({
    productionRows: productionSnapshot.themePresentations,
    stagingRows: stagingSnapshot.themePresentations,
  });

  return {
    affectedCollectionSlugs,
    affectedThemeSlugs,
    generatedAt: now().toISOString(),
    pendingPromoteCount: Object.values(tables).reduce(
      (total, table) =>
        total +
        table.insertedCount +
        table.updatedCount +
        (table.replacedCount ?? 0),
      0,
    ),
    productionSectionIdByStagingSectionId:
      buildProductionSectionIdByStagingSectionId({
        productionRows: productionSnapshot.pageSections,
        stagingRows: stagingSnapshot.pageSections,
      }),
    samples,
    snapshot: stagingSnapshot,
    sourceEnvironment: 'staging',
    status: 'ok',
    tables,
    targetEnvironment: 'production',
  };
}

function toSectionPayload(row) {
  return {
    enabled: row.enabled,
    layout: row.layout,
    metadata_json: row.metadata_json ?? {},
    page_key: row.page_key,
    section_key: row.section_key,
    sort_order: row.sort_order,
    subtitle: row.subtitle,
    title: row.title,
  };
}

function toSectionItemPayload({ productionSectionId, row }) {
  return {
    alt_override: row.alt_override,
    cta_label: row.cta_label,
    cta_url: row.cta_url,
    enabled: row.enabled,
    id: row.id,
    image_set_id: row.image_set_id,
    image_url: row.image_url,
    metadata_json: row.metadata_json ?? {},
    reference_id: row.reference_id,
    reference_type: row.reference_type,
    section_id: productionSectionId,
    sort_order: row.sort_order,
    title_override: row.title_override,
    use_custom_image: row.use_custom_image === true,
  };
}

function toCollectionPayload(row) {
  return {
    collection_slug: row.collection_slug,
    is_public: row.is_public,
    metadata_json: row.metadata_json ?? {},
    public_accent_color: row.public_accent_color,
    public_description: row.public_description,
    public_display_name: row.public_display_name,
    public_hero_text_color: row.public_hero_text_color,
    public_homepage_order: row.public_homepage_order,
    public_image_url: row.public_image_url,
    public_logo_url: row.public_logo_url,
    public_order: row.public_order,
    public_surface_color: row.public_surface_color,
    public_surface_text_color: row.public_surface_text_color,
    public_tile_image_url: row.public_tile_image_url,
    status: row.status,
  };
}

function toThemePresentationPayload(row) {
  return Object.fromEntries(
    themePresentationFields.map((field) => [field, row[field]]),
  );
}

async function applyPlan({ plan, productionClient }) {
  if (plan.snapshot.pageSections.length) {
    const { data, error } = await productionClient
      .from(publicPageSectionsTable)
      .upsert(plan.snapshot.pageSections.map(toSectionPayload), {
        onConflict: 'page_key,section_key',
      })
      .select('id, page_key, section_key');

    if (error) {
      throw new Error(
        `Unable to promote public_page_sections: ${JSON.stringify(error)}`,
      );
    }

    const productionSectionIdByPageSectionKey = new Map(
      (data ?? []).map((row) => [`${row.page_key}:${row.section_key}`, row.id]),
    );
    plan.productionSectionIdByStagingSectionId = new Map(
      plan.snapshot.pageSections.flatMap((stagingRow) => {
        const productionId = productionSectionIdByPageSectionKey.get(
          `${stagingRow.page_key}:${stagingRow.section_key}`,
        );

        return productionId ? [[stagingRow.id, productionId]] : [];
      }),
    );
  }

  const productionSectionIds = [
    ...new Set([...plan.productionSectionIdByStagingSectionId.values()]),
  ];

  if (productionSectionIds.length) {
    const { error: deleteError } = await productionClient
      .from(publicPageSectionItemsTable)
      .delete()
      .in('section_id', productionSectionIds);

    if (deleteError) {
      throw new Error(
        `Unable to replace public_page_section_items: ${JSON.stringify(deleteError)}`,
      );
    }

    const itemPayload = plan.snapshot.pageSectionItems.flatMap((row) => {
      const productionSectionId =
        plan.productionSectionIdByStagingSectionId.get(row.section_id);

      return productionSectionId
        ? [
            toSectionItemPayload({
              productionSectionId,
              row,
            }),
          ]
        : [];
    });

    if (itemPayload.length) {
      const { error } = await productionClient
        .from(publicPageSectionItemsTable)
        .insert(itemPayload);

      if (error) {
        throw new Error(
          `Unable to promote public_page_section_items: ${JSON.stringify(error)}`,
        );
      }
    }
  }

  if (plan.snapshot.collectionPresentations.length) {
    const { error } = await productionClient
      .from(catalogCollectionPresentationsTable)
      .upsert(plan.snapshot.collectionPresentations.map(toCollectionPayload), {
        onConflict: 'collection_slug',
      });

    if (error) {
      throw new Error(
        `Unable to promote catalog_collection_presentations: ${JSON.stringify(error)}`,
      );
    }
  }

  for (const row of plan.snapshot.themePresentations) {
    const { error } = await productionClient
      .from(catalogThemesTable)
      .update(toThemePresentationPayload(row))
      .eq('slug', row.slug);

    if (error) {
      throw new Error(
        `Unable to promote catalog_themes presentation for ${row.slug}: ${JSON.stringify(error)}`,
      );
    }
  }
}

function buildRevalidationTargets({
  affectedCollectionSlugs,
  affectedThemeSlugs,
}) {
  const themeSlugs = [...new Set(affectedThemeSlugs)].sort((left, right) =>
    left.localeCompare(right),
  );
  const collectionSlugs = [...new Set(affectedCollectionSlugs)].sort(
    (left, right) => left.localeCompare(right),
  );
  const paths = [
    '/',
    '/themes',
    ...themeSlugs.map((slug) => `/themes/${slug}`),
    ...collectionSlugs.map((slug) => `/${slug}`),
  ];
  const tags = [
    'homepage',
    'themes',
    'collections',
    ...themeSlugs.map((slug) => `theme:${slug}`),
    ...collectionSlugs.map((slug) => `collection:${slug}`),
  ];

  return {
    paths: [...new Set(paths)],
    tags: [...new Set(tags)],
  };
}

async function revalidatePublicWeb({ environment, result }) {
  const webBaseUrl = environment.WEB_BASE_URL?.trim();
  const secret = environment.WEB_REVALIDATE_SECRET?.trim();
  const targets = buildRevalidationTargets(result);

  if (!webBaseUrl || !secret) {
    return {
      ...targets,
      attempted: false,
      skipped: true,
      warning: 'WEB_BASE_URL or WEB_REVALIDATE_SECRET is missing.',
    };
  }

  const targetUrl = new URL('/api/revalidate', webBaseUrl);
  const response = await fetch(targetUrl.toString(), {
    body: JSON.stringify({
      paths: targets.paths,
      reason: 'cms_promote_cli',
      tags: targets.tags,
    }),
    headers: {
      'content-type': 'application/json',
      'x-revalidate-secret': secret,
    },
    method: 'POST',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');

    throw new Error(
      `Public web revalidation failed with ${response.status}: ${body.slice(
        0,
        300,
      )}`,
    );
  }

  return {
    ...targets,
    attempted: true,
    skipped: false,
    status: response.status,
  };
}

function parseMode(argv) {
  const dryRun = argv.includes('--dry-run');
  const write = argv.includes('--write');

  if (dryRun === write) {
    throw new Error('Use exactly one mode: --dry-run or --write.');
  }

  return write ? 'write' : 'dry-run';
}

function printPreview({ label, result }) {
  console.info(`[promote-cms] ${label}`);
  console.info(
    JSON.stringify(
      {
        affectedCollectionSlugs: result.affectedCollectionSlugs,
        affectedThemeSlugs: result.affectedThemeSlugs,
        generatedAt: result.generatedAt,
        pendingPromoteCount: result.pendingPromoteCount,
        revalidation: result.revalidation,
        samples: result.samples.slice(0, 20),
        tables: result.tables,
      },
      null,
      2,
    ),
  );
}

async function run() {
  const mode = parseMode(process.argv.slice(2));
  const environment = loadEnvironment();
  assertRequiredEnvironment(environment);

  const stagingClient = createSupabaseClient({
    key: environment.SUPABASE_SERVICE_ROLE_KEY_STAGING,
    url: environment.SUPABASE_URL_STAGING,
  });
  const productionClient = createSupabaseClient({
    key: environment.SUPABASE_SERVICE_ROLE_KEY_PRODUCTION,
    url: environment.SUPABASE_URL_PRODUCTION,
  });
  const startedAt = new Date();
  const plan = await buildPlan({
    now: () => new Date(),
    productionClient,
    stagingClient,
  });

  if (mode === 'dry-run') {
    printPreview({
      label: 'dry-run preview',
      result: plan,
    });

    return;
  }

  await applyPlan({
    plan,
    productionClient,
  });

  const result = {
    affectedCollectionSlugs: plan.affectedCollectionSlugs,
    affectedThemeSlugs: plan.affectedThemeSlugs,
    applied: true,
    durationMs: Date.now() - startedAt.getTime(),
    generatedAt: plan.generatedAt,
    pendingPromoteCount: plan.pendingPromoteCount,
    samples: plan.samples,
    sourceEnvironment: plan.sourceEnvironment,
    startedAt: startedAt.toISOString(),
    status: plan.status,
    tables: plan.tables,
    targetEnvironment: plan.targetEnvironment,
  };

  let revalidation;

  try {
    revalidation = await revalidatePublicWeb({
      environment,
      result,
    });
  } catch (error) {
    revalidation = {
      ...buildRevalidationTargets(result),
      attempted: true,
      skipped: false,
      warning:
        error instanceof Error
          ? error.message
          : 'Public web revalidation failed.',
    };
  }

  printPreview({
    label: 'write applied',
    result: {
      ...result,
      revalidation,
    },
  });
}

run().catch((error) => {
  console.error('[promote-cms] failed', {
    error_message:
      error instanceof Error ? error.message : String(error ?? 'Unknown error'),
    error_name: error instanceof Error ? error.name : typeof error,
  });
  process.exitCode = 1;
});
