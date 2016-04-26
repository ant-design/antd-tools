'use strict';

const runCmd = require('./runCmd');

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
