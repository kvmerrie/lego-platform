import {
  createWishlistAlertEmailFlowDependencies,
  runWishlistAlertEmailFlow,
  type WishlistAlertEmailFlowMode,
} from '@lego-platform/api/data-access-server';
import {
  getMissingProductEmailEnvKeys,
  getMissingServerSupabaseEnvKeys,
} from '@lego-platform/shared/config';

function getRunMode(argv: readonly string[]): WishlistAlertEmailFlowMode {
  const hasCheckFlag = argv.includes('--check');
  const hasSendFlag = argv.includes('--send');

  if (hasCheckFlag === hasSendFlag) {
    throw new Error('Use either --check or --send.');
  }

  return hasSendFlag ? 'send' : 'check';
}

async function main() {
  const mode = getRunMode(process.argv.slice(2));
  const missingServerSupabaseEnvKeys = getMissingServerSupabaseEnvKeys();

  if (missingServerSupabaseEnvKeys.length > 0) {
    throw new Error(
      `Wishlist alerts require Supabase server configuration. Missing: ${missingServerSupabaseEnvKeys.join(', ')}.`,
    );
  }

  if (mode === 'send') {
    const missingProductEmailEnvKeys = getMissingProductEmailEnvKeys();

    if (missingProductEmailEnvKeys.length > 0) {
      throw new Error(
        `Wishlist alert email delivery requires product email configuration. Missing: ${missingProductEmailEnvKeys.join(', ')}.`,
      );
    }
  }

  const startedAt = Date.now();

  console.log(
    `[wishlist-alerts] start mode=${mode} channel=email provider=resend`,
  );
  const result = await runWishlistAlertEmailFlow({
    dependencies: createWishlistAlertEmailFlowDependencies({
      mode,
    }),
    mode,
  });

  console.log(
    `[wishlist-alerts] end mode=${mode} recipients=${result.recipientCount} recipients_with_candidates=${result.recipientsWithCandidatesCount} alert_candidates=${result.alertCandidateCount} emails_sent=${result.emailSentCount} failures=${result.failureCount} notification_state_writes=${result.notificationStateWriteCount} duration_ms=${Date.now() - startedAt}`,
  );

  if (result.failureCount > 0) {
    throw new Error(
      `Wishlist alert email delivery finished with ${result.failureCount} failure(s).`,
    );
  }
}

main().catch((error) => {
  const mode = (() => {
    try {
      return getRunMode(process.argv.slice(2));
    } catch {
      return 'check';
    }
  })();

  console.error(`[wishlist-alerts] failed mode=${mode} channel=email`);
  if (error instanceof Error) {
    console.error(`[wishlist-alerts] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
