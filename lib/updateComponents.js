#!/usr/bin/env node
/* eslint strict:0, camelcase:0 */
'use strict';

module.exports = function (filter) {
  const child_process = require('child_process');
  const execSync = child_process.execSync;
  const runCmd = require('./runCmd');
  execSync('rm -rf node_modules/rc-*');
  const packageJson = require(`${process.cwd()}/package.json`);
  const deps = packageJson.dependencies;
  const savePrefix = execSync('tnpm config get save-prefix').toString().trim();
  execSync('tnpm config set save-prefix \'~\'');
  const cmd = [];
  for (const name in deps) {
    if (filter(name)) {
      cmd.push(`${name}@latest`);
    }
  }
  runCmd('tnpm', ['i'].concat(cmd).concat('--save'), () => {
    execSync(`tnpm config set save-prefix '${savePrefix}'`);
  });
};
