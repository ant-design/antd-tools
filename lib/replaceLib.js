'use strict';

const { join, dirname } = require('path');
const fs = require('fs');

const cwd = process.cwd();

function replacePath(path) {
  if (path.node.source && /\/lib\//.test(path.node.source.value)) {
    const esModule = path.node.source.value.replace('/lib/', '/es/');
    const esPath = dirname(join(cwd, `node_modules/${esModule}`));
    if (fs.existsSync(esPath)) {
      console.log(`[es build] replace ${path.node.source.value} with ${esModule}`);
      path.node.source.value = esModule;
    }
  }
}

function replaceLib() {
  return {
    visitor: {
      ImportDeclaration: replacePath,
      ExportNamedDeclaration: replacePath,
    },
  };
}

module.exports = replaceLib;
