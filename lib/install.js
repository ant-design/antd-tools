'use strict';

const runCmd = require('./runCmd');
const getNpm = require('./getNpm');

module.exports = function (done) {
  getNpm((npm) => {
    console.log(`${npm} installing`);
    runCmd(npm, ['install'], (c) => {
      console.log(`${npm} install end`);
      done(c);
    });
  });
};
