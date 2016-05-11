'use strict';

const runCmd = require('./runCmd');

module.exports = function (done) {
  runCmd('which', ['tnpm'], (code) => {
    let npm = 'npm';
    if (!code) {
      npm = 'tnpm';
    }
    console.log(`${npm} installing`);
    runCmd(npm, ['install'], (c) => {
      console.log(`${npm} install end`);
      done(c);
    });
  });
};
