const { resolve } = require('./utils/projectHelper');

module.exports = function(modules) {
  const plugins = [
    resolve('@babel/plugin-transform-member-expression-literals'),
    resolve('@babel/plugin-transform-object-assign'),
    resolve('@babel/plugin-transform-property-literals'),
    resolve('@babel/plugin-transform-runtime'),
    resolve('@babel/plugin-transform-spread'),
    resolve('@babel/plugin-transform-template-literals'),
    resolve('@babel/plugin-proposal-class-properties'),
    resolve('@babel/plugin-proposal-export-default-from'),
    resolve('@babel/plugin-proposal-export-namespace-from'),
    resolve('@babel/plugin-proposal-object-rest-spread'),
    [
      resolve('@babel/plugin-proposal-decorators'),
      {
        decoratorsBeforeExport: true,
      },
    ],
  ];
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
