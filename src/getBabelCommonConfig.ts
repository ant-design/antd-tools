import fs from 'fs-extra';
import type { PluginItem, TransformOptions } from '@babel/core';
import { resolve, isThereHaveBrowserslistConfig } from './utils/projectHelper';

interface BabelConfigOptions {
  enabledReactCompiler?: boolean;
}

interface BabelConfig extends TransformOptions {
  cacheDirectory?: boolean;
}

function getBabelCommonConfig(modules?: boolean, options: BabelConfigOptions = {}): BabelConfig {
  const plugins: PluginItem[] = [
    [
      resolve('@babel/plugin-transform-typescript'),
      {
        isTSX: true,
      },
    ],
    [
      resolve('@babel/plugin-transform-runtime'),
      {
        useESModules: modules === false,
        version:
          fs.readJSONSync(`${process.cwd()}/package.json`).dependencies['@babel/runtime'] ||
          '^7.10.4',
      },
    ],
    resolve('@babel/plugin-transform-spread'),
    resolve('@babel/plugin-proposal-class-properties'),
    resolve('@babel/plugin-transform-classes'),
    resolve('babel-plugin-transform-dev-warning'),
    resolve('@babel/plugin-transform-private-methods'),
  ];
  if (options.enabledReactCompiler === true) {
    plugins.unshift([
      resolve('babel-plugin-react-compiler'),
      {
        target: '18', // 最低支持的版本是 React 18
      },
    ]);
  }
  return {
    presets: [
      resolve('@babel/preset-react'),
      [
        resolve('@babel/preset-env'),
        {
          modules,
          targets: isThereHaveBrowserslistConfig()
            ? undefined
            : {
                browsers: ['last 2 versions', 'Firefox ESR', '> 1%', 'ie >= 11'],
              },
        },
      ],
    ],
    plugins,
  };
}

export default getBabelCommonConfig;
