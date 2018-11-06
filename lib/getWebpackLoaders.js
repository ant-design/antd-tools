const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CleanLessPlugin = require('less-plugin-clean-css');
const postcssConfig = require('./postcssConfig');
const replaceLib = require('./replaceLib');

const isDev = nodeEnv => nodeEnv === 'develop';

function loadBabelConfig() {
  const getBabelConfig = require('./getBabelCommonConfig');
  let conf;

  return ({ pkg, modules = false }) => {
    if (conf) return conf;

    let pluginImportOptions = {
      style: true,
      libraryName: pkg.name,
      libraryDirectory: 'components',
    };

    if (pkg.name !== 'antd') {
      pluginImportOptions = {
        style: 'css',
        libraryDirectory: 'es',
        libraryName: 'antd',
      };
    }

    const babelConfig = getBabelConfig(modules);

    babelConfig.plugins.push([
      require.resolve('babel-plugin-import'),
      pluginImportOptions,
    ]);

    if (modules === false) {
      babelConfig.plugins.push(replaceLib);
    }

    conf = babelConfig;
    return conf;
  };
}

const getModule = ({ exclude = /node_modules/, ...reset }) => ({
  module: {
    rules: [Object.assign({}, exclude, reset)],
  },
});

const loadCSS = nodeEnv => (options = {}) => getModule({
  test: /.css$/,
  use: [
    isDev(nodeEnv) ? 'style-loader' : MiniCssExtractPlugin.loader,
    'css-loader',
    {
      loader: 'postcss-loader',
      options: Object.assign({}, postcssConfig, {
        sourceMap: true,
      }),
    },
  ],
  ...options,
});

const loadLess = nodeEnv => (options = {}) => getModule({
  test: /.less$/,
  use: [
    isDev(nodeEnv) ? 'style-loader' : MiniCssExtractPlugin.loader,
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
        plugins: [
          new CleanLessPlugin({
            advanced: true,
          }),
        ],
      },
    },
  ],
  ...options,
});

const getBabelConf = loadBabelConfig();

const loadJs = ({ pkg, modules, ...reset }) => getModule({
  test: /\.js$/,
  loader: 'babel-loader',
  options: getBabelConf({ pkg, modules }),
  ...reset,
});

const loadTs = ({ pkg, modules, ...reset }) => getModule({
  test: /\.tsx?$/,
  use: [
    {
      loader: 'babel-loader',
      options: getBabelConf({ pkg, modules }),
    },
    {
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
      },
    },
  ],
  ...reset,
});

module.exports = (nodeEnv = process.env.NODE_ENV) => ({
  loadCSS: loadCSS(nodeEnv),
  loadLess: loadLess(nodeEnv),
  loadJs,
  loadTs,
});
