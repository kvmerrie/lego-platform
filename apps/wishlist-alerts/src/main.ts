import {
  createWishlistAlertEmailFlowDependencies,
  runWishlistAlertEmailFlow,
  type WishlistAlertEmailFlowOptions,
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

function getOptionalArgumentValue(
  argv: readonly string[],
  name: string,
): string | undefined {
  const exactArgumentIndex = argv.indexOf(name);

  if (exactArgumentIndex >= 0) {
    return argv[exactArgumentIndex + 1];
  }

  const prefixedArgument = argv.find((argument) =>
    argument.startsWith(`${name}=`),
  );

  if (!prefixedArgument) {
    return undefined;
  }

  return prefixedArgument.slice(name.length + 1);
}

function parsePositiveInteger({
  label,
  rawValue,
}: {
  label: string;
  rawValue: string | undefined;
}): number | undefined {
  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsedValue;
}

function getFlowOptions({
  argv,
  environment = process.env,
}: {
  argv: readonly string[];
  environment?: Record<string, string | undefined>;
}): WishlistAlertEmailFlowOptions {
  const maxEmailsFromArg = getOptionalArgumentValue(argv, '--max-emails');
  const maxEmailsToSend = parsePositiveInteger({
    label: '--max-emails',
    rawValue: maxEmailsFromArg ?? environment.WISHLIST_ALERT_EMAIL_MAX_SENDS,
  });

  return {
    maxEmailsToSend,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const mode = getRunMode(argv);
  const flowOptions = getFlowOptions({
    argv,
  });
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
    `[wishlist-alerts] start mode=${mode} channel=email provider=resend send_cap=${flowOptions.maxEmailsToSend ?? 'none'}`,
  );

  if (mode === 'send' && flowOptions.maxEmailsToSend === undefined) {
    console.warn(
      '[wishlist-alerts] warning mode=send send_cap=none proceeding without a per-run email cap',
    );
  }

  const result = await runWishlistAlertEmailFlow({
    dependencies: createWishlistAlertEmailFlowDependencies({
      mode,
    }),
    mode,
    options: flowOptions,
  });

  console.log(
    `[wishlist-alerts] end mode=${mode} recipients=${result.recipientCount} recipients_with_candidates=${result.recipientsWithCandidatesCount} selected_emails=${result.emailSelectedCount} deferred_emails=${result.emailDeferredCount} alert_candidates=${result.alertCandidateCount} deferred_alert_candidates=${result.deferredAlertCandidateCount} emails_sent=${result.emailSentCount} failures=${result.failureCount} notification_state_writes=${result.notificationStateWriteCount} send_cap=${result.sendCap ?? 'none'} duration_ms=${Date.now() - startedAt}`,
  );

  if (result.emailDeferredCount > 0) {
    console.warn(
      `[wishlist-alerts] warning deferred_emails=${result.emailDeferredCount} deferred_alert_candidates=${result.deferredAlertCandidateCount} reason=send-cap`,
    );
  }

  if (result.failureCount > 0) {
    throw new Error(
      `Wishlist alert email delivery finished with ${result.failureCount} failure(s).`,
    );
  }
}

main().catch((error) => {
  const argv = process.argv.slice(2);
  const mode = (() => {
    try {
      return getRunMode(argv);
    } catch {
      return 'check';
    }
  })();
  const flowOptions = (() => {
    try {
      return getFlowOptions({
        argv,
      });
    } catch {
      return {
        maxEmailsToSend: undefined,
      };
    }
  })();

  console.error(
    `[wishlist-alerts] failed mode=${mode} channel=email send_cap=${flowOptions.maxEmailsToSend ?? 'none'}`,
  );
  if (error instanceof Error) {
    console.error(`[wishlist-alerts] error=${error.message}`);
  }
  console.error(error);
  process.exit(1);
});
