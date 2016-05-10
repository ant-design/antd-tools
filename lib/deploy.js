'use strict';

const ghPages = require('gh-pages');
const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;

module.exports = function () {
  const options = {
    depth: 1,
    logger(message) {
      console.log(message);
    },
  };
  if (process.env.RUN_ENV_USER) {
    options.user = {
      name: process.env.RUN_ENV_USER,
      email: process.env.RUN_ENV_EMAIL,
    };
  }
  if (fs.existsSync(path.join(process.cwd(), 'CNAME'))) {
    execSync('cp CNAME _site');
  }
  ghPages.publish(path.join(process.cwd(), '_site'), options, (err) => {
    if (err) {
      throw err;
    }
    console.log('Site has been published');
  });
};
