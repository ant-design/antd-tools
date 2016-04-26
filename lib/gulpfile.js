'use strict';

const buildWebsite = require('./website/build-website');
const deploy = require('./deploy');
const install = require('./install');
const runCmd = require('./runCmd');
const babelConfig = require('atool-build/lib/getBabelCommonConfig')();
const mergeStream = require('merge-stream');
const execSync = require('child_process').execSync;
const fs = require('fs');
const through2 = require('through2');
const transformLess = require('atool-build/lib/transformLess');

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

gulp.task('start', ['clean'], (done) => {
  buildWebsite();
  process.env.RUN_ENV = 'WEBSITE';
  runCmd('dora', ['-p', '8001', '--plugins', 'webpack?disableNpmInstall'], () => {
    done();
  });
});

gulp.task('site', ['clean'], (done) => {
  buildWebsite();
  process.env.RUN_ENV = 'WEBSITE';
  process.env.NODE_ENV = 'dev';
  runCmd('atool-build', ['--no-compress', '--devtool=#sourcemap', '-o', './_site'], () => {
    copyHtml();
    done();
  });
});

gulp.task('just-deploy', ['site'], () => {
  deploy();
});

gulp.task('deploy', (done) => {
  execSync('rm -rf node_modules');
  install();
  gulp.start('just-deploy', () => {
    done();
  });
});

gulp.task('compile', () => {
  execSync('rm -rf lib');
  const less = gulp.src(['components/' + '**/' + '*.less'])
    .pipe(through2.obj(function (file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/\/style\/index\.less$/)) {
        transformLess(file.path).then((css) => {
          file.contents = new Buffer(css);
          file.path = file.path.replace(/\.less$/, '.css');
          this.push(file);
          next();
        });
      } else {
        next();
      }
    }))
    .pipe(gulp.dest('lib'));
  const js = gulp.src(['components/' + '**/' + '*.js', 'components/' + '**/' + '*.jsx'])
    .pipe(babel(babelConfig))
    .pipe(gulpEs3ify())
    .pipe(through2.obj(function (file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/\/style\/index\.js$/)) {
        file.contents = new Buffer(file.contents.toString(encoding).replace(/\.less/, '.css'));
        file.path = file.path.replace(/index\.js$/, 'css.js');
        this.push(file);
        next();
      } else {
        next();
      }
    }))
    .pipe(gulp.dest('lib'));
  return mergeStream(less, js);
});

function pub(beta, done) {
  execSync('rm -rf dist');
  process.env.RUN_ENV = 'PRODUCTION';
  runCmd('atool-build', [], () => {
    if (fs.existsSync('./scripts/prenpm.js')) {
      require('./scripts/prenpm')();
    }
    execSync(`npm publish ${beta ? '--tag beta' : ''}`);
    execSync('rm -rf lib dist');
    done();
  });
}

gulp.task('pub', ['compile'], (done) => {
  pub(false, done);
});

gulp.task('beta', ['compile'], (done) => {
  pub(true, done);
});
