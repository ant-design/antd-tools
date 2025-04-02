import { relative } from 'path';
import crypto from 'crypto';
import markTwain from 'mark-twain';
import * as JsonML from 'jsonml.js/lib/utils';
import * as babel from '@babel/core';
import getBabelCommonConfig from '../getBabelCommonConfig';
import rewriteSource from './rewriteSource';
import pkg from '../../package.json';

const libDir: string = process.env.LIB_DIR || 'components';

function getCode(tree: unknown): string {
  let code: string = '';
  const find = (node: unknown): void => {
    if (code) return;
    if (!JsonML.isElement(node)) return;
    if (JsonML.getTagName(node) !== 'pre') {
      (JsonML.getChildren(node) as unknown[]).forEach(find);
      return;
    }
    if ((JsonML.getAttributes(node) || {}).lang !== 'diff') {
      code =
        ((JsonML.getChildren(JsonML.getChildren(node)[0] || '') as unknown[])[0] as string) || '';
    }
  };
  find(tree);
  return code;
}

function createDemo({ types: t }: { types: typeof babel.types }): babel.PluginObj {
  return {
    visitor: {
      Program(path) {
        // Only insert `import React from 'react'` when not exist
        const existReact = (path.node.body || []).some(importNode => {
          if (importNode.type !== 'ImportDeclaration' || importNode.source.value !== 'react') {
            return false;
          }
          return (importNode.specifiers || []).some(
            specifierNode =>
              ['ImportDefaultSpecifier', 'ImportNamespaceSpecifier'].includes(specifierNode.type) &&
              specifierNode.local.name === 'React'
          );
        });

        if (!existReact) {
          const importReact = t.importDeclaration(
            [t.importDefaultSpecifier(t.identifier('React'))],
            t.stringLiteral('react')
          );
          path.unshiftContainer('body', importReact);
        }
      },

      CallExpression(path) {
        if (
          path.node.callee.object &&
          (path.node.callee.object as { name: string }).name === 'ReactDOM' &&
          path.node.callee.property.name === 'render'
        ) {
          const app = t.variableDeclaration('const', [
            t.variableDeclarator(t.identifier('__Demo'), path.node.arguments[0]),
          ]);
          path.scope.registerDeclaration(path.replaceWith(app)[0]);
          const exportDefault = t.exportDefaultDeclaration(t.identifier('__Demo'));
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

interface ProcessResult {
  code: string;
}

interface GetCacheKeyOptions {
  instrument: boolean;
  config: { rootDir: string };
  configString: string;
}

function process(src: string, pathFilename: string): ProcessResult {
  const markdown = markTwain(src);
  src = getCode(markdown.content);

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

  babelConfig.filename = pathFilename;

  src = babel.transform(src, babelConfig)!.code as string;

  return {
    code: src,
  };
}

function getCacheKey(fileData: string, filename: string, options: GetCacheKeyOptions): string {
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
}

export default {
  process,
  getCacheKey,
};
