#!/usr/bin/env node

'use strict';

require('colorful').colorful();

const program = require('commander');

program.on('--help', () => {
  console.log('  Usage:'.to.bold.blue.color);
  console.log();
});

program.parse(process.argv);

const task = program.args[0];

if (!task) {
  program.help();
} else {
  console.log('antd-tools run', task);
  const gulp = require('gulp');
  require('../gulpfile');
  gulp.start(task);
}
