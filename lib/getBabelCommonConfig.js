'use strict';

module.exports = function (modules) {
  const plugins = [
    require.resolve('babel-plugin-transform-es3-member-expression-literals'),
    require.resolve('babel-plugin-transform-es3-property-literals'),
    require.resolve('babel-plugin-transform-object-assign'),
  ];
  if (modules !== false) {
    plugins.push(require.resolve('babel-plugin-add-module-exports'));
  }
  plugins.push([require.resolve('babel-plugin-transform-runtime'), {
    polyfill: false,
  }]);
  return {
    presets: [modules ? require.resolve('babel-preset-es2015') : [require.resolve('babel-preset-es2015'), {
      modules,
    }]].concat(['react', 'stage-0'].map((name) => {
      return require.resolve(`babel-preset-${name}`);
    })),
    plugins,
  };
};
