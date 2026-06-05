import { refreshSetDetailRelatedThemeSnapshotsForSetIds } from '@lego-platform/api/data-access-server';

function getFlagValue({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string {
  const equalsStyleFlag = argv.find((argument) =>
    argument.startsWith(`${flag}=`),
  );

  if (equalsStyleFlag) {
    return equalsStyleFlag.slice(flag.length + 1).trim();
  }

  const flagIndex = argv.findIndex((argument) => argument === flag);

  return flagIndex >= 0 ? (argv[flagIndex + 1]?.trim() ?? '') : '';
}

function hasBooleanFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

function parseListFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): string[] | undefined {
  const rawValue = getFlagValue({ argv, flag });
  const values = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length ? values : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const startedAt = Date.now();
  const write = hasBooleanFlag({ argv, flag: '--write' });
  const setIds = parseListFlag({ argv, flag: '--set-ids' });
  const themeSlugs = parseListFlag({ argv, flag: '--theme-slugs' });

  console.log(
    [
      '[set-detail-related-theme-snapshot-sync] start',
      `mode=${write ? 'write' : 'dry-run'}`,
      `set_ids=${setIds?.join(',') ?? 'all'}`,
      `theme_slugs=${themeSlugs?.join(',') ?? 'auto'}`,
    ].join(' '),
  );

  const result = await refreshSetDetailRelatedThemeSnapshotsForSetIds({
    dryRun: !write,
    setIds,
    themeSlugs,
  });

  console.log(
    [
      '[set-detail-related-theme-snapshot-sync] end',
      `dry_run=${result.dryRun}`,
      `affected_set_count=${result.affectedSetIds.length}`,
      `affected_theme_slugs=${result.affectedThemeSlugs.join(',') || 'none'}`,
      `snapshot_count=${result.snapshotCount}`,
      `snapshot_with_items_count=${result.snapshotWithItemsCount}`,
      `upserted_count=${result.upsertedCount}`,
      `generated_at=${result.generatedAt}`,
      `duration_ms=${Date.now() - startedAt}`,
    ].join(' '),
  );
}

main().catch((error: unknown) => {
  console.error('[set-detail-related-theme-snapshot-sync] failed', error);
  process.exit(1);
});
