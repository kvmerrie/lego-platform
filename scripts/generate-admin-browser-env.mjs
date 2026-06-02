import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = process.cwd();
const outputPath = path.join(workspaceRoot, 'tmp/admin/admin-env.js');
const envFiles = ['.env', '.env.local', '.local.env'];
const publicEnvKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

function parseEnvLine(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine || trimmedLine.startsWith('#')) {
    return undefined;
  }

  const equalsIndex = trimmedLine.indexOf('=');

  if (equalsIndex < 1) {
    return undefined;
  }

  const key = trimmedLine.slice(0, equalsIndex).trim();
  let value = trimmedLine.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

async function readLocalEnvFiles() {
  const values = {};

  for (const envFile of envFiles) {
    try {
      const contents = await readFile(
        path.join(workspaceRoot, envFile),
        'utf8',
      );

      for (const line of contents.split(/\r?\n/)) {
        const entry = parseEnvLine(line);

        if (entry) {
          values[entry.key] = entry.value;
        }
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  return values;
}

const fileEnv = await readLocalEnvFiles();
const browserEnv = Object.fromEntries(
  publicEnvKeys.map((key) => [key, process.env[key] ?? fileEnv[key] ?? '']),
);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  [
    'window.__BRICKHUNT_ADMIN_ENV__ = Object.freeze(',
    JSON.stringify(browserEnv, null, 2),
    ');',
    '',
  ].join('\n'),
);

const configuredKeys = publicEnvKeys.filter((key) => browserEnv[key]);

console.log(
  `Generated tmp/admin/admin-env.js with ${configuredKeys.length}/${publicEnvKeys.length} public admin env keys.`,
);
