'use strict';
const path = require('path')
const getRunCmdEnv = require('./utils/getRunCmdEnv');

function runCmd(cmd, _args, fn) {
  const args = _args || [];
  var atool_build = path.resolve(__dirname.split("antd-tools")[0], cmd, 'bin/atool-build')
  const runner = require('child_process').spawn(process.execPath, [atool_build].concat(args), {
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
