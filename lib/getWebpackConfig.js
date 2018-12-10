// We need hack the require to ensure use package module first
// For example, `typescript` is required by `gulp-typescript` but provided by `antd`
const { getProjectPath, resolve, injectRequire } = require('./utils/projectHelper'); // eslint-disable-line import/order

injectRequire();

// Normal requirement
const path = require('path');
const webpack = require('webpack');
const WebpackBar = require('webpackbar');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const deepAssign = require('deep-assign');
const replaceLib = require('./replaceLib');
const postcssConfig = require('./postcssConfig');
const CleanUpStatsPlugin = require('./utils/CleanUpStatsPlugin');

module.exports = function(modules) {
  const pkg = require(getProjectPath('package.json'));
  const babelConfig = require('./getBabelCommonConfig')(modules || false);

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

  babelConfig.plugins.push([resolve('babel-plugin-import'), pluginImportOptions]);

  if (modules === false) {
    babelConfig.plugins.push(replaceLib);
  }

  const config = {
    devtool: 'source-map',

    output: {
      path: getProjectPath('./dist/'),
      filename: '[name].js',
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
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
          options: babelConfig,
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: 'babel-loader',
              options: babelConfig,
            },
            {
              loader: resolve('ts-loader'),
              options: {
                transpileOnly: true,
              },
            },
          ],
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
              },
            },
            {
              loader: 'postcss-loader',
              options: Object.assign({}, postcssConfig, { sourceMap: true }),
            },
          ],
        },
        {
          test: /\.less$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
              },
            },
            {
              loader: 'postcss-loader',
              options: Object.assign({}, postcssConfig, { sourceMap: true }),
            },
            {
              loader: 'less-loader',
              options: {
                sourceMap: true,
              },
            },
          ],
        },
      ],
    },

    plugins: [
      new MiniCssExtractPlugin(),
      new CaseSensitivePathsPlugin(),
      new webpack.BannerPlugin(`
${pkg.name} v${pkg.version}

Copyright 2015-present, Alipay, Inc.
All rights reserved.
      `),
      new WebpackBar({
        name: '🚚  Ant Design Tools',
      }),

      new CleanUpStatsPlugin(),
    ],
  };

  if (process.env.RUN_ENV === 'PRODUCTION') {
    const entry = ['./index'];

    // Production
    config.entry = {
      [`${pkg.name}.min`]: entry,
    };
    config.externals = {
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
    config.output.library = pkg.name;
    config.output.libraryTarget = 'umd';
    config.optimization = {
      minimizer: [
        new UglifyJsPlugin({
          cache: true,
          parallel: true,
          sourceMap: true,
          uglifyOptions: {
            warnings: false,
          },
        }),
      ],
    };

    // Development
    const uncompressedConfig = deepAssign({}, config);

    config.plugins = config.plugins.concat([
      new webpack.optimize.ModuleConcatenationPlugin(),
      new webpack.LoaderOptionsPlugin({
        minimize: true,
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      }),
    ]);

    uncompressedConfig.entry = {
      [pkg.name]: entry,
    };

    uncompressedConfig.plugins.push(
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('development'),
      })
    );

    // return [config, uncompressedConfig];
    return [uncompressedConfig];
  }

  return config;
};
