'use strict';

const resolve = x => require.resolve(x);

module.exports = function (modules) {
  const plugins = [
    '@babel/plugin-transform-template-literals',
    '@babel/plugin-transform-member-expression-literals',
    '@babel/plugin-transform-property-literals',

    '@babel/plugin-transform-object-assign',
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-export-default-from',
    '@babel/plugin-proposal-export-namespace-from',
  ]
    .map(resolve)
    .push(
      [
        resolve('@babel/plugin-transform-runtime'),
        {
          polyfill: false,
          include: ['@babel/plugin-transform-spread'],
        },
      ],
      [
        resolve('@babel/plugin-proposal-decorators'),
        {
          decoratorsBeforeExport: true,
        },
      ],
      resolve('@babel/plugin-proposal-class-properties')
    );

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
