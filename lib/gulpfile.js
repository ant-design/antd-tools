'use strict';

const install = require('./install');
const runCmd = require('./runCmd');
const runCmdWithOut = require('./runCmdWithOut');
const babelConfig = require('./getBabelCommonConfig')();
const merge2 = require('merge2');
const execSync = require('child_process').execSync;
const through2 = require('through2');
const transformLess = require('atool-build/lib/transformLess');
delete babelConfig.cacheDirectory;
const gulpEs3ify = require('./gulpEs3ify');
const babel = require('gulp-babel');
const packageJson = require(`${process.cwd()}/package.json`);
const getNpm = require('./getNpm');
const selfPackage = require('../package.json');
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');
const path = require('path');

function dist(done) {
  execSync('rm -rf dist');
  process.env.RUN_ENV = 'PRODUCTION';
  runCmd('atool-build', ['--devtool=#sourcemap'], (code) => {
    done(code);
  });
}

function tag() {
  console.log('tagging');
  const version = packageJson.version;
  execSync(`git tag ${version}`);
  execSync(`git push origin ${version}:${version}`);
  console.log('tagged');
}

const gulp = require('gulp');

gulp.task('check-git', (done) => {
  runCmdWithOut('git', ['status', '--porcelain'], (code, result) => {
    if (/^\?\?/m.test(result)) {
      return done(`There are untracked files in the working tree.\n${result}
      `);
    }
    if (/^([ADRM]| [ADRM])/m.test(result)) {
      return done(`There are uncommitted changes in the working tree.\n${result}
      `);
    }
    done();
  });
});

gulp.task('clean', () => {
  execSync('rm -rf _site _data');
});

gulp.task('dist', (done) => {
  dist(done);
});

gulp.task('ts-lint', (done) => {
  const tslintBin = require.resolve('tslint/bin/tslint');
  const tslintConfig = path.join(__dirname, './tslint.json');
  const args = [tslintBin, '-c', tslintConfig, 'components/**/*.tsx'];
  runCmd('node', args, done);
});

gulp.task('watch-tsc', (done) => {
  const tsBin = require.resolve('typescript/bin/tsc');
  const args = [tsBin, '--watch'];
  runCmd('node', args, done);
});

gulp.task('tsc', (done) => {
  const tsBin = require.resolve('typescript/bin/tsc');
  const args = [tsBin];
  runCmd('node', args, done);
});

const ts = require('gulp-typescript');
const tsConfig = require('./getTSCommonConfig')();

function babelify(js) {
  return js.pipe(babel(babelConfig))
    .pipe(gulpEs3ify())
    .pipe(through2.obj(function (file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/\/style\/index(\.web)?\.js/)) {
        const content = file.contents.toString(encoding);
        if (file.path.indexOf('.web.js') === -1 &&
          (content.indexOf('.less\'') === -1 || content.indexOf('\'react-native\'') !== -1)) {
          next();
          return;
        }
        file.contents = new Buffer(content
          .replace(/\/style\/?'/g, '/style/css\'')
          .replace(/\.less/g, '.css'));
        file.path = file.path.replace(/index(\.web)?\.js/, 'css$1.js');
        this.push(file);
        next();
      } else {
        next();
      }
    }))
    .pipe(gulp.dest('lib'));
}

gulp.task('compile', () => {
  execSync('rm -rf lib');
  const less = gulp.src(['components/' + '**/' + '*.less'])
    .pipe(through2.obj(function (file, encoding, next) {
      this.push(file.clone());
      if (file.path.match(/\/style\/index(\.web)?\.less$/)) {
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
  const img = gulp.src(['components/' + '**/' + '*.png']).pipe(gulp.dest('lib'));
  const tsResult = gulp.src([
    '!components/' + '**/demo/' + '*.tsx',
    'components/' + '**/' + '*.tsx',
    'typings/**/*.d.ts',
  ]).pipe(ts(tsConfig));
  const tsFiles = babelify(tsResult.js);
  const tsd = tsResult.dts.pipe(gulp.dest('lib'));
  return merge2([less, tsFiles, tsd, img]);
});

function publish(tagString, done) {
  let args = ['publish', '--with-antd-tools'];
  if (tagString) {
    args = args.concat(['--tag', tagString]);
  }
  const publishNpm = process.env.PUBLISH_NPM_CLI || 'npm';
  runCmd(publishNpm, args, (code) => {
    if (!code) {
      execSync('rm -rf lib dist');
    }
    tag();
    done(code);
  });
}

function pub(done) {
  dist((code) => {
    if (code) {
      return done(code);
    }
    const notOk = !packageJson.version.match(/^\d+\.\d+\.\d+$/);
    let tagString;
    if (notOk) {
      if (packageJson.version.indexOf('-alpha.') !== -1) {
        tagString = 'alpha';
      } else {
        tagString = 'beta';
      }
    }
    if (packageJson.scripts['pre-publish']) {
      runCmd('npm', ['run', 'pre-publish'], (code2) => {
        if (code2) {
          return done(code2);
        }
        publish(tagString, done);
      });
    } else {
      publish(tagString, done);
    }
  });
}


gulp.task('install', (done) => {
  install(done);
});

gulp.task('pub', ['check-git', 'compile'], (done) => {
  pub(done);
});

gulp.task('update-self', (done) => {
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
        return;
      }
    }
  } else {
    done(1);
    return;
  }
  done();
});
