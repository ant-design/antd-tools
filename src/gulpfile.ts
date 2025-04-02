import { getProjectPath, getConfig } from './utils/projectHelper';
import merge2 from 'merge2';
import through2 from 'through2';
import webpack from 'webpack';
import babel from 'gulp-babel';
import minimist from 'minimist';
import path from 'path';
import watch from 'gulp-watch';
import ts from 'gulp-typescript';
import gulp from 'gulp';
import glob from 'glob';
import fs from 'fs-extra';
import rimraf from 'rimraf';
import getBabelCommonConfig from './getBabelCommonConfig';
import getTSCommonConfig from './getTSCommonConfig';
import replaceLib from './replaceLib';
import checkDiff from './lint/checkDiff';
import apiCollection from './apiCollection';
import sortApiTable from './sortApiTable';

const argv = minimist(process.argv.slice(2));

const tsConfig = getTSCommonConfig();

const packageJson = fs.readJsonSync(getProjectPath('package.json'));

const tsDefaultReporter = ts.reporter.defaultReporter();
const cwd = process.cwd();
const libDir = getProjectPath('lib');
const esDir = getProjectPath('es');
const localeDir = getProjectPath('locale');

// FIXME: hard code, not find typescript can modify the path resolution
const localeDts = `import type { Locale } from '../lib/locale';
declare const localeValues: Locale;
export default localeValues;`;

async function dist(done) {
  rimraf.sync(getProjectPath('dist'));
  process.env.RUN_ENV = 'PRODUCTION';
  const configModule = await import(getProjectPath('webpack.config.js'));
  const webpackConfig = configModule.default || configModule;

  webpack(webpackConfig, async (err, stats) => {
    if (err) {
      console.error(err.stack || err);
      return;
    }

    const info = stats.toJson();
    const { dist: { finalize } = {}, bail } = await getConfig();

    if (stats.hasErrors()) {
      (info.errors || []).forEach(error => {
        console.error(error);
      });
      // https://github.com/ant-design/ant-design/pull/31662
      if (bail) {
        process.exit(1);
      }
    }

    if (stats.hasWarnings()) {
      console.warn(info.warnings);
    }

    const buildInfo = stats.toString({
      colors: true,
      children: true,
      chunks: false,
      modules: false,
      chunkModules: false,
      hash: false,
      version: false,
    });
    console.log(buildInfo);

    // Additional process of dist finalize
    if (finalize) {
      console.log('[Dist] Finalization...');
      finalize();
    }

    done(0);
  });
}

gulp.task('clean', () => {
  rimraf.sync(getProjectPath('_site'));
  rimraf.sync(getProjectPath('_data'));
});

gulp.task(
  'dist',
  gulp.series(done => {
    dist(done);
  })
);

const tsFiles = ['**/*.ts', '**/*.tsx', '!node_modules/**/*.*', 'typings/**/*.d.ts'];

function compileTs(stream) {
  return stream
    .pipe(ts(tsConfig))
    .js.pipe(
      through2.obj(function (file, encoding, next) {
        // console.log(file.path, file.base);
        file.path = file.path.replace(/\.[jt]sx$/, '.js');
        this.push(file);
        next();
      })
    )
    .pipe(gulp.dest(process.cwd()));
}

gulp.task('tsc', () =>
  compileTs(
    gulp.src(tsFiles, {
      base: cwd,
    })
  )
);

gulp.task(
  'watch-tsc',
  gulp.series('tsc', () => {
    watch(tsFiles, f => {
      if (f.event === 'unlink') {
        const fileToDelete = f.path.replace(/\.tsx?$/, '.js');
        if (fs.existsSync(fileToDelete)) {
          fs.unlinkSync(fileToDelete);
        }
        return;
      }
      const myPath = path.relative(cwd, f.path);
      compileTs(
        gulp.src([myPath, 'typings/**/*.d.ts'], {
          base: cwd,
        })
      );
    });
  })
);

function babelify(js, modules) {
  const babelConfig = getBabelCommonConfig(modules);
  delete babelConfig.cacheDirectory;
  if (modules === false) {
    babelConfig.plugins.push(replaceLib);
  }
  const stream = js.pipe(babel(babelConfig));
  return stream.pipe(gulp.dest(modules === false ? esDir : libDir));
}

