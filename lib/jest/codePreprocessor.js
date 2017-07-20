const typescript = require('typescript');
const { createTransformer } = require('babel-jest');
const getBabelCommonConfig = require('../getBabelCommonConfig');
const getTSCommonConfig = require('../getTSCommonConfig');
const rewriteSource = require('./rewriteSource');

const libDir = process.env.LIB_DIR || 'components';

function processDemo({ types: t }) {
  return {
    visitor: {
      ImportDeclaration(path) {
        rewriteSource(t, path, libDir);
      },
    },
  };
}

module.exports = {
  process(src, path) {
    const isTypeScript = path.endsWith('.ts') || path.endsWith('.tsx');
    const isJavaScript = path.endsWith('.js') || path.endsWith('.jsx');

    if (isTypeScript) {
      src = typescript.transpile(
        src,
        getTSCommonConfig(),
        path,
        [],
      );
    }

    if (isJavaScript || isTypeScript) {
      // @ @ secret API.
      global.__clearBabelAntdPlugin && global.__clearBabelAntdPlugin(); // eslint-disable-line

      const babelConfig = getBabelCommonConfig(true);
      babelConfig.plugins = [...babelConfig.plugins];

      if (/\/demo\//.test(path)) {
        babelConfig.plugins.push(processDemo);
      }

      babelConfig.plugins.push([
        require.resolve('babel-plugin-import'),
        {
          libraryName: 'antd-mobile',
          libraryDirectory: '../../../../components',
        },
      ]);

      const babelJest = createTransformer(babelConfig);
      const fileName = isJavaScript ? path : 'file.js';
      src = babelJest.process(src, fileName);
    }

    return src;
  },
};
