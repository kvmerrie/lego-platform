#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const requiredEnvKeys = [
  'SUPABASE_URL_STAGING',
  'SUPABASE_SERVICE_ROLE_KEY_STAGING',
  'SUPABASE_URL_PRODUCTION',
  'SUPABASE_SERVICE_ROLE_KEY_PRODUCTION',
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
      `Missing Supabase env for catalog promotion diagnostics: ${missing.join(', ')}`,
    );
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
  const pageSize = 1000;

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

function byKey(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function isDifferent(left, right) {
  return (left ?? null) !== (right ?? null);
}

function countChangedFields({ fields, productionRows, stagingRows }) {
  const productionById = byKey(productionRows, 'id');
  const counts = Object.fromEntries(fields.map((field) => [field, 0]));
  const details = [];
  let missingInProduction = 0;

  for (const stagingRow of stagingRows) {
    const productionRow = productionById.get(stagingRow.id);

    if (!productionRow) {
      missingInProduction += 1;
      continue;
    }

    for (const field of fields) {
      if (isDifferent(stagingRow[field], productionRow[field])) {
        counts[field] += 1;
        details.push({
          displayName:
            stagingRow.public_display_name ?? stagingRow.display_name,
          field,
          id: stagingRow.id,
          production: productionRow[field] ?? null,
          slug: stagingRow.slug,
          staging: stagingRow[field] ?? null,
        });
      }
    }
  }

  return {
    counts,
    details,
    missingInProduction,
  };
}

function summarizePublicThemes(rows) {
  return rows
    .filter((row) => row.status === 'active' && row.is_public === true)
    .sort(
      (left, right) =>
        (left.public_order ?? Number.MAX_SAFE_INTEGER) -
          (right.public_order ?? Number.MAX_SAFE_INTEGER) ||
        String(left.display_name).localeCompare(String(right.display_name)),
    )
    .slice(0, 12)
    .map((row) => ({
      display: row.public_display_name ?? row.display_name,
      hasPublicImage: Boolean(row.public_image_url),
      id: row.id,
      order: row.public_order,
      slug: row.slug,
    }));
}

function summarizeThemePresentationCompleteness(rows) {
  const publicThemes = rows.filter(
    (row) => row.status === 'active' && row.is_public === true,
  );

  return {
    publicActiveThemes: publicThemes.length,
    missingPublicAccentColor: publicThemes.filter(
      (row) => !row.public_accent_color,
    ).length,
    missingPublicImageUrl: publicThemes.filter((row) => !row.public_image_url)
      .length,
    missingPublicOrder: publicThemes.filter(
      (row) => typeof row.public_order !== 'number',
    ).length,
  };
}

function buildCatalogSetImageKey(row) {
  return `${row.set_id}::${row.image_type}::${row.sort_order}`;
}

function compareCatalogSetImages({ productionRows, stagingRows }) {
  const productionByKey = new Map(
    productionRows.map((row) => [buildCatalogSetImageKey(row), row]),
  );
  const fields = [
    'source',
    'source_url',
    'storage_bucket',
    'storage_path',
    'public_url',
    'width',
    'height',
    'content_type',
    'byte_size',
    'sha256',
    'status',
  ];
  let changed = 0;
  let missingInProduction = 0;

  for (const stagingRow of stagingRows) {
    const productionRow = productionByKey.get(
      buildCatalogSetImageKey(stagingRow),
    );

    if (!productionRow) {
      missingInProduction += 1;
      continue;
    }

    if (
      fields.some((field) =>
        isDifferent(stagingRow[field], productionRow[field]),
      )
    ) {
      changed += 1;
    }
  }

  return {
    changed,
    missingInProduction,
  };
}

function summarizeCatalogSetImages(rows) {
  const activeRows = rows.filter((row) => row.status === 'active');

  return {
    activeGalleryRows: activeRows.filter((row) => row.image_type === 'gallery')
      .length,
    activeHeroRows: activeRows.filter((row) => row.image_type === 'hero')
      .length,
    activeSocialRows: activeRows.filter((row) => row.image_type === 'social')
      .length,
    affectedSets: new Set(rows.map((row) => row.set_id)).size,
    rows: rows.length,
  };
}

async function readEnvironmentSnapshot({ client }) {
  const [themes, sets, summaries, mappings, sourceThemes, setImages] =
    await Promise.all([
      readRows({
        client,
        columns:
          'id, slug, display_name, public_display_name, public_description, public_image_url, public_accent_color, public_logo_url, is_public, public_order, status, created_at, updated_at',
        orderBy: 'slug',
        table: 'catalog_themes',
      }),
      readRows({
        client,
        columns:
          'set_id, source_set_number, slug, name, source_theme_id, primary_theme_id, release_year, piece_count, image_url, source, status, created_at, updated_at',
        orderBy: 'set_id',
        table: 'catalog_sets',
      }),
      readRows({
        client,
        columns:
          'theme_id, active_set_count, representative_set_id, representative_image_url, updated_at',
        orderBy: 'theme_id',
        table: 'catalog_theme_summaries',
      }),
      readRows({
        client,
        columns: 'source_theme_id, primary_theme_id, created_at, updated_at',
        orderBy: 'source_theme_id',
        table: 'catalog_theme_mappings',
      }),
      readRows({
        client,
        columns:
          'id, source_system, source_theme_name, parent_source_theme_id, created_at, updated_at',
        orderBy: 'id',
        table: 'catalog_source_themes',
      }),
      readRows({
        client,
        columns:
          'set_id, source, source_url, image_type, sort_order, storage_bucket, storage_path, public_url, width, height, content_type, byte_size, sha256, perceptual_hash, image_role, duplicate_reason, duplicate_distance, status, metadata_json',
        orderBy: 'set_id',
        table: 'catalog_set_images',
      }),
    ]);

  return {
    mappings,
    sets,
    setImages,
    sourceThemes,
    summaries,
    themes,
  };
}

function compareByKey({ fields, key, productionRows, stagingRows }) {
  const productionByKey = byKey(productionRows, key);
  let changed = 0;
  let missingInProduction = 0;

  for (const stagingRow of stagingRows) {
    const productionRow = productionByKey.get(stagingRow[key]);

    if (!productionRow) {
      missingInProduction += 1;
      continue;
    }

    if (
      fields.some((field) =>
        isDifferent(stagingRow[field], productionRow[field]),
      )
    ) {
      changed += 1;
    }
  }

  return {
    changed,
    missingInProduction,
  };
}

async function main() {
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

  const [staging, production] = await Promise.all([
    readEnvironmentSnapshot({ client: stagingClient }),
    readEnvironmentSnapshot({ client: productionClient }),
  ]);

  const curatedThemeFields = [
    'public_display_name',
    'public_description',
    'public_image_url',
    'public_accent_color',
    'public_logo_url',
    'is_public',
    'public_order',
    'status',
  ];
  const themePresentationDiff = countChangedFields({
    fields: curatedThemeFields,
    productionRows: production.themes,
    stagingRows: staging.themes,
  });

  const result = {
    counts: {
      production: {
        activeSets: production.sets.filter((row) => row.status === 'active')
          .length,
        mappings: production.mappings.length,
        publicActiveThemes: production.themes.filter(
          (row) => row.status === 'active' && row.is_public === true,
        ).length,
        sourceThemes: production.sourceThemes.length,
        setImages: summarizeCatalogSetImages(production.setImages),
        summaries: production.summaries.length,
        themes: production.themes.length,
      },
      staging: {
        activeSets: staging.sets.filter((row) => row.status === 'active')
          .length,
        mappings: staging.mappings.length,
        publicActiveThemes: staging.themes.filter(
          (row) => row.status === 'active' && row.is_public === true,
        ).length,
        sourceThemes: staging.sourceThemes.length,
        setImages: summarizeCatalogSetImages(staging.setImages),
        summaries: staging.summaries.length,
        themes: staging.themes.length,
      },
    },
    presentationCompleteness: {
      production: summarizeThemePresentationCompleteness(production.themes),
      staging: summarizeThemePresentationCompleteness(staging.themes),
    },
    parity: {
      catalogSets: compareByKey({
        fields: [
          'source_set_number',
          'slug',
          'name',
          'source_theme_id',
          'primary_theme_id',
          'release_year',
          'piece_count',
          'image_url',
          'source',
          'status',
        ],
        key: 'set_id',
        productionRows: production.sets,
        stagingRows: staging.sets,
      }),
      catalogSourceThemes: compareByKey({
        fields: [
          'source_system',
          'source_theme_name',
          'parent_source_theme_id',
        ],
        key: 'id',
        productionRows: production.sourceThemes,
        stagingRows: staging.sourceThemes,
      }),
      catalogThemeMappings: compareByKey({
        fields: ['primary_theme_id'],
        key: 'source_theme_id',
        productionRows: production.mappings,
        stagingRows: staging.mappings,
      }),
      catalogThemeSummaries: compareByKey({
        fields: [
          'active_set_count',
          'representative_set_id',
          'representative_image_url',
        ],
        key: 'theme_id',
        productionRows: production.summaries,
        stagingRows: staging.summaries,
      }),
      catalogSetImages: compareCatalogSetImages({
        productionRows: production.setImages,
        stagingRows: staging.setImages,
      }),
      catalogThemesPresentation: themePresentationDiff,
    },
    publicThemePreview: {
      production: summarizePublicThemes(production.themes),
      staging: summarizePublicThemes(staging.themes),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

await main();
