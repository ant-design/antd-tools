import { resolve, isThereHaveBrowserslistConfig } from './utils/projectHelper';
import fs from 'fs-extra';
import type { TransformOptions } from '@babel/core';

interface BabelConfig extends TransformOptions {
  cacheDirectory?: boolean;
}

export default function getBabelCommonConfig(modules?: boolean): BabelConfig {
  const plugins = [
    [
      resolve('babel-plugin-react-compiler'),
      {
        target: '18', // 最低支持的版本是 React 18
      },
    ],
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
