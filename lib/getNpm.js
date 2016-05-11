'use strict';

const runCmd = require('./runCmd');

module.exports = function (done) {
  runCmd('which', ['tnpm'], (code) => {
    let npm = 'npm';
    if (!code) {
      npm = 'tnpm';
    }
    done(npm);
  });
};
