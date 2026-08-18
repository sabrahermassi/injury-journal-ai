import fs from 'node:fs';
import path from 'node:path';

describe('package.json scripts', () => {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  it('does not define a "dev" script', () => {
    expect(packageJson.scripts).not.toHaveProperty('dev');
  });

  it('still defines the core scripts required for the project', () => {
    expect(packageJson.scripts).toMatchObject({
      build: 'tsc',
      start: 'node dist/index.js',
      lint: 'eslint .',
      format: 'prettier --write .',
      test: 'jest',
      'test:integration': 'cross-env NODE_ENV=test jest tests/integration',
    });
  });
});

describe('.gitignore', () => {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  const gitignoreLines = gitignoreContent
    .split('\n')
    .map((line) => line.trim());

  it('ignores the Python virtual environment directory', () => {
    expect(gitignoreLines).toContain('.venv/');
  });

  it('ignores Python bytecode cache directories', () => {
    expect(gitignoreLines).toContain('__pycache__/');
  });

  it('still ignores node_modules, dist, and coverage', () => {
    expect(gitignoreLines).toContain('node_modules/');
    expect(gitignoreLines).toContain('dist/');
    expect(gitignoreLines).toContain('coverage/');
  });
});