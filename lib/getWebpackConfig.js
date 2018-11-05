const path = require('path');
const webpack = require('webpack');
const WebpackBar = require('webpackbar');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const UglifyJsWebpackPlugin = require('uglifyjs-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const merge = require('webpack-merge');
const replaceLib = require('./replaceLib');
const getWebpackLoaders = require('./getWebpackLoaders');

function getNodeEnv() {
  const { NODE_ENV } = process.env;
  if (NODE_ENV) return NODE_ENV;

  return String(process.env.RUN_ENV).toLowerCase();
}

module.exports = function (modules) {
  const pkg = require(path.join(process.cwd(), 'package.json'));
  const babelConfig = require('./getBabelCommonConfig')(modules || false);
  const NODE_ENV = getNodeEnv();
  const loaders = getWebpackLoaders(NODE_ENV);
  const DIST_PATH = path.join(process.cwd(), 'dist');

  const pluginImportOptions = [
    {
      style: true,
      libraryName: pkg.name,
      libraryDirectory: 'components',
    },
  ];

  if (pkg.name !== 'antd') {
    pluginImportOptions.push({
      style: 'css',
      libraryDirectory: 'es',
      libraryName: 'antd',
    });
  }

  babelConfig.plugins.push([
    require.resolve('babel-plugin-import'),
    pluginImportOptions,
  ]);

  if (modules === false) {
    babelConfig.plugins.push(replaceLib);
  }

  const config = merge([
    {
      mode: NODE_ENV,
      output: {
        path: DIST_PATH,
        filename: '[name].js',
        chunkFilename: '[name].js',
      },

      resolve: {
        modules: ['node_modules', path.join(__dirname, '../node_modules')],
        extensions: [
          '.web.tsx',
          '.web.ts',
          '.web.jsx',
          '.web.js',
          '.ts',
          '.tsx',
          '.js',
          '.jsx',
          '.json',
        ],
        alias: {
          [pkg.name]: process.cwd(),
        },
      },

      node: [
        'child_process',
        'cluster',
        'dgram',
        'dns',
        'fs',
        'module',
        'net',
        'readline',
        'repl',
        'tls',
      ].reduce((acc, name) => Object.assign({}, acc, { [name]: 'empty' }), {}),

      module: {
        noParse: [/moment.js/],
      },
    },
    loaders.loadCSS(),
    loaders.loadTs(),
    loaders.loadJs(),

    {
      plugins: [
        // TODO: remove at webpack5
        new MiniCssExtractPlugin({
          filename:
            NODE_ENV === 'development'
              ? '[name].css'
              : '[name].[contenthash].css',

          chunkFilename: '[id].css',
        }),
        new CaseSensitivePathsPlugin(),
        new webpack.BannerPlugin(`
${pkg.name} v${pkg.version}

Copyright 2015-present, Alipay, Inc.
All rights reserved.
      `),
        new WebpackBar({
          name: '📦  Webpack',
          minimal: false,
        }),
      ],
    },
  ]);

  const productionConfig = {
    entry: {
      [`${pkg.name}.min`]: ['./index'],
    },
    recordsPath: path.join(DIST_PATH, 'records.json'),
    devtool: 'source-map',
    output: {
      filename: '[name].[chunkhash:4].js',
      chunkFilename: '[name].[chunkhash:4].js',
      library: pkg.name,
      libraryTarget: 'umd',
    },
    externals: {
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
    },
    optimization: {
      /**
       *  Give there are more request to perform,
       *  there's a slight overhead.
       *  But the benefit of caching makes up for this cost.
       * @see https://survivejs.com/webpack/building/bundle-splitting/
       */
      splitChunks: {
        cacheGroups: {
          commons: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'initial',
          },
          /**
           * @todo Separate manifest
           * Need to load separate manifest
           * SPA: html-webpack-plugin
           * SSR: use the webpack-plugin that generate chunks list
           * @see https://survivejs.com/webpack/optimizing/separating-manifest/
           */
          // runtimeChunk: {
          //   name: 'manifest',
          // },
        },
      },
      minimizer: [
        new UglifyJsWebpackPlugin({
          cache: true,
          parallel: require('os').cpus().length,
          sourceMap: true,
          output: {
            ascii_only: true,
          },
        }),
      ],
    },
    plugins: [
      new webpack.optimize.AggressiveSplittingPlugin({
        minSize: 10000,
        maxSize: 30000,
      }),
      new webpack.optimize.ModuleConcatenationPlugin(),
    ],
  };

  if (NODE_ENV === 'production') {
    return merge(config, productionConfig);
  }

  return config;
};
