#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

import { legoThemeCoverageThemes } from './lego-theme-coverage-config.mjs';

const pageSize = 1000;

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

function resolveSupabaseEnvironment(environment) {
  const candidates = [
    {
      key: environment.SUPABASE_SERVICE_ROLE_KEY_STAGING,
      label: 'staging',
      url: environment.SUPABASE_URL_STAGING,
    },
    {
      key: environment.SUPABASE_SERVICE_ROLE_KEY,
      label: 'default',
      url: environment.SUPABASE_URL,
    },
    {
      key: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      label: 'browser-anon',
      url: environment.NEXT_PUBLIC_SUPABASE_URL,
    },
  ];

  return candidates.find(
    (candidate) => candidate.url?.trim() && candidate.key?.trim(),
  );
}

function createSupabaseReadClient({ key, url }) {
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

async function readOptionalRows({ client, columns, orderBy, table }) {
  try {
    return await readRows({ client, columns, orderBy, table });
  } catch (error) {
    console.warn(
      `[theme-coverage] Skipping optional table ${table}: ${error.message}`,
    );
    return [];
  }
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/giu, ' ')
    .trim()
    .toLowerCase();
}

function isActivePublicTheme(row) {
  return row?.status === 'active' && row?.is_public === true;
}

function buildAliasNeedles(theme) {
  return [theme.slug, theme.displayName, ...(theme.aliases ?? [])]
    .map(normalizeSearchText)
    .filter(Boolean);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function matchesAnyAlias(value, aliasNeedles) {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) {
    return false;
  }

  return aliasNeedles.some((alias) => {
    const aliasPattern = new RegExp(
      `(?:^| )${escapeRegExp(alias)}(?: |$)`,
      'u',
    );

    return normalizedValue === alias || aliasPattern.test(normalizedValue);
  });
}

export function createThemeAudit({
  catalogSets,
  catalogThemes,
  sourceThemes,
  themeMappings,
}) {
  const themeRowsBySlug = new Map(catalogThemes.map((row) => [row.slug, row]));
  const sourceThemeRowsById = new Map(sourceThemes.map((row) => [row.id, row]));
  const mappedPrimaryThemeIdsBySourceThemeId = new Map(
    themeMappings.map((row) => [row.source_theme_id, row.primary_theme_id]),
  );

  const activeSets = catalogSets.filter((row) => row.status === 'active');
  const activeSetCountByThemeId = new Map();

  for (const row of activeSets) {
    if (!row.primary_theme_id) {
      continue;
    }

    activeSetCountByThemeId.set(
      row.primary_theme_id,
      (activeSetCountByThemeId.get(row.primary_theme_id) ?? 0) + 1,
    );
  }

  return legoThemeCoverageThemes.map((theme) => {
    const existingRow = themeRowsBySlug.get(theme.slug);
    const aliasNeedles = buildAliasNeedles(theme);
    const candidateSets = activeSets.filter((setRow) => {
      if (existingRow && setRow.primary_theme_id === existingRow.id) {
        return true;
      }

      const mappedPrimaryThemeId = setRow.source_theme_id
        ? mappedPrimaryThemeIdsBySourceThemeId.get(setRow.source_theme_id)
        : undefined;

      if (existingRow && mappedPrimaryThemeId === existingRow.id) {
        return true;
      }

      const sourceThemeName = setRow.source_theme_id
        ? sourceThemeRowsById.get(setRow.source_theme_id)?.source_theme_name
        : undefined;

      return (
        matchesAnyAlias(sourceThemeName, aliasNeedles) ||
        matchesAnyAlias(setRow.name, aliasNeedles)
      );
    });

    const activeSetCount = existingRow
      ? (activeSetCountByThemeId.get(existingRow.id) ?? 0)
      : 0;
    const candidateSetCount = candidateSets.length;
    const hasCoverage = activeSetCount > 0 || candidateSetCount > 0;
    const publicStatus = existingRow
      ? isActivePublicTheme(existingRow)
        ? 'public'
        : 'inactive'
      : 'missing';
    const recommendation = existingRow
      ? isActivePublicTheme(existingRow)
        ? 'ok'
        : hasCoverage
          ? 'create active'
          : 'keep inactive'
      : hasCoverage
        ? 'create active'
        : theme.preferredPublic
          ? 'create inactive until catalog coverage exists'
          : 'create inactive';

    return {
      activeSetCount,
      candidateExamples: candidateSets.slice(0, 5).map((row) => ({
        name: row.name,
        setId: row.set_id,
      })),
      candidateSetCount,
      displayName: theme.displayName,
      existingStatus: existingRow?.status ?? null,
      isPublic: existingRow?.is_public ?? null,
      recommendation,
      slug: theme.slug,
      status: publicStatus,
    };
  });
}

function printSection(title, rows) {
  console.log(`\n${title}`);

  if (rows.length === 0) {
    console.log('  none');
    return;
  }

  for (const row of rows) {
    const countLabel =
      row.activeSetCount === row.candidateSetCount
        ? `${row.activeSetCount} sets`
        : `${row.activeSetCount} active / ${row.candidateSetCount} candidates`;
    const examples = row.candidateExamples
      .map((example) => `${example.setId} ${example.name}`)
      .join('; ');

    console.log(
      `  - ${row.slug} (${row.displayName}): ${countLabel}; ${row.recommendation}${
        examples ? `; examples: ${examples}` : ''
      }`,
    );
  }
}

export async function main() {
  const environment = loadEnvironment();
  const supabaseEnvironment = resolveSupabaseEnvironment(environment);

  if (!supabaseEnvironment) {
    throw new Error(
      'Missing Supabase env for theme coverage audit: set SUPABASE_URL_STAGING + SUPABASE_SERVICE_ROLE_KEY_STAGING or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  const client = createSupabaseReadClient(supabaseEnvironment);
  console.log(
    `[theme-coverage] Reading ${supabaseEnvironment.label} Supabase ${supabaseEnvironment.url}`,
  );

  const [catalogThemes, catalogSets, sourceThemes, themeMappings] =
    await Promise.all([
      readRows({
        client,
        columns:
          'id, slug, display_name, public_display_name, public_description, is_public, status',
        orderBy: 'slug',
        table: 'catalog_themes',
      }),
      readRows({
        client,
        columns: 'set_id, name, primary_theme_id, source_theme_id, status',
        orderBy: 'set_id',
        table: 'catalog_sets',
      }),
      readOptionalRows({
        client,
        columns: 'id, source_theme_name',
        orderBy: 'id',
        table: 'catalog_source_themes',
      }),
      readOptionalRows({
        client,
        columns: 'source_theme_id, primary_theme_id',
        orderBy: 'source_theme_id',
        table: 'catalog_theme_mappings',
      }),
    ]);

  const auditRows = createThemeAudit({
    catalogSets,
    catalogThemes,
    sourceThemes,
    themeMappings,
  });

  printSection(
    'Present public themes',
    auditRows.filter((row) => row.status === 'public'),
  );
  printSection(
    'Present inactive themes',
    auditRows.filter((row) => row.status === 'inactive'),
  );
  printSection(
    'Missing themes with candidate sets',
    auditRows.filter(
      (row) => row.status === 'missing' && row.candidateSetCount > 0,
    ),
  );
  printSection(
    'Missing themes without catalog coverage',
    auditRows.filter(
      (row) => row.status === 'missing' && row.candidateSetCount === 0,
    ),
  );

  console.log('\nRecommendations JSON');
  console.log(JSON.stringify(auditRows, null, 2));
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main().catch((error) => {
    console.error(`[theme-coverage] ${error.message}`);
    process.exitCode = 1;
  });
}
