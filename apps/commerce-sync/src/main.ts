import { runCommerceSync } from './lib/commerce-sync';

function getSyncMode(argv: readonly string[]): 'check' | 'write' {
  const hasCheckFlag = argv.includes('--check');
  const hasWriteFlag = argv.includes('--write');

  if (hasCheckFlag && hasWriteFlag) {
    throw new Error('Use either --check or --write, not both.');
  }

  return hasCheckFlag ? 'check' : 'write';
}

async function main() {
  const mode = getSyncMode(process.argv.slice(2));
  const result = await runCommerceSync({
    mode,
    workspaceRoot: process.cwd(),
  });
  const stalePaths = [
    ...result.pricingArtifactCheck.stalePaths,
    ...result.affiliateArtifactCheck.stalePaths,
  ];

  if (mode === 'check') {
    if (stalePaths.length > 0) {
      throw new Error(
        `Generated commerce artifacts are stale:\n${stalePaths
          .map((stalePath) => `- ${stalePath}`)
          .join('\n')}`,
      );
    }

    console.log('[commerce-sync] check passed for the Dutch set-detail slice.');
    return;
  }

  console.log(
    `[commerce-sync] ${stalePaths.length === 0 ? 'verified' : 'updated'} pricing and affiliate artifacts for ${stalePaths.length === 0 ? 'the existing' : 'the current'} Dutch set-detail slice.`,
  );
}

main().catch((error) => {
  console.error('[commerce-sync] failed');
  console.error(error);
  process.exit(1);
});