function insertUseClient() {
  const header = '"use client"\n';
  return through2.obj(function (file, _, next) {
    const { path: filepath } = file;
    if (
      // eslint-disable-next-line no-constant-condition
      /\.(j|t)sx$/.test(filepath) ||
      // components/index.ts
      // components/xxx/index.ts
      /components(\/[\w-]+)?\/index\.ts$/.test(filepath)
    ) {
      file.contents = Buffer.concat([Buffer.from(header), file.contents]);
    }
    this.push(file);
    next();
  });
}

async function compile(modules?: boolean) {
  const { compile: { transformTSFile, transformFile } = {} } = await getConfig();
  rimraf.sync(modules !== false ? libDir : esDir);

  const assets = gulp
    .src(['components/**/*.@(png|svg)'])
    .pipe(gulp.dest(modules === false ? esDir : libDir));
  let error = 0;

  // =============================== FILE ===============================
  let transformFileStream;

  if (transformFile) {
    transformFileStream = gulp
      .src(['components/**/*.tsx'])
      .pipe(
        through2.obj(function (file, encoding, next) {
          let nextFile = transformFile(file) || file;
          nextFile = Array.isArray(nextFile) ? nextFile : [nextFile];
          nextFile.forEach(f => this.push(f));
          next();
        })
      )
      .pipe(gulp.dest(modules === false ? esDir : libDir));
  }

  // ================================ TS ================================
  const source = [
    'components/**/*.tsx',
    'components/**/*.ts',
    'typings/**/*.d.ts',
    '!components/**/__tests__/**',
    '!components/**/demo/**',
    '!components/**/design/**',
  ];

  // allow jsx file in components/xxx/
  if (tsConfig.allowJs) {
    source.unshift('components/**/*.jsx');
  }

  // Strip content if needed
  let sourceStream = gulp.src(source);

  if (transformTSFile) {
    sourceStream = sourceStream.pipe(
      through2.obj(function (file, encoding, next) {
        let nextFile = transformTSFile(file) || file;
        nextFile = Array.isArray(nextFile) ? nextFile : [nextFile];
        nextFile.forEach(f => this.push(f));
        next();
      })
    );
  }

  sourceStream = sourceStream.pipe(insertUseClient());

  const tsResult = sourceStream.pipe(
    ts(tsConfig, {
      error(e) {
        tsDefaultReporter.error(e, undefined);
        error = 1;
      },
      finish: tsDefaultReporter.finish,
    })
  );

  function check() {
    if (error && !argv['ignore-error']) {
      process.exit(1);
    }
  }

  tsResult.on('finish', check);
  tsResult.on('end', check);
  const tsFilesStream = babelify(tsResult.js, modules);
  const tsd = tsResult.dts.pipe(gulp.dest(modules === false ? esDir : libDir));
  return merge2([tsFilesStream, tsd, assets, transformFileStream].filter(s => s));
}

function generateLocale() {
  rimraf.sync(localeDir);
  fs.mkdirSync(localeDir);

  const localeFiles = glob.sync('components/locale/*.ts?(x)');
  localeFiles.forEach(item => {
    const match = item.match(/components\/locale\/(.*)\.tsx?/);
    if (match) {
      const locale = match[1];
      fs.writeFileSync(
        path.join(localeDir, `${locale}.js`),
        `module.exports = require('../lib/locale/${locale}');`
      );
      fs.writeFileSync(path.join(localeDir, `${locale}.d.ts`), localeDts);
    }
  });
}

// We use https://unpkg.com/[name]/?meta to check exist files
gulp.task(
  'package-diff',
  gulp.series(done => {
    checkDiff(packageJson.name, packageJson.version, done);
  })
);

gulp.task('compile-with-es', async done => {
  console.log('[Parallel] Compile to es...');
  (await compile(false)).on('finish', done);
});

gulp.task('compile-with-lib', async done => {
  console.log('[Parallel] Compile to js...');
  (await compile()).on('finish', () => {
    generateLocale();
    done();
  });
});

gulp.task('compile-finalize', async done => {
  // Additional process of compile finalize
  const { compile: { finalize } = {} } = await getConfig();
  if (finalize) {
    console.log('[Compile] Finalization...');
    finalize();
  }
  done();
});

gulp.task(
  'compile',
  gulp.series(gulp.parallel('compile-with-es', 'compile-with-lib'), 'compile-finalize')
);

gulp.task(
  'sort-api-table',
  gulp.series(done => {
    sortApiTable();
    done();
  })
);

gulp.task(
  'api-collection',
  gulp.series(done => {
    apiCollection();
    done();
  })
);
