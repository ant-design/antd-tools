const { relative } = require('path');
const crypto = require('crypto');
const markTwain = require('mark-twain');
const JsonML = require('jsonml.js/lib/utils');
const babel = require('@babel/core');
const getBabelCommonConfig = require('../getBabelCommonConfig');
const rewriteSource = require('./rewriteSource');
const pkg = require('../../package.json');

const libDir = process.env.LIB_DIR || 'components';

function getCode(tree) {
  let code;
  const find = node => {
    if (code) return;
    if (!JsonML.isElement(node)) return;
    if (JsonML.getTagName(node) !== 'pre') {
      JsonML.getChildren(node).forEach(find);
      return;
    }
    code = JsonML.getChildren(JsonML.getChildren(node)[0] || '')[0] || '';
  };
  find(tree);
  return code;
}

function createDemo({ types: t }) {
  return {
    visitor: {
      Program(path) {
        // Only insert `import React from 'react'` when not exist
        const existReact = (path.node.body || []).some(importNode => {
          // Skip if is not import
          if (importNode.type !== 'ImportDeclaration' || importNode.source.value !== 'react') {
            return false;
          }

          return (importNode.specifiers || []).some(
            specifierNode =>
              // Skip if is not Specifier: `* as React` or `React`
              ['ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(specifierNode.type) &&
              specifierNode.local.name === 'React'
          );
        });

        if (!existReact) {
          const importReact = t.ImportDeclaration(
            [t.importDefaultSpecifier(t.Identifier('React'))],
            t.StringLiteral('react')
          );
          path.unshiftContainer('body', importReact);
        }
      },

      CallExpression(path) {
        if (
          path.node.callee.object &&
          path.node.callee.object.name === 'ReactDOM' &&
          path.node.callee.property.name === 'render'
        ) {
          const app = t.VariableDeclaration('const', [
            t.VariableDeclarator(t.Identifier('__Demo'), path.node.arguments[0]),
          ]);
          // 参考 https://github.com/babel/babel/blob/8d492b159b342cfd1f399e4292e3cb12a895e1d3/packages/babel-plugin-transform-typescript/src/enum.js#L28
          path.scope.registerDeclaration(path.replaceWith(app)[0]);
          const exportDefault = t.ExportDefaultDeclaration(t.Identifier('__Demo'));
          path.insertAfter(exportDefault);
          path.insertAfter(app);
          path.remove();
        }
      },

      ImportDeclaration(path) {
        const libPattern = new RegExp('antd(-mobile)?/lib/.+');
        if (libPattern.test(path.node.source.value)) {
          path.node.source.value = path.node.source.value.replace(
            /antd(-mobile)?\/lib/,
            '../../../components'
          );
        }
        rewriteSource(t, path, libDir);
      },
    },
  };
}

module.exports = {
  process(src, path) {
    const markdown = markTwain(src);
    src = getCode(markdown.content);

    // @ @ secret API.
    global.__clearBabelAntdPlugin && global.__clearBabelAntdPlugin(); // eslint-disable-line

    const babelConfig = getBabelCommonConfig();
    babelConfig.plugins = [...babelConfig.plugins];

    babelConfig.plugins.push(createDemo);

    if (libDir !== 'dist') {
      babelConfig.plugins.push([
        require.resolve('babel-plugin-import'),
        {
          libraryName: 'antd',
          libraryDirectory: `../../../../${libDir}`,
        },
        'antd-import',
      ]);
      babelConfig.plugins.push([
        require.resolve('babel-plugin-import'),
        {
          libraryName: 'antd-mobile',
          libraryDirectory: `../../../../${libDir}`,
        },
        'antd-mobile-import',
      ]);
    }

    babelConfig.filename = path;

    src = babel.transform(src, babelConfig).code;

    return {
      code: src,
    };
  },

  getCacheKey(fileData, filename, options) {
    const { instrument, config, configString } = options;

    return crypto
      .createHash('md5')
      .update(fileData)
      .update('\0', 'utf8')
      .update(relative(config.rootDir, filename))
      .update('\0', 'utf8')
      .update(configString)
      .update('\0', 'utf8')
      .update(instrument ? 'instrument' : '')
      .update('\0', 'utf8')
      .update(libDir)
      .update('\0', 'utf8')
      .update(pkg.version)
      .digest('hex');
  },
};
