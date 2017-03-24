const argv = require('yargs').argv;

module.exports = function getBabelCommonConfig() {
  const babelConfig = require('atool-build/lib/getBabelCommonConfig')();

  babelConfig.plugins.push([
    require.resolve('babel-plugin-transform-runtime'),
    { polyfill: false },
  ]);
  if (argv.ie) {
    babelConfig.plugins.push([
      require.resolve('transform-es2015-classes'),
      { loose: true },
    ]);
    babelConfig.plugins.push(require.resolve('transform-proto-to-assign'));
  }
  return babelConfig;
};
