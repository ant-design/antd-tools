import * as crypto from 'crypto';
import { createTransformer } from 'babel-jest';
import type { TransformerConfig } from 'babel-jest';
import getBabelCommonConfig from '../getBabelCommonConfig';
import rewriteSource from './rewriteSource';
import pkg from '../../package.json';
import * as babel from '@babel/core';

const libDir: string = process.env.LIB_DIR || 'components';

function processDemo({ types: t }: { types: typeof babel.types }): babel.PluginObject {
  return {
    visitor: {
      ImportDeclaration(path: babel.NodePath<babel.types.ImportDeclaration>) {
        rewriteSource(t, path, libDir);
      },
    },
  };
}

interface TransformOptions {
  instrument: boolean;
}

interface Preprocessor {
  canInstrument: boolean;
  process(
    src: string,
    filePath: string,
    config: object,
    transformOptions: TransformOptions
  ): string;
  getCacheKey(): string;
}

const preprocessor: Preprocessor = {
  canInstrument: true,
  process(src, filePath, config, transformOptions) {
    global.__clearBabelAntdPlugin?.();
    const babelConfig = getBabelCommonConfig();
    babelConfig.plugins = Array.isArray(babelConfig.plugins) ? [...babelConfig.plugins] : [];

    if (/\/demo\//.test(filePath)) {
      babelConfig.plugins.push(processDemo);
    }

    babelConfig.plugins.push([
      require.resolve('babel-plugin-import'),
      {
        libraryName: 'antd-mobile',
        libraryDirectory: '../../../../components',
      },
    ]);

    const babelSupport = /\.(t|j)sx?$/.test(filePath);

    type BabelJestTransformer = Exclude<ReturnType<typeof createTransformer>, Promise<unknown>>;

    const babelJest = createTransformer(babelConfig as TransformerConfig) as BabelJestTransformer;

    const name = babelSupport ? filePath : 'file.js';

    type ProcessParams = Parameters<typeof babelJest.process>;

    return (
      babelJest.process as unknown as (
        src: ProcessParams[0],
        name: ProcessParams[1],
        config: object,
        transformOptions: TransformOptions
      ) => string
    )(src, name, config, transformOptions);
  },

  getCacheKey() {
    return crypto
      .createHash('md5')
      .update('\0', 'utf8')
      .update(libDir)
      .update('\0', 'utf8')
      .update(pkg.version)
      .digest('hex');
  },
};

module.exports = preprocessor;
