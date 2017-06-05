'use strict';

const install = require('./install');
const runCmd = require('./runCmd');
const getBabelCommonConfig = require('./getBabelCommonConfig');
const merge2 = require('merge2');
const execSync = require('child_process').execSync;
const through2 = require('through2');
const transformLess = require('atool-build/lib/transformLess');
const babel = require('gulp-babel');
const argv = require('minimist')(process.argv.slice(2));

const packageJson = require(`${process.cwd()}/package.json`);
const getNpm = require('./getNpm');
const selfPackage = require('../package.json');
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');
const path = require('path');
const watch = require('gulp-watch');
const ts = require('gulp-typescript');
const tsConfig = require('./getTSCommonConfig')();
const gulp = require('gulp');
const fs = require('fs');
const rimraf = require('rimraf');
const replaceLib = require('./replaceLib');

const tsDefaultReporter = ts.reporter.defaultReporter();
const cwd = process.cwd();
const libDir = path.join(cwd, 'lib');
const esDir = path.join(cwd, 'es');

function dist(done) {
  rimraf.sync(path.join(cwd, 'dist'));
  process.env.RUN_ENV = 'PRODUCTION';
  runCmd('node',
    [require.resolve('atool-build/bin/atool-build'), '--devtool=#sourcemap'],
    (code) => {
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

gulp.task('check-git', (done) => {
  runCmd('git', ['status', '--porcelain'], (code, result) => {
    if (/^\?\?/m.test(result)) {
      return done(`There are untracked files in the working tree.\n${result}
      `);
    }
    if (/^([ADRM]| [ADRM])/m.test(result)) {
      return done(`There are uncommitted changes in the working tree.\n${result}
      `);
    }
    return done();
  });
});

gulp.task('clean', () => {
  rimraf.sync(path.join(cwd, '_site'));
  rimraf.sync(path.join(cwd, '_data'));
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

gulp.task('ts-lint-fix', (done) => {
  const tslintBin = require.resolve('tslint/bin/tslint');
  const tslintConfig = path.join(__dirname, './tslint.json');
  const args = [tslintBin, '-c', tslintConfig, 'components/**/*.tsx', '--fix'];
  runCmd('node', args, done);
});

const tsFiles = [
  '**/*.ts',
  '**/*.tsx',
  '!node_modules/**/*.*',
  'typings/**/*.d.ts',
];

function compileTs(stream) {
  return stream
    .pipe(ts(tsConfig)).js
    .pipe(through2.obj(function (file, encoding, next) {
      // console.log(file.path, file.base);
      file.path = file.path.replace(/\.[jt]sx$/, '.js');
      this.push(file);
      next();
    }))
    .pipe(gulp.dest(process.cwd()));
}

gulp.task('watch-tsc', ['tsc'], () => {
  watch(tsFiles, (f) => {
    if (f.event === 'unlink') {
      const fileToDelete = f.path.replace(/\.tsx?$/, '.js');
      if (fs.existsSync(fileToDelete)) {
        fs.unlinkSync(fileToDelete);
      }
      return;
    }
    const myPath = path.relative(cwd, f.path);
    compileTs(gulp.src([
      myPath,
      'typings/**/*.d.ts',
    ], {
      base: cwd,
    }));
  });
});

gulp.task('tsc', () => {
  return compileTs(gulp.src(tsFiles, {
    base: cwd,
  }));
});

function babelify(js, modules) {
  const babelConfig = getBabelCommonConfig(modules);
  delete babelConfig.cacheDirectory;
  if (modules === false) {
    babelConfig.plugins.push(replaceLib);
  }
  return js.pipe(babel(babelConfig))
    .pipe(through2.obj(function z(file, encoding, next) {
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
    .pipe(gulp.dest(modules === false ? esDir : libDir));
}

function compile(modules) {
  rimraf.sync(modules !== false ? libDir : esDir);
  const less = gulp.src(['components/**/*.less'])
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
    .pipe(gulp.dest(modules === false ? esDir : libDir));
  const assets = gulp.src(['components/**/*.@(png|svg)']).pipe(gulp.dest(modules === false ? esDir : libDir));
  let error = 0;
  const source = [
    'components/**/*.tsx',
    'typings/**/*.d.ts',
  ];
  // allow jsx file in components/xxx/
  if (tsConfig.allowJs) {
    source.unshift('components/**/*.jsx');
  }
  const tsResult = gulp.src(source).pipe(ts(tsConfig, {
    error(e) {
      tsDefaultReporter.error(e);
      error = 1;
    },
    finish: tsDefaultReporter.finish,
  }));

  function check() {
    if (error && !argv['ignore-error']) {
      process.exit(1);
    }
  }

  tsResult.on('finish', check);
  tsResult.on('end', check);
  const tsFilesStream = babelify(tsResult.js, modules);
  const tsd = tsResult.dts.pipe(gulp.dest(modules === false ? esDir : libDir));
  return merge2([less, tsFilesStream, tsd, assets]);
}

function publish(tagString, done) {
  let args = ['publish', '--with-antd-tools'];
  if (tagString) {
    args = args.concat(['--tag', tagString]);
  }
  const publishNpm = process.env.PUBLISH_NPM_CLI || 'npm';
  runCmd(publishNpm, args, (code) => {
    tag();
    done(code);
  });
}

function pub(done) {
  dist((code) => {
    if (code) {
      done(code);
      return;
    }
    const notOk = !packageJson.version.match(/^\d+\.\d+\.\d+$/);
    let tagString;
    if (argv['npm-tag']) {
      tagString = argv['npm-tag'];
    }
    if (!tagString && notOk) {
      if (packageJson.version.indexOf('-alpha.') !== -1) {
        tagString = 'alpha';
      } else {
        tagString = 'beta';
      }
    }
    if (packageJson.scripts['pre-publish']) {
      runCmd('npm', ['run', 'pre-publish'], (code2) => {
        if (code2) {
          done(code2);
          return;
        }
        publish(tagString, done);
      });
    } else {
      publish(tagString, done);
    }
  });
}

gulp.task('compile', ['compile-with-es'], () => {
  compile();
});
gulp.task('compile-with-es', () => {
  compile(false);
});

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
  }
  done();
});
