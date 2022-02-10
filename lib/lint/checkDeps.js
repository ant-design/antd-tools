/* eslint-disable no-multi-assign */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const glob = require('glob');
const argv = require('minimist')(process.argv.slice(2));
const babel = require('@babel/core');
const ProgressBar = require('progress');
const getBabelCommonConfig = require('../getBabelCommonConfig');
const { getProjectPath } = require('../utils/projectHelper');

const SKIP_REGEX = /deps-lint-skip:\s*([\w\d-_,\s]*)/;
const SKIP_ALL_REGEX = /deps-lint-skip-all/;

const preventFullyModule = ['@ant-design/icons', 'lodash'];

// ============================== Initial Config file ==============================
let configFile;
try {
  configFile = require(getProjectPath('.depslintrc.js'));
} catch (configErr) {
  // Do nothing if config file failed
}
configFile = configFile || {};

// ================================= Process Logic =================================
function debug(...args) {
  if (!argv.debug) return;
  console.log(...args);
}

function getComponentRootPath(filePath) {
  const match = filePath.match(/^(.*\/components\/[^/]*)/);
  return match && match[1];
}

const babelConfig = getBabelCommonConfig();
babelConfig.ast = true;

function getModuleByAstNode(node) {
  if (!node) return null;
  const args = node.arguments;
  if (!args || !args.length) return null;

  if (node.callee && node.callee.name === 'require') {
    return args[0].value;
  }

  return getModuleByAstNode(args[0]);
}

function getModuleEntity(filePath, module, globConfig) {
  const isRelative = /^..\//.test(module);

  let shouldLint = false;
  const absolutePath = path.resolve(path.dirname(filePath), module);

  if (module && isRelative) {
    const checkedPath = glob.sync(`${absolutePath}?(.*)`, globConfig);
    if (checkedPath.length) {
      shouldLint = true;
    }
  }

  let shouldRelativeImport = false;
  if (preventFullyModule.includes(module)) {
    shouldRelativeImport = true;
  }

  return {
    name: module,
    path: absolutePath,
    shouldLint,
    shouldRelativeImport,
    isRelative,
  };
}

function getModules(filePath, globConfig, debugAST) {
  const moduleList = [];
  const code = fs.readFileSync(filePath, 'utf8');
  const fileBabelConfig = { ...babelConfig, filename: filePath };
  const { ast } = babel.transformSync(code, fileBabelConfig);
  const astBody = ast.program.body;
  const astComments = ast.comments;

  let ignoreAll = false;

  // Support skip module check
  const ignoreList = (astComments || [])
    .reduce((list, { value }) => {
      // Match skip all
      if (value.match(SKIP_ALL_REGEX)) {
        ignoreAll = true;
      }

      // Match skip file
      const match = value.match(SKIP_REGEX);
      if (match) {
        return [...list, ...match[1].split(',').map(str => str.trim())];
      }
      return list;
    }, [])
    .filter(ignore => ignore);

  if (debugAST) {
    debug('AST:', JSON.stringify(ast, null, 2));
    debug('IgnoreList:', ignoreList);
  }

  // Since import is always on the top in antd,
  // we can check variable declaration directly!
  if (Array.isArray(astBody)) {
    astBody.forEach(node => {
      let module;

      // Only handle declaration & directly statement
      if (node.type === 'ExpressionStatement') {
        module = getModuleByAstNode(node.expression);
      } else if (node.type === 'VariableDeclaration') {
        // Get declaration
        const declaration = (node.declarations || [])[0];
        if (!declaration || !declaration.init || !declaration.init.arguments) return;

        const arg = declaration.init;
        module = getModuleByAstNode(arg) || '';
      }

      // Skip if is just declare variable
      if (!module) return;

      moduleList.push(getModuleEntity(filePath, module, globConfig));
    });
  }

  // If `modulePattern` provided, we will also consider it
  if (configFile.modulePattern) {
    configFile.modulePattern.forEach(({ pattern, module }) => {
      if (pattern.test(code)) {
        moduleList.push({
          ...getModuleEntity(filePath, module, globConfig),
          fromPattern: true,
        });
      }
    });
  }

  return { moduleList, ignoreList, ignoreAll };
}

