#!/usr/bin/env node

'use strict';

const chalk = require('chalk');
const gulp = require('gulp');

const argv = require('minimist')(process.argv.slice(2));

const cloneArgs = { ...argv };
delete cloneArgs._;

console.log(chalk.yellow('Execute:'), chalk.green(argv._[1]), '-', JSON.stringify(cloneArgs));
console.log('  - Args:', JSON.stringify(cloneArgs));

require('../gulpfile');

// Start glup task
function runTask(toRun) {
  const metadata = { task: toRun };
  // Gulp >= 4.0.0 (doesn't support events)
  const taskInstance = gulp.task(toRun);
  if (taskInstance === undefined) {
    gulp.emit('task_not_found', metadata);
    return;
  }
  const start = process.hrtime();
  gulp.emit('task_start', metadata);
  try {
    taskInstance.apply(gulp);
    metadata.hrDuration = process.hrtime(start);
    gulp.emit('task_stop', metadata);
    gulp.emit('stop');
  } catch (err) {
    err.hrDuration = process.hrtime(start);
    err.task = metadata.task;
    gulp.emit('task_err', err);
  }
}

runTask(argv._[1]);
