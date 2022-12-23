const { resolve, isThereHaveBrowserslistConfig } = require('./utils/projectHelper');

module.exports = function (modules) {
  const plugins = [
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
          require(`${process.cwd()}/package.json`).dependencies['@babel/runtime'] || '^7.10.4',
      },
    ],
    resolve('@babel/plugin-transform-spread'),
    resolve('@babel/plugin-proposal-class-properties'),
    resolve('@babel/plugin-transform-classes'),
    resolve('babel-plugin-transform-dev-warning'),
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
};
