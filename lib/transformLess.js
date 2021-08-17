const less = require('less');
const path = require('path');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');
const NpmImportPlugin = require('less-plugin-npm-import');


function transformLess(lessContent, lessFilePath, config = {}) {
  const { cwd = process.cwd() } = config;
  const resolvedLessFile = path.resolve(cwd, lessFilePath);

  // Do less compile
  const lessOpts = {
    paths: [path.dirname(resolvedLessFile)],
    filename: resolvedLessFile,
    plugins: [new NpmImportPlugin({ prefix: '~' })],
    javascriptEnabled: true,
  };
  return less
    .render(lessContent, lessOpts)
    .then(result => postcss([autoprefixer]).process(result.css, { from: undefined }))
    .then(r => r.css);
}

module.exports = transformLess;
