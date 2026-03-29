#!/usr/bin/env node

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3333';
const webBaseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
const setDetailPath = process.env.SET_DETAIL_PATH ?? '/sets/rivendell-10316';
const expectedSetText = process.env.SET_EXPECT_TEXT ?? 'Rivendell';

async function readResponse(url, expectedContentType) {
  const response = await fetch(url, {
    headers: {
      Accept: expectedContentType,
    },
  });

  return response;
}

function logPass(message) {
  console.log(`[smoke] pass: ${message}`);
}

function logFail(message) {
  console.error(`[smoke] fail: ${message}`);
}

async function main() {
  try {
    const healthResponse = await readResponse(
      `${apiBaseUrl}/health`,
      'application/json',
    );

    if (!healthResponse.ok) {
      throw new Error(`Health check returned ${healthResponse.status}.`);
    }

    const healthPayload = await healthResponse.json();

    if (healthPayload.status !== 'ok') {
      throw new Error('Health check payload did not report ok status.');
    }

    logPass(`API health responded from ${apiBaseUrl}/health`);

    const sessionResponse = await readResponse(
      `${apiBaseUrl}/api/v1/session`,
      'application/json',
    );

    if (!sessionResponse.ok) {
      throw new Error(`Session check returned ${sessionResponse.status}.`);
    }

    const sessionPayload = await sessionResponse.json();

    if (
      !sessionPayload ||
      !['anonymous', 'authenticated'].includes(sessionPayload.state)
    ) {
      throw new Error('Session payload did not include a valid state.');
    }

    logPass(`Session endpoint responded from ${apiBaseUrl}/api/v1/session`);

    const setDetailResponse = await readResponse(
      `${webBaseUrl}${setDetailPath}`,
      'text/html',
    );

    if (!setDetailResponse.ok) {
      throw new Error(`Set detail check returned ${setDetailResponse.status}.`);
    }

    const setDetailMarkup = await setDetailResponse.text();

    if (!setDetailMarkup.includes(expectedSetText)) {
      throw new Error(
        `Set detail response did not include expected text: ${expectedSetText}.`,
      );
    }

    logPass(`Set detail page responded from ${webBaseUrl}${setDetailPath}`);
    console.log('[smoke] MVP smoke checks passed.');
  } catch (error) {
    logFail(error instanceof Error ? error.message : 'Unknown smoke-check failure.');
    process.exit(1);
  }
}

await main();
