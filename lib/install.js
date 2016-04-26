'use strict';

function runCmd(cmd, _args, fn) {
  const args = _args || [];
  const runner = require('child_process').spawn(cmd, args, {
    // keep color
    stdio: 'inherit',
  });
  runner.on('close', (code) => {
    if (fn) {
      fn(code);
    }
  });
}

module.exports = function () {
  runCmd('which', ['tnpm'], (code) => {
    let npm = 'npm';
    if (!code) {
      npm = 'tnpm';
    }
    console.log(`${npm} installing`);
    runCmd(npm, ['install'], () => {
      console.log(`${npm} install end`);
    });
  });
};
