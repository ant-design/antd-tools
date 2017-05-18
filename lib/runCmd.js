'use strict';

const path = require('path');
const getRunCmdEnv = require('./utils/getRunCmdEnv');

function runCmd(cmd, _args, fn) {
  const args = _args || [];
  const atoolBuild = path.resolve(__dirname.split('antd-tools')[0], cmd, 'bin/atool-build');
  const runner = require('child_process').spawn(process.execPath, [atoolBuild].concat(args), {
    // keep color
    stdio: 'inherit',
    env: getRunCmdEnv(),
  });

  runner.on('close', (code) => {
    if (fn) {
      fn(code);
    }
  });
}

module.exports = runCmd;
