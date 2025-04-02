#!/usr/bin/env node

import chalk from 'chalk';
import gulp from 'gulp';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));
const cloneArgs = { ...argv };
delete cloneArgs._;

console.log(
  chalk.yellow('[@ant-design/tools]'),
  chalk.green('Execute:'),
  argv._[1],
  '-',
  JSON.stringify(cloneArgs)
);

import '../gulpfile';

// Start gulp task
function runTask(toRun: string): void {
  const metadata: { task: string; hrDuration?: [number, number] } = { task: toRun };
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
