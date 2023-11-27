const { getProjectPath, resolve, injectRequire } = require('./utils/projectHelper'); // eslint-disable-line import/order

injectRequire();

// Show warning for webpack
process.traceDeprecation = true;

// Normal requirement
const path = require('path');
const webpack = require('webpack');
const WebpackBar = require('webpackbar');
const webpackMerge = require('webpack-merge');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CleanUpStatsPlugin = require('./utils/CleanUpStatsPlugin');

const svgRegex = /\.svg(\?v=\d+\.\d+\.\d+)?$/;
const svgOptions = {
  limit: 10000,
  minetype: 'image/svg+xml',
};

const imageOptions = {
  limit: 10000,
};

function getWebpackConfig(modules) {
  const pkg = require(getProjectPath('package.json'));
  const babelConfig = require('./getBabelCommonConfig')(modules || false);

  // babel import for components
  babelConfig.plugins.push([
    resolve('babel-plugin-import'),
    {
      style: true,
      libraryName: pkg.name,
      libraryDirectory: 'components',
    },
  ]);

  // Other package
  if (pkg.name !== 'antd') {
    babelConfig.plugins.push([
      resolve('babel-plugin-import'),
      {
        style: 'css',
        libraryDirectory: 'es',
        libraryName: 'antd',
      },
      'other-package-babel-plugin-import',
    ]);
  }

  if (modules === false) {
    babelConfig.plugins.push(require.resolve('./replaceLib'));
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
      fallback: [
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
      ].reduce(
        (acc, name) => ({
          ...acc,
          [name]: false,
        }),
        {}
      ),
    },

    module: {
      noParse: [/moment.js/],
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: resolve('babel-loader'),
          options: babelConfig,
        },
        {
          test: /\.tsx?$/,
          use: [
            {
              loader: resolve('babel-loader'),
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
              loader: resolve('css-loader'),
              options: {
                sourceMap: true,
              },
            },
            {
              loader: resolve('postcss-loader'),
              options: {
                postcssOptions: {
                  plugins: ['autoprefixer'],
                },
                sourceMap: true,
              },
            },
          ],
        },

        // Images
        {
          test: svgRegex,
          loader: resolve('url-loader'),
          options: svgOptions,
        },
        {
          test: /\.(png|jpg|jpeg|gif)(\?v=\d+\.\d+\.\d+)?$/i,
          loader: resolve('url-loader'),
          options: imageOptions,
        },
      ],
    },

    ignoreWarnings: [
      {
        message: /mini-css-extract-plugin[^]*Conflicting order between:/,
      },
    ],

    plugins: [
      new CaseSensitivePathsPlugin(),
      new webpack.BannerPlugin(`
${pkg.name} v${pkg.version}

Copyright 2015-present, Alipay, Inc.
All rights reserved.
      `),
      new WebpackBar({
        name: '🚚  Ant Design Tools',
        color: '#2f54eb',
      }),
      new CleanUpStatsPlugin(),
    ],

    performance: {
      hints: false,
    },
  };

  if (process.env.RUN_ENV === 'PRODUCTION') {
    const entry = ['./index'];

    // Common config
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
    config.output.globalObject = 'this';
    config.optimization = {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          minify: TerserPlugin.uglifyJsMinify,
          terserOptions: {
            warnings: false,
          },
        }),
      ],
    };

    // Development
    const uncompressedConfig = webpackMerge({}, config, {
      entry: {
        [pkg.name]: entry,
      },
      mode: 'development',
      plugins: [
        new MiniCssExtractPlugin({
          filename: '[name].css',
        }),
      ],
    });

    // Production
    const prodConfig = webpackMerge({}, config, {
      entry: {
        [`${pkg.name}.min`]: entry,
      },
      mode: 'production',
      plugins: [
        new webpack.LoaderOptionsPlugin({
          minimize: true,
        }),
        new MiniCssExtractPlugin({
          filename: '[name].css',
        }),
      ],
      optimization: {
        minimize: true,
        minimizer: [new CssMinimizerPlugin({})],
      },
    });

    return [prodConfig, uncompressedConfig];
  }

  return [config];
}

getWebpackConfig.webpack = webpack;
getWebpackConfig.svgRegex = svgRegex;
getWebpackConfig.svgOptions = svgOptions;
getWebpackConfig.imageOptions = imageOptions;

module.exports = getWebpackConfig;
