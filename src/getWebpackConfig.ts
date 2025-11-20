import { getProjectPath, resolve } from './utils/projectHelper';
import * as path from 'path';
import * as webpack from 'webpack';
import WebpackBar from 'webpackbar';
import webpackMerge from 'webpack-merge';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import CleanUpStatsPlugin from './utils/CleanUpStatsPlugin';
import { Configuration } from 'webpack';
import { readJsonSync } from 'fs-extra';
import getBabelCommonConfig from './getBabelCommonConfig';

interface PackageJson {
  name: string;
  version: string;
}

const svgRegex = /\.svg(\?v=\d+\.\d+\.\d+)?$/;
const svgOptions = {
  limit: 10000,
  minetype: 'image/svg+xml',
};

const imageOptions = {
  limit: 10000,
};

interface GetWebpackConfigFunction {
  (modules?: boolean, options?: { enabledReactCompiler?: boolean }): Configuration[];
  webpack: typeof webpack;
  svgRegex: RegExp;
  svgOptions: typeof svgOptions;
  imageOptions: typeof imageOptions;
}

const getWebpackConfig: GetWebpackConfigFunction = (modules, options = {}) => {
  const { enabledReactCompiler } = options;

  const pkg: PackageJson = readJsonSync(getProjectPath('package.json'));

  const babelConfig = getBabelCommonConfig(modules || false, {
    enabledReactCompiler: enabledReactCompiler,
  });

  babelConfig.plugins.push([
    resolve('babel-plugin-import'),
    {
      style: true,
      libraryName: pkg.name,
      libraryDirectory: 'components',
    },
  ]);

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

  const config: Configuration = {
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
      ].reduce((acc, name) => ({ ...acc, [name]: false }), {}),
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
      minimizer: [
        new TerserPlugin<{
          warnings: boolean;
        }>({
          parallel: true,
          minify: TerserPlugin.uglifyJsMinify,
          terserOptions: {
            warnings: false,
          },
        }),
      ],
    };

    const uncompressedConfig = webpackMerge({}, config, {
      entry: {
        [pkg.name]: entry,
      },
      mode: 'development',
      plugins: [
        new webpack.optimize.ModuleConcatenationPlugin(),
        new MiniCssExtractPlugin({
          filename: '[name].css',
        }),
      ],
    });

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
};

getWebpackConfig.webpack = webpack;
getWebpackConfig.svgRegex = svgRegex;
getWebpackConfig.svgOptions = svgOptions;
getWebpackConfig.imageOptions = imageOptions;

export default getWebpackConfig;
