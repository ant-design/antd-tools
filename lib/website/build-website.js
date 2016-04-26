#! /usr/bin/env node

'use strict';

module.exports = function () {
// Ensure that data directory exist.
  require('mkdirp').sync('./_data');
  const fs = require('fs');
  const buildDemosList = require('./build-demos-list');
  buildDemosList(['./components', './docs'], './_data/demos-list.js');

  const buildCommon = require('./build-common');
  buildCommon([
    './components',
    './docs',
    './CHANGELOG.md',
  ], './_data/react-components.js');

  const extra = ['practice', 'pattern', 'spec', 'resource'];

  extra.forEach((r) => {
    if (fs.existsSync(`./docs/${r}`)) {
      buildCommon(`./docs/${r}`, `./_data/${r}.js`);
    }
  });
};
