const path = require('path');
module.exports = function (webpackConfig) {
  const webpack = require('atool-build/lib/webpack');
  // remove common.js
  webpackConfig.plugins = webpackConfig.plugins.filter((plugin) => {
    const ret = !(plugin instanceof webpack.optimize.CommonsChunkPlugin);
    return ret;
  });
  const packageName = require(path.join(process.cwd(), 'package.json')).name;
  webpackConfig.resolve.alias = {
    [packageName]: process.cwd(),
  };
  const babelConfig = require('atool-build/lib/getBabelCommonConfig')();
  babelConfig.plugins.push([
    'antd',
    {
      style: true,
      libraryName: packageName,
      libDir: 'components',
    },
  ]);
  webpackConfig.module.loaders[0].query = babelConfig;
  webpackConfig.module.loaders[1].query = babelConfig;
  if (process.env.RUN_ENV === 'WEBSITE') {
    webpackConfig.entry = {
      index: './site/entry/index.jsx',
    };
    webpackConfig.resolve.root = process.cwd();
    webpackConfig.resolve.alias.site = 'site';
    const component = process.env.COMPONENT_STYLE;
    const componentRegExp = component &&
      new RegExp(`components/${component.toLowerCase()}/demo/.*\.md`);
    webpackConfig.module.loaders.push({
      test: componentRegExp || /\.md$/,
      exclude: /node_modules/,
      loaders: [`babel?${JSON.stringify(babelConfig)}`,
        require.resolve('antd-md-loader')],
    });
    if (component !== undefined) {
      webpackConfig.module.loaders.push({
        test: /\.md$/,
        exclude: [/node_modules/, componentRegExp],
        loaders: [`babel`,
          require.resolve('antd-md-loader')],
      });
    }
  } else if (process.env.RUN_ENV === 'PRODUCTION') {
    const entry = ['./index.js'];
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

    const uncompressedWebpackConfig = Object.assign({}, webpackConfig);
    uncompressedWebpackConfig.entry = {
      [packageName]: entry,
    };
    uncompressedWebpackConfig.plugins = webpackConfig.plugins.filter((plugin) => {
      const ret = !(plugin instanceof webpack.optimize.UglifyJsPlugin);
      return ret;
    });

    return [
      webpackConfig,
      uncompressedWebpackConfig,
    ];
  }

  return webpackConfig;
};
