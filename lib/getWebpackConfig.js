const path = require('path');
const webpack = require('atool-build/lib/webpack');

const packageName = require(path.join(process.cwd(), 'package.json')).name;

module.exports = function (webpackConfig) {
  webpackConfig.resolve.alias = {
    [packageName]: process.cwd(),
  };

  const babelConfig = require('./getBabelCommonConfig')();

  const pluginImportOptions = [{
    style: true,
    libraryName: packageName,
    libraryDirectory: 'components',
  }];
  if (packageName !== 'antd') {
    pluginImportOptions.push({
      style: 'css',
      libraryName: 'antd',
    });
  }
  babelConfig.plugins.push([
    require.resolve('babel-plugin-import'),
    pluginImportOptions,
  ]);

  const loaders = webpackConfig.module.loaders;
  if (loaders[0]) {
    delete loaders[0].query;
  }
  if (loaders[1]) {
    delete loaders[1].query;
  }
  webpackConfig.babel = babelConfig;

  // remove common.js
  webpackConfig.plugins = webpackConfig.plugins.filter((plugin) => {
    const ret = !(plugin instanceof webpack.optimize.CommonsChunkPlugin);
    return ret;
  });

  if (process.env.RUN_ENV === 'PRODUCTION') {
    const entry = ['./index'];
    webpackConfig.entry = {
      [`${packageName}.min`]: entry,
    };
    webpackConfig.externals = {
      react: {
        root: 'React',
        commonjs2: 'react',
        commonjs: 'react',
        amd: 'react',
      },
      'react-dom': {
        root: 'ReactDOM',
        commonjs2: 'react-dom',
        commonjs: 'react-dom',
        amd: 'react-dom',
      },
    };
    webpackConfig.output.library = packageName;
    webpackConfig.output.libraryTarget = 'umd';

    // Add banner
    const pkg = require(path.join(process.cwd(), 'package.json'));
    /* eslint prefer-template:0 */
    webpackConfig.plugins.push(new webpack.BannerPlugin(
      pkg.name + ' v' + pkg.version +
      '\n\nCopyright 2015-present, Alipay, Inc.\nAll rights reserved.'
    ));

    const uncompressedWebpackConfig = Object.assign({}, webpackConfig);
    uncompressedWebpackConfig.entry = {
      [packageName]: entry,
    };
    uncompressedWebpackConfig.plugins = webpackConfig.plugins.filter((plugin) => {
      const ret = !(plugin instanceof webpack.optimize.UglifyJsPlugin);
      return ret;
    });

    uncompressedWebpackConfig.plugins = uncompressedWebpackConfig.plugins.filter((plugin) => {
      const ret = !(plugin instanceof webpack.DefinePlugin);
      return ret;
    });

    uncompressedWebpackConfig.plugins.push(new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
    }));

    return [
      webpackConfig,
      uncompressedWebpackConfig,
    ];
  }

  return webpackConfig;
};
