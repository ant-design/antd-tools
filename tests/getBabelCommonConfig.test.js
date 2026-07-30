const { transformSync } = require('@babel/core');
const path = require('path');

describe('getBabelCommonConfig', () => {
  it('transforms static class blocks before classes', () => {
    const originalCwd = process.cwd();
    process.chdir(path.join(__dirname, 'fixtures/browserslist-project'));

    try {
      const configPath = require.resolve('../lib/getBabelCommonConfig');
      const projectHelperPath = require.resolve('../lib/utils/projectHelper');
      delete require.cache[configPath];
      delete require.cache[projectHelperPath];
      const getBabelCommonConfig = require(configPath).default;

      const { code } = transformSync(
        `
          export class Example {
            #value;
            static #ready;

            static {
              this.#ready = true;
            }
          }
        `,
        getBabelCommonConfig(),
      );

      expect(code).not.toContain('static {');
    } finally {
      process.chdir(originalCwd);
    }
  });
});
