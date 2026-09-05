const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');
const transformer = require('../lib/jest/imagePreprocessor').default;

describe('imagePreprocessor', () => {
  let fixture;
  const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x80]);
  const options = { configString: '{}', supportsStaticESM: false, instrument: false };

  beforeEach(() => {
    fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'antd-tools-images-'));
  });

  afterEach(() => {
    fs.rmSync(fixture, { recursive: true, force: true });
  });

  function writeImage(name, bytes) {
    const filename = path.join(fixture, name);
    fs.writeFileSync(filename, bytes);
    return filename;
  }

  function transform(filename, transformOptions = options) {
    return transformer.process(fs.readFileSync(filename, 'utf8'), filename, transformOptions).code;
  }

  function runJest() {
    return spawnSync(
      process.execPath,
      [
        require.resolve('jest/bin/jest'),
        '--config',
        JSON.stringify({
          rootDir: fixture,
          cacheDirectory: path.join(fixture, 'cache'),
          testEnvironment: 'node',
          transform: { '\\.(png|jpg|gif|svg)$': require.resolve('../lib/jest/imagePreprocessor') },
        }),
        '--runInBand',
        '--no-watchman',
      ],
      { cwd: fixture, encoding: 'utf8', timeout: 15000 }
    );
  }

  it.each(['png', 'jpg', 'gif'])(
    'exports an executable %s data URL with the original bytes',
    ext => {
      const filename = writeImage(`image.${ext}`, binary);
      const context = { module: { exports: undefined } };
      vm.runInNewContext(transform(filename), context);
      const dataUrl = context.module.exports;
      expect(dataUrl).toMatch(/^data:image\/[^;]+;base64,/);
      expect(Buffer.from(dataUrl.split(',')[1], 'base64')).toEqual(binary);
    }
  );

  it('transforms SVGs without webpack-specific options', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>圖片</text></svg>';
    const filename = writeImage('image.svg', svg);
    const context = { module: { exports: undefined } };
    vm.runInNewContext(transform(filename), context);
    expect(context.module.exports).toMatch(/^data:image\/svg\+xml(?:;charset=utf-8)?;base64,/);
    expect(Buffer.from(context.module.exports.split(',')[1], 'base64').toString()).toBe(svg);
  });

  it('keeps large assets in memory without a webpack file-loader fallback', () => {
    const bytes = Buffer.concat([binary, Buffer.alloc(10001)]);
    const filename = writeImage('large.png', bytes);
    const context = { module: { exports: undefined } };
    vm.runInNewContext(transform(filename), context);
    expect(Buffer.from(context.module.exports.split(',')[1], 'base64')).toEqual(bytes);
  });

  it('exports an ES module when the caller supports static ESM', () => {
    const filename = writeImage('image.png', binary);
    const code = transform(filename, { ...options, supportsStaticESM: true });
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import image from ${JSON.stringify(
          `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
        )}; console.log(image);`,
      ],
      { encoding: 'utf8', timeout: 10000 }
    );
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(Buffer.from(result.stdout.trim().split(',')[1], 'base64')).toEqual(binary);
  });

  it('loads images in Jest and invalidates the cache for binary-only changes', () => {
    const first = Buffer.from([0x80]);
    const second = Buffer.from([0x81]);
    // Jest passes decoded text, which cannot distinguish these different files.
    expect(first.toString('utf8')).toBe(second.toString('utf8'));
    writeImage('image.png', first);
    fs.writeFileSync(
      path.join(fixture, 'image.test.js'),
      `const fs = require('fs');
test('preserves the image bytes', () => {
  const image = require('./image.png');
  expect(Buffer.from(image.split(',')[1], 'base64')).toEqual(fs.readFileSync(__dirname + '/image.png'));
});`
    );
    const initial = runJest();
    expect(initial.error).toBeUndefined();
    expect(initial.stdout + initial.stderr).toContain('1 passed');
    expect(initial.status).toBe(0);
    writeImage('image.png', second);
    const updated = runJest();
    expect(updated.error).toBeUndefined();
    expect(updated.stdout + updated.stderr).toContain('1 passed');
    expect(updated.status).toBe(0);
  });
});
