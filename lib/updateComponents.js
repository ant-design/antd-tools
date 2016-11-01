#!/usr/bin/env node
/* eslint strict:0, camelcase:0 */

'use strict';

const child_process = require('child_process');
const runCmd = require('./runCmd');

const execSync = child_process.execSync;

module.exports = function (filter) {
  execSync('rm -rf node_modules/rc-*');
  const packageJson = require(`${process.cwd()}/package.json`);
  const deps = packageJson.dependencies;
  const savePrefix = execSync('tnpm config get save-prefix').toString().trim();
  execSync('tnpm config set save-prefix \'~\'');
  const cmd = [];
  Object.keys(deps).forEach((name) => {
    if (filter(name)) {
      cmd.push(`${name}@latest`);
    }
  });
  runCmd('tnpm', ['i'].concat(cmd).concat('--save'), () => {
    execSync(`tnpm config set save-prefix '${savePrefix}'`);
  });
};
