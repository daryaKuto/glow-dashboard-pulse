import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { globSync } from 'glob';

const PROJECT_ROOT = resolve(__dirname, '..', '..');

const readText = (file: string) => readFileSync(file, 'utf8');

describe('ThingsBoard client decommission', () => {
  it('contains no remaining imports of the legacy ThingsBoard service', () => {
    const files = globSync('src/**/*.{ts,tsx}', {
      cwd: PROJECT_ROOT,
      ignore: ['**/*.d.ts'],
    });

    const offenders = files.filter((file) => {
      const fullPath = join(PROJECT_ROOT, file);
      const content = readText(fullPath);
      return content.includes("@/services/thingsboard");
    });

    expect(offenders).toEqual([]);
  });

  it('never targets thingsboard.cloud directly', () => {
    const files = globSync('src/**/*.{ts,tsx}', {
      cwd: PROJECT_ROOT,
      ignore: ['**/*.d.ts'],
    });

    const offenders = files.filter((file) => {
      const fullPath = join(PROJECT_ROOT, file);
      const content = readText(fullPath);
      return /thingsboard\.cloud/i.test(content);
    });

    expect(offenders).toEqual([]);
  });
});
