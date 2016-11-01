'use strict';

const fs = require('fs');
const path = require('path');
const assign = require('object-assign');

module.exports = function () {
  let my = {};
  if (fs.existsSync(path.join(process.cwd(), 'tsconfig.json'))) {
    my = require(path.join(process.cwd(), 'tsconfig.json'));
  }
  return assign({
    noUnusedParameters: true,
    noUnusedLocals: true,
    strictNullChecks: true,
    target: 'es6',
    jsx: 'preserve',
    moduleResolution: 'node',
    declaration: true,
    allowSyntheticDefaultImports: true,
  }, my.compilerOptions);
};
