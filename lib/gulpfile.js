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
const dora = require.resolve('dora/bin/dora');
const atoolBuild = require.resolve('atool-build/bin/atool-build');

function dist(done) {
  execSync('rm -rf dist');
  process.env.RUN_ENV = 'PRODUCTION';
  runCmd('atool-build', [], (code) => {
    done(code);
  });
}

function copyHtml() {
  execSync('cp ./*.html _site');
}

const gulp = require('gulp');

gulp.task('clean', () => {
  execSync('rm -rf _site _data');
});

gulp.task('dist', (done) => {
  dist(done);
});

gulp.task('start', ['clean'], (done) => {
  buildWebsite();
  process.env.RUN_ENV = 'WEBSITE';
  runCmd(dora, ['-p', process.env.npm_package_config_port || '8001',
      '--plugins', `${require.resolve('dora-plugin-webpack')}?disableNpmInstall`],
    (code) => {
      done(code);
    });
});

gulp.task('site', ['clean'], (done) => {
  buildWebsite();
  process.env.RUN_ENV = 'WEBSITE';
  process.env.NODE_ENV = 'dev';
  runCmd(atoolBuild, ['--no-compress', '--devtool=#sourcemap', '-o', './_site'], (code) => {
    copyHtml();
    done(code);
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
        file.contents = new Buffer(file.contents.toString(encoding)
          .replace(/\/style\/'/, '/style/css.js\'')
          .replace(/\.less/, '.css'));
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
  dist(() => {
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
