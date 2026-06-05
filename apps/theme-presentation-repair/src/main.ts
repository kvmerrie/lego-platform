import { repairThemePresentationFromStaging } from '@lego-platform/api/data-access-server';

function hasFlag({
  argv,
  flag,
}: {
  argv: readonly string[];
  flag: `--${string}`;
}): boolean {
  return argv.includes(flag);
}

function formatFieldList(fields: readonly string[]): string {
  return fields.length > 0 ? fields.join(',') : 'none';
}

async function main() {
  const argv = process.argv.slice(2);
  const write = hasFlag({
    argv,
    flag: '--write',
  });
  const dryRun =
    hasFlag({
      argv,
      flag: '--dry-run',
    }) || !write;
  const startedAt = Date.now();

  console.log(
    [
      '[theme-presentation-repair] start',
      `dry_run=${dryRun}`,
      `write=${write && !dryRun}`,
    ].join(' '),
  );

  const result = await repairThemePresentationFromStaging({
    options: {
      dryRun,
      write,
    },
  });

  for (const themeRepair of result.themesBackfilled) {
    console.log(
      [
        '[theme-presentation-repair] theme',
        `slug=${themeRepair.slug}`,
        `id=${themeRepair.id}`,
        `matched_by=${themeRepair.matchedBy}`,
        `fields=${formatFieldList(
          themeRepair.fields.map((fieldRepair) => fieldRepair.field),
        )}`,
      ].join(' '),
    );

    for (const fieldRepair of themeRepair.fields) {
      console.log(
        [
          '[theme-presentation-repair] field',
          `slug=${themeRepair.slug}`,
          `field=${fieldRepair.field}`,
          `value=${JSON.stringify(fieldRepair.stagingValue)}`,
        ].join(' '),
      );
    }
  }

  const stillMissingPresentation = result.themesStillMissingPresentation.filter(
    (theme) =>
      [
        'pokemon',
        'marvel',
        'star-wars',
        ...result.themesBackfilled.map((repair) => repair.slug),
      ].includes(theme.slug),
  );

  for (const theme of stillMissingPresentation) {
    console.log(
      [
        '[theme-presentation-repair] still_missing',
        `slug=${theme.slug}`,
        `id=${theme.id}`,
        `fields=${formatFieldList(theme.fields)}`,
      ].join(' '),
    );
  }

  if (result.revalidation) {
    console.log(
      [
        '[theme-presentation-repair] revalidation',
        `attempted=${result.revalidation.attempted}`,
        `skipped=${result.revalidation.skipped}`,
        `paths=${result.revalidation.paths.join(',')}`,
        `tags=${result.revalidation.tags.join(',')}`,
      ].join(' '),
    );
  }

  if (result.revalidationWarning) {
    console.warn(
      `[theme-presentation-repair] revalidation_warning=${result.revalidationWarning}`,
    );
  }

  console.log(
    [
      '[theme-presentation-repair] end',
      `status=${result.status}`,
      `dry_run=${result.dryRun}`,
      `write=${result.write}`,
      `staging_theme_count=${result.stagingThemeCount}`,
      `production_theme_count=${result.productionThemeCount}`,
      `themes_backfilled=${result.themesBackfilled.length}`,
      `fields_backfilled=${result.fieldsBackfilledCount}`,
      `themes_still_missing=${result.themesStillMissingPresentation.length}`,
      `duration_ms=${Date.now() - startedAt}`,
    ].join(' '),
  );
}

main().catch((error) => {
  console.error('[theme-presentation-repair] failed');

  if (error instanceof Error) {
    console.error(`[theme-presentation-repair] error=${error.message}`);
    if (error.stack) {
      console.error(`[theme-presentation-repair] stack=${error.stack}`);
    }
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
