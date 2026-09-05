const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const preprocessor = require('../lib/jest/codePreprocessor');

const source = 'export const value = 1;';
const sourcePath = path.join(__dirname, 'fixtures/value.js');
const options = {
  config: { cwd: process.cwd(), rootDir: process.cwd() },
  configString: '{}',
  instrument: false,
  supportsDynamicImport: false,
  supportsExportNamespaceFrom: false,
  supportsStaticESM: false,
  supportsTopLevelAwait: false,
};

describe('codePreprocessor cache', () => {
  it('reuses the key for identical transform inputs', () => {
    expect(preprocessor.getCacheKey(source, sourcePath, options)).toBe(
      preprocessor.getCacheKey(source, sourcePath, options)
    );
  });

  it.each([
    ['source', 'export const value = 2;', sourcePath, options],
    ['path', source, path.join(__dirname, 'fixtures/other/value.js'), options],
    ['Jest config', source, sourcePath, { ...options, configString: '{"changed":true}' }],
    ['instrumentation', source, sourcePath, { ...options, instrument: true }],
  ])('invalidates the key when %s changes', (_, text, filename, transformOptions) => {
    expect(preprocessor.getCacheKey(text, filename, transformOptions)).not.toBe(
      preprocessor.getCacheKey(source, sourcePath, options)
    );
  });

  it('loads changed source on a second Jest run with the same cache', () => {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'antd-tools-jest-cache-'));
    const valueFile = path.join(fixture, 'value.js');
    fs.writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ dependencies: {} }));
    fs.writeFileSync(valueFile, 'module.exports = 1;');
    fs.writeFileSync(
      path.join(fixture, 'value.test.js'),
      'test("current source", () => expect(require("./value")).toBe(Number(process.env.EXPECTED_VALUE)));'
    );
    const config = JSON.stringify({
      rootDir: fixture,
      cacheDirectory: path.join(fixture, 'cache'),
      testEnvironment: 'node',
      transform: { '\\.js$': require.resolve('../lib/jest/codePreprocessor') },
    });
    const run = expected => {
      const result = spawnSync(
        process.execPath,
        [require.resolve('jest/bin/jest'), '--config', config, '--runInBand', '--no-watchman'],
        {
          cwd: fixture,
          env: { ...process.env, LIB_DIR: 'components', EXPECTED_VALUE: String(expected) },
          encoding: 'utf8',
          timeout: 15000,
        }
      );
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || String(result.error));
      }
    };
    try {
      run(1);
      fs.writeFileSync(valueFile, 'module.exports = 2;');
      run(2);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  }, 30000);
});
