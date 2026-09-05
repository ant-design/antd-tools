import * as crypto from 'crypto';
import { createTransformer } from 'babel-jest';
import getBabelCommonConfig from '../getBabelCommonConfig';
import rewriteSource from './rewriteSource';
import pkg from '../../package.json';
import * as babel from '@babel/core';

const libDir: string = process.env.LIB_DIR || 'components';

function processDemo({ types: t }: { types: typeof babel.types }): babel.PluginObj {
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

type CacheKey = NonNullable<ReturnType<typeof createTransformer>['getCacheKey']>;

interface Preprocessor {
  canInstrument: boolean;
  process(
    src: string,
    filePath: string,
    config: object,
    transformOptions: TransformOptions
  ): string;
  getCacheKey: CacheKey;
}

function getTransformer(filePath: string) {
  const babelConfig = getBabelCommonConfig();
  babelConfig.plugins = [...(babelConfig.plugins || [])];

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

  return {
    transformer: createTransformer(babelConfig),
    filename: /\.(t|j)sx?$/.test(filePath) ? filePath : 'file.js',
  };
}

const preprocessor: Preprocessor = {
  canInstrument: true,
  process(src, filePath, config, transformOptions) {
    global.__clearBabelAntdPlugin && global.__clearBabelAntdPlugin(); // eslint-disable-line
    const { transformer: babelJest, filename: name } = getTransformer(filePath);

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

  getCacheKey(src, filePath, options) {
    const { transformer, filename } = getTransformer(filePath);

    return crypto
      .createHash('md5')
      .update(transformer.getCacheKey(src, filename, options))
      .update('\0', 'utf8')
      .update(filePath)
      .update('\0', 'utf8')
      .update(libDir)
      .update('\0', 'utf8')
      .update(pkg.version)
      .digest('hex');
  },
};

module.exports = preprocessor;
