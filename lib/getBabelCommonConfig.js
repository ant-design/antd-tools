'use strict';

const resolve = x => require.resolve(x);

module.exports = function (modules) {
  const plugins = [
    '@babel/plugin-transform-runtime',
    '@babel/plugin-transform-member-expression-literals',
    '@babel/plugin-transform-property-literals',

    '@babel/plugin-transform-object-assign',
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-export-namespace-from',

    /**
     * @todo integrate with babel-preset-env
     * @see https://babeljs.io/docs/en/next/babel-preset-env.html#include
     * @see https://github.com/babel/babel/blob/master/packages/babel-prset-env/data/plugin-features.js
     * @see https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/shipped-proposals.js
     */
    '@babel/plugin-transform-template-literals',
    '@babel/plugin-transform-spread',
    '@babel/plugin-proposal-object-rest-spread',
  ]
    .map(resolve)
    .concat([
      [
        resolve('@babel/plugin-proposal-decorators'),
        {
          decoratorsBeforeExport: true,
        },
      ],
      resolve('@babel/plugin-proposal-class-properties'),
    ]);

  return {
    presets: [
      resolve('@babel/preset-react'),
      [
        resolve('@babel/preset-env'),
        {
          modules,
          targets: {
            browsers: [
              'last 2 versions',
              'Firefox ESR',
              '> 1%',
              'ie >= 9',
              'iOS >= 8',
              'Android >= 4',
            ],
          },
        },
      ],
    ],
    plugins,
  };
};