// ================================ Export Processor ===============================
module.exports = function (done) {
  let returnCode;
  try {
    const componentPathList = getProjectPath('components/**/*.ts*');
    const globConfig = {};

    // Set ignore files
    if (configFile.ignore) {
      globConfig.ignore = configFile.ignore;
    } else if (argv.ignore) {
      globConfig.ignore = argv.ignore.split(',');
    }

    if (argv.id) {
      console.log('Only file id:', argv.id);
    }
    if (argv.file) {
      console.log('Only file includes:', argv.file);
    }

    const tsFiles = glob
      .sync(componentPathList, globConfig)
      .filter(tsPath => !/components\/_/.test(tsPath) && !/~/.test(tsPath));

    // User experience
    const useTerminal = process.stdout.isTTY && !process.env.CI;
    debug('Use terminal:', String(useTerminal));

    let progressBar;
    if (useTerminal) {
      progressBar =
        !argv.debug &&
        new ProgressBar('Processing [:bar] :percent (:current/:total)', {
          complete: '=',
          incomplete: ' ',
          width: 20,
          total: tsFiles.length,
        });
    }

    // Statistic components used modules
    const componentModules = {};
    // Statistic component file related id
    const componentIds = {};
    // Statistic component use `@ant-designs/icons` directly
    const fullImportComponentModules = {};

    tsFiles.forEach((filePath, index) => {
      if (progressBar) progressBar.tick();

      // Skip if id not match
      if (argv.id && argv.id !== index) return;

      // Skip if file not match
      if (argv.file && !filePath.toUpperCase().includes(String(argv.file).toUpperCase())) {
        return;
      }

      const id = String(index).padStart(3, '0');
      debug(chalk.cyan(`[${id}]`), chalk.blue('Transform:'), filePath);

      const { moduleList } = getModules(filePath, globConfig);

      const componentRoot = getComponentRootPath(filePath);

      const relativeDepsModuleList = moduleList.filter(module => {
        debug(
          chalk.blue(' > Module:'),
          module.shouldLint ? chalk.green('[KEEP]') : chalk.yellow('[SKIP]'),
          module.shouldRelativeImport ? chalk.red('[FULL]') : chalk.yellow('[PASS]'),
          module.name,
          module.isRelative ? chalk.cyan('[RELATIVE]') : '',
          module.fromPattern ? chalk.cyan('[PATTERN]') : ''
        );

        if (module.shouldRelativeImport) {
          fullImportComponentModules[componentRoot] =
            fullImportComponentModules[componentRoot] || [];
          fullImportComponentModules[componentRoot].push(module.name);
        }

        return module.shouldLint;
      });

      // Process modules
      if (!componentRoot) {
        console.warn('File path not match:', filePath);
        return;
      }

      const componentModuleList = (componentModules[componentRoot] =
        componentModules[componentRoot] || []);
      const componentIdList = (componentIds[componentRoot] = componentIds[componentRoot] || []);

      relativeDepsModuleList.forEach(module => {
        if (componentModuleList.some(m => m.name === module.name)) return;
        componentModuleList.push(module);
      });
      componentIdList.push(id);
    });

    // Loop component check
    Object.keys(componentModules).forEach(componentPath => {
      const componentModuleList = componentModules[componentPath];

      const moduleRootStyleList = componentModuleList.map(module =>
        path.resolve(getComponentRootPath(module.path), 'style')
      );

      const componentRootStylePath = path.resolve(componentPath, 'style/index.tsx');
      if (!fs.existsSync(componentRootStylePath)) {
        debug('Style file path not exist:', componentRootStylePath);
        return;
      }

      const {
        moduleList: rootStyleModuleList,
        ignoreList: rootStyleModuleIgnoreList,
        ignoreAll: rootStyleModuleIgnoreAll,
      } = getModules(componentRootStylePath, {});

      // Check missed files
      const missStyleModuleList = moduleRootStyleList.filter(
        styleModulePath =>
          rootStyleModuleList.every(module => !module.path.includes(styleModulePath)) &&
          rootStyleModuleIgnoreList.every(ignoreWord => !styleModulePath.includes(ignoreWord))
      );

      // Check useless files
      const uselessStyleModuleList = rootStyleModuleList
        // filter self styles
        .filter(({ name }) => name.slice(0, 2) !== './' && name !== '../../style/index.less')

        // filter ignore list
        .filter(({ path: stylePath }) =>
          rootStyleModuleIgnoreList.every(ignoreWord => !stylePath.includes(ignoreWord))
        )

        // filter used styles
        .filter(({ path: stylePath }) => {
          return !moduleRootStyleList.includes(stylePath);
        });

      // Log error message
      if (rootStyleModuleIgnoreAll) {
        console.log(chalk.yellow('Check skip:'), componentPath);
      } else if (missStyleModuleList.length || uselessStyleModuleList.length) {
        returnCode = 1;
        console.log(chalk.red('Dependency style file(s) not included in:', componentRootStylePath));

        missStyleModuleList.forEach(styleModulePath => {
          console.log(chalk.yellow(' - [Missing]'), styleModulePath);
        });

        uselessStyleModuleList.forEach(({ path: uselessPath }) => {
          console.log(chalk.yellow(' - [Useless]'), uselessPath);
        });

        console.log(`(debug id: ${componentIds[componentPath].join(', ')})`);
      } else if (fullImportComponentModules[componentPath]) {
        returnCode = 1;
        console.log(chalk.red('Not fully import:', componentPath));
        fullImportComponentModules[componentPath].forEach(moduleName => {
          console.log(chalk.yellow(' - [Module]'), moduleName);
        });
      } else {
        console.log(chalk.green('Check pass:'), componentPath);
      }
    });
  } catch (err) {
    returnCode = 1;
    console.log(err);
  }

  if (!returnCode) {
    console.log(chalk.green('✅ Congratulations! All dependencies check pass!'));
  } else {
    console.log(
      chalk.cyan(
        'Check failed. You can use `--debug` with `--id=xxx` or `--file=xxx` to check detail.'
      )
    );
  }

  done(returnCode);
};
