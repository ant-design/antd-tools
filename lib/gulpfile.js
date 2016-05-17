'use strict';

const buildWebsite = require('./website/build-website');
const deploy = require('./deploy');
const install = require('./install');
const runCmd = require('./runCmd');
const babelConfig = require('atool-build/lib/getBabelCommonConfig')();
const mergeStream = require('merge-stream');
const execSync = require('child_process').execSync;
const through2 = require('through2');
const transformLess = require('atool-build/lib/transformLess');
delete babelConfig.cacheDirectory;
const gulpEs3ify = require('./gulpEs3ify');
const babel = require('gulp-babel');
const dora = require.resolve('dora/bin/dora');
const atoolBuild = require.resolve('atool-build/bin/atool-build');
const packageJson = require(`${process.cwd()}/package.json`);
const getNpm = require('./getNpm');
const selfPackage = require('../package.json');
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');

function dist(done) {
  execSync('rm -rf dist');
  process.env.RUN_ENV = 'PRODUCTION';
  runCmd('atool-build', ['--devtool=#sourcemap'], (code) => {
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
  const webpackPlugin = require.resolve('dora-plugin-webpack');
  const livereloadPlugin = require.resolve('dora-plugin-livereload');
  const hmrPlugin = require.resolve('dora-plugin-hmr');
  const uploadPlugin = require.resolve('dora-plugin-upload');
  runCmd(dora, ['-p', process.env.npm_package_config_port || '8001',
      '--plugins',
      `${webpackPlugin}?disableNpmInstall,
    ${hmrPlugin},
    ${livereloadPlugin}?enableJs=false,
    ${uploadPlugin}`.replace(/\s/g, '')],
    (code) => {
      done(code);
    });
});

gulp.task('site', ['clean'], (done) => {
  buildWebsite();
  process.env.RUN_ENV = 'WEBSITE';
  process.env.NODE_ENV = 'production';
  runCmd(atoolBuild, ['--devtool=#sourcemap', '-o', './_site'], (code) => {
    copyHtml();
    done(code);
  });
});

gulp.task('just-deploy', ['site'], () => {
  deploy();
});

gulp.task('deploy', (done) => {
  execSync('rm -rf node_modules');
  install((code) => {
    if (!code) {
      gulp.start('just-deploy', () => {
        done();
      });
    }
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
        }).catch((e) => {
          console.error(e);
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
          .replace(/\/style\/?'/g, '/style/css\'')
          .replace(/\.less/g, '.css'));
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

function publish(beta, done) {
  let args = ['publish', '--with-antd-tools'];
  if (beta) {
    args = args.concat(['--tag', 'beta']);
  }
  const publishNpm = process.env.PUBLISH_NPM_CLI || 'npm';
  runCmd(publishNpm, args, (code) => {
    if (!code) {
      execSync('rm -rf lib dist');
    }
    done(code);
  });
}

function pub(done) {
  dist((code) => {
    if (code) {
      return done(code);
    }
    const beta = !packageJson.version.match(/^\d+\.\d+\.\d+$/);
    publish(beta, done);
  });
}

gulp.task('pub', ['compile'], (done) => {
  pub(done);
});

gulp.task('update-self', ['compile'], (done) => {
  getNpm((npm) => {
    console.log(`${npm} updating ${selfPackage.name}`);
    runCmd(npm, ['update', selfPackage.name], (c) => {
      console.log(`${npm} update ${selfPackage.name} end`);
      done(c);
    });
  });
});

function reportError() {
  console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
  console.log(chalk.bgRed('!! `npm publish` is forbidden for this package. !!'));
  console.log(chalk.bgRed('!! Use `npm run pub` instead.        !!'));
  console.log(chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
}

gulp.task('guard', (done) => {
  const npmArgs = getNpmArgs();
  if (npmArgs) {
    for (let arg = npmArgs.shift(); arg; arg = npmArgs.shift()) {
      if (/^pu(b(l(i(sh?)?)?)?)?$/.test(arg) && npmArgs.indexOf('--with-antd-tools') < 0) {
        reportError();
        done(1);
      }
    }
  } else {
    done(1);
  }
});
