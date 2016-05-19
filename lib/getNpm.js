'use strict';

const runCmdWithOut = require('./runCmdWithOut');

module.exports = function (done) {
  if (process.env.NPM_CLI) {
    done(process.env.NPM_CLI);
    return;
  }
  runCmdWithOut('which', ['tnpm'], (code) => {
    let npm = 'npm';
    if (!code) {
      npm = 'tnpm';
    }
    done(npm);
  });
};
