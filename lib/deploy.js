'use strict';

const ghPages = require('gh-pages');
const path = require('path');

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
  ghPages.publish(path.join(process.cwd(), '_site'), options, (err) => {
    if (err) {
      throw err;
    }
    console.log('Site has been published');
  });
};
