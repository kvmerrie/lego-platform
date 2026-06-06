import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'vitest';

const sourcePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'commerce-admin-cms-page.ts',
);

describe('commerce admin CMS page', () => {
  test('exposes homepage item description as editable metadata', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('<span>Description</span>');
    expect(source).toContain('name="itemDescription-{{ $index }}"');
    expect(source).toContain("'description'");
    expect(source).toContain('Stored as metadata_json.description.');
  });

  test('keeps description out of the raw metadata summary', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('description: _description,');
  });
});
