export interface ScheduledJobFailureClassification {
  exitCode: 0 | 1;
  failureType:
    | 'config'
    | 'malformed_payload'
    | 'supabase_write'
    | 'transient_network'
    | 'upstream_invalid_response'
    | 'upstream_http'
    | 'unknown';
  recoverable: boolean;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function classifyHttpStatus(status: number): ScheduledJobFailureClassification {
  if ([408, 403, 429, 500, 502, 503, 504].includes(status)) {
    return {
      exitCode: 0,
      failureType: 'upstream_http',
      recoverable: true,
    };
  }

  return {
    exitCode: 1,
    failureType: 'upstream_http',
    recoverable: false,
  };
}

function isRecoverableUpstreamInvalidResponse(
  normalizedMessage: string,
): boolean {
  return (
    normalizedMessage.includes('did not include a body') ||
    normalizedMessage.includes('empty body') ||
    normalizedMessage.includes('html response') ||
    normalizedMessage.includes('returned html') ||
    normalizedMessage.includes('received html') ||
    normalizedMessage.includes('non-xml upstream response') ||
    normalizedMessage.includes('cloudflare challenge') ||
    normalizedMessage.includes('unexpected token <')
  );
}

export function classifyScheduledJobFailure(
  error: unknown,
): ScheduledJobFailureClassification {
  const message = getErrorMessage(error);
  const normalizedMessage = message.toLowerCase();
  const httpStatusMatch = message.match(
    /\b(?:request failed with|returned|status)\s+(\d{3})\b/i,
  );

  if (
    normalizedMessage.includes('missing:') ||
    normalizedMessage.includes('requires supabase') ||
    normalizedMessage.includes('not configured') ||
    /\bset [A-Z0-9_]+/i.test(message)
  ) {
    return {
      exitCode: 1,
      failureType: 'config',
      recoverable: false,
    };
  }

  if (
    normalizedMessage.includes('supabase') ||
    normalizedMessage.includes('unable to persist') ||
    normalizedMessage.includes('unable to upsert') ||
    normalizedMessage.includes('unable to update')
  ) {
    return {
      exitCode: 1,
      failureType: 'supabase_write',
      recoverable: false,
    };
  }

  if (isRecoverableUpstreamInvalidResponse(normalizedMessage)) {
    return {
      exitCode: 0,
      failureType: 'upstream_invalid_response',
      recoverable: true,
    };
  }

  if (
    normalizedMessage.includes('xml is missing') ||
    normalizedMessage.includes('response is invalid') ||
    normalizedMessage.includes('product is invalid') ||
    normalizedMessage.includes('malformed')
  ) {
    return {
      exitCode: 1,
      failureType: 'malformed_payload',
      recoverable: false,
    };
  }

  if (httpStatusMatch?.[1]) {
    const httpStatus = Number(httpStatusMatch[1]);

    if (httpStatus === 404 && normalizedMessage.includes('origin_mode=ip')) {
      return {
        exitCode: 0,
        failureType: 'upstream_http',
        recoverable: true,
      };
    }

    return classifyHttpStatus(httpStatus);
  }

  if (
    normalizedMessage.includes('fetch failed') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('timed out') ||
    normalizedMessage.includes('timeout') ||
    normalizedMessage.includes('aborted') ||
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === 'AbortError' || error.name === 'TimeoutError'))
  ) {
    return {
      exitCode: 0,
      failureType: 'transient_network',
      recoverable: true,
    };
  }

  return {
    exitCode: 1,
    failureType: 'unknown',
    recoverable: false,
  };
}

export function logScheduledJobFailure({
  context,
  error,
  jobName,
}: {
  context: string;
  error: unknown;
  jobName: string;
}): ScheduledJobFailureClassification {
  const classification = classifyScheduledJobFailure(error);
  const status = classification.recoverable ? 'degraded' : 'failed';
  const log = classification.recoverable ? console.warn : console.error;

  log(
    `[${jobName}] ${status} ${context} failure_type=${classification.failureType} recoverable=${classification.recoverable} fresh_import=false`,
  );

  if (error instanceof Error) {
    log(`[${jobName}] error=${error.message}`);
  } else {
    log(`[${jobName}] error=${String(error)}`);
  }

  if (!classification.recoverable) {
    console.error(error);
  }

  return classification;
}
