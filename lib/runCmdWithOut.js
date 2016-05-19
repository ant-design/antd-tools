'use strict';

function runCmdWithOut(cmd, _args, fn) {
  const args = _args || [];
  const runner = require('child_process').spawn(cmd, args);

  const out = [];

  runner.stdout.on('data', (data) => {
    out.push(data);
  });

  runner.on('close', (code) => {
    if (fn) {
      fn(code, out.join(''));
    }
  });
}

module.exports = runCmdWithOut;
