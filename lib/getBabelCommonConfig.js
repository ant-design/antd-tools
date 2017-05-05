module.exports = function getBabelCommonConfig(modules) {
  const babelConfig = require('atool-build/lib/getBabelCommonConfig')();

  // atool-build use babel-preset-es2015-ie, but that not support `modules` config. ref:
  // https://github.com/ant-tool/atool-build/blob/08eee4e777fee75057a709fa465a067632169f1b/src/getBabelCommonConfig.js#L7
  // https://github.com/jmcriffey/babel-preset-es2015-ie/blob/master/index.js
  if (modules) {
    babelConfig.plugins.push(require.resolve('babel-plugin-add-module-exports'));
  }

  babelConfig.plugins.push([require.resolve('babel-plugin-transform-runtime'),
    { polyfill: false }]);
  return babelConfig;
};
