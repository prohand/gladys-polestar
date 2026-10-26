import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rollChangelog } from '../.github/scripts/changelog-release.mjs';

const REPO = 'https://github.com/prohand/gladys-polestar';

test('the Unreleased section moves under the released version', () => {
  const text = [
    '# Changelog',
    '',
    'Describe each change under `## [Unreleased]`.',
    '',
    '## [Unreleased]',
    '',
    '### Added',
    '',
    '- Something.',
    '',
    `[Unreleased]: ${REPO}/commits/main`,
    '',
  ].join('\n');

  const rolled = rollChangelog(text, '1.0.0', '2026-10-26');

  assert.match(
    rolled,
    /## \[Unreleased\]\n\n## \[1\.0\.0\] - 2026-10-26\n\n### Added\n\n- Something\./,
  );
  assert.match(rolled, new RegExp(`\\[Unreleased\\]: ${REPO}/compare/v1\\.0\\.0\\.\\.\\.HEAD`));
  assert.match(rolled, new RegExp(`\\[1\\.0\\.0\\]: ${REPO}/releases/tag/v1\\.0\\.0`));
});

test('an empty Unreleased section still names the release', () => {
  const rolled = rollChangelog('## [Unreleased]\n', '1.0.1', '2026-10-27');
  assert.match(rolled, /## \[1\.0\.1\] - 2026-10-27\n\n- Maintenance release/);
});

test('the changelog of this repository can be rolled', async () => {
  const text = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  assert.match(text, /^## \[Unreleased\]$/m);
  assert.notEqual(rollChangelog(text, '9.9.9', '2026-01-01'), text);
});
