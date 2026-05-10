import { runCatalogPopularitySync } from '@lego-platform/catalog/data-access-server';
import {
  getMissingServerSupabaseEnvKeys,
  hasServerSupabaseConfig,
} from '@lego-platform/shared/config';

function getSyncMode(argv: readonly string[]): 'check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasWriteFlag = argv.includes('--write');

  if (hasCheckFlag && hasWriteFlag) {
    throw new Error('Use exactly one of --check or --write.');
  }

  return hasCheckFlag ? 'check' : 'write';
}

async function main() {
  const mode = getSyncMode(process.argv.slice(2));
  const startedAt = Date.now();
  const workspaceRoot = process.cwd();

  console.log(`[catalog-popularity-sync] start mode=${mode}`);

  if (!hasServerSupabaseConfig()) {
    throw new Error(
      `Catalog popularity sync requires Supabase server configuration. Missing: ${getMissingServerSupabaseEnvKeys().join(', ')}.`,
    );
  }

  const result = await runCatalogPopularitySync({
    mode,
    workspaceRoot,
  });

  if (mode === 'check' && !result.artifactCheck.isClean) {
    throw new Error(
      `Generated catalog popularity artifact is stale:\n${result.artifactCheck.stalePaths
        .map((artifactPath) => `- ${artifactPath}`)
        .join('\n')}`,
    );
  }

  console.log(
    `[catalog-popularity-sync] end mode=${mode} status=${result.artifactCheck.isClean ? 'clean' : 'updated'} day_items=${result.popularitySnapshot.windows.day.length} week_items=${result.popularitySnapshot.windows.week.length} stale_paths=${result.artifactCheck.stalePaths.length} duration_ms=${Date.now() - startedAt}`,
  );
}

main().catch((error) => {
  const mode = getSyncMode(process.argv.slice(2));

  console.error(`[catalog-popularity-sync] failed mode=${mode}`);

  if (error instanceof Error) {
    console.error(`[catalog-popularity-sync] error=${error.message}`);
  }

  console.error(error);
  process.exit(1);
});
