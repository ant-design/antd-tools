'use strict';

const buildWebsite = require('./website/build-website');
const deploy = require('./deploy');
const install = require('./install');
const execSync = require('child_process').execSync;
const babelConfig = require('atool-build/lib/getBabelCommonConfig')();
const mergeStream = require('merge-stream');

delete babelConfig.cacheDirectory;

const gulpEs3ify = require('./gulpEs3ify');
const babel = require('gulp-babel');

function copyHtml() {
  execSync('cp ./*.html _site');
}

const gulp = require('gulp');

gulp.task('clean', () => {
  execSync('rm -rf _site _data');
});

gulp.task('start', ['clean'], () => {
  buildWebsite();
  execSync('RUN_ENV=WEBSITE dora -p 8001 --plugins webpack?disableNpmInstall');
});

gulp.task('site', ['clean'], () => {
  buildWebsite();
  execSync('RUN_ENV=WEBSITE ' +
    'NODE_ENV=dev atool-build --no-compress --devtool=#sourcemap -o ./_site');
  copyHtml();
});

gulp.task('just-deploy', ['site'], () => {
  deploy();
});


gulp.task('deploy', () => {
  execSync('rm -rf node_modules');
  install();
  deploy();
});

gulp.task('compile', () => {
  execSync('rm -rf lib');
  const less = gulp.src(['components/' + '**/' + '*.less']).pipe(gulp.dest('lib'));
  const js = gulp.src(['components/' + '**/' + '*.js', 'components/' + '**/' + '*.jsx'])
    .pipe(babel(babelConfig))
    .pipe(gulpEs3ify())
    .pipe(gulp.dest('lib'));
  return mergeStream(less, js);
});

function pub(beta) {
  execSync('rm -rf lib dist');
  this.compile();
  execSync('RNU_ENV=production atool-build');
  execSync('npm run prenpm');
  execSync(`npm publish ${beta ? '--tag beta' : ''}`);
  execSync('rm -rf lib dist');
}

gulp.task('pub', () => {
  pub();
});

gulp.task('beta', () => {
  pub(true);
});
