const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const glob = require('glob');
const argv = require('minimist')(process.argv.slice(2));
const babel = require('@babel/core');
const getBabelCommonConfig = require('../getBabelCommonConfig');
const { getProjectPath } = require('../utils/projectHelper');

const SKIP_REGEX = /deps-lint-skip:\s*([\w\d-_,\s]*)/;

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

function getModules(filePath, globConfig, debugAST) {
  const moduleList = [];
  const { ast } = babel.transformFileSync(filePath, babelConfig);
  const astBody = ast.program.body;
  const astComments = ast.comments;

  // Support skip module check
  const ignoreList = (astComments || [])
    .reduce((list, { value }) => {
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

      const isRelative = /^..\//.test(module);

      let shouldLint = false;
      const absolutePath = path.resolve(path.dirname(filePath), module);

      if (module && isRelative) {
        const checkedPath = glob.sync(`${absolutePath}?(.*)`, globConfig);
        if (checkedPath.length) {
          shouldLint = true;
        }
      }

      moduleList.push({
        name: module,
        path: absolutePath,
        shouldLint,
        isRelative,
      });
    });
  }

  return { moduleList, ignoreList };
}

module.exports = function(done) {
  let returnCode;
  try {
    const componentPath = getProjectPath('components/**/*.ts*');
    const globConfig = {};

    if (argv.ignore) {
      globConfig.ignore = argv.ignore.split(',');
    }

    if (argv.only) {
      console.log('Only file id:', argv.only);
    }

    const tsFiles = glob
      .sync(componentPath, globConfig)
      .filter(tsPath => !/components\/_/.test(tsPath) && !/~/.test(tsPath));

    tsFiles.forEach((filePath, index) => {
      if (argv.only && argv.only !== index) return;

      const id = String(index).padStart(3, '0');
      debug(chalk.cyan(`[${id}]`), chalk.blue('Transform:'), filePath);

      const { moduleList } = getModules(filePath, globConfig);
      const relativeDepsModuleList = moduleList.filter(module => {
        debug(
          chalk.blue(' > Module:'),
          module.shouldLint ? chalk.green('[KEEP]') : chalk.yellow('[SKIP]'),
          module.name,
          module.isRelative ? chalk.cyan('[RELATIVE]') : ''
        );
        return module.shouldLint;
      });

      // Process modules
      if (!relativeDepsModuleList.length) {
        debug('Nothing tracking, skip...');
        return;
      }

      const componentRoot = getComponentRootPath(filePath);
      if (!componentRoot) {
        console.warn('File path not match:', filePath);
        return;
      }

      const moduleRootStyleList = relativeDepsModuleList.map(module =>
        path.resolve(getComponentRootPath(module.path), 'style')
      );

      const componentRootStylePath = path.resolve(componentRoot, 'style/index.tsx');
      if (!fs.existsSync(componentRootStylePath)) {
        debug('Style file path not exist:', componentRootStylePath);
        return;
      }

      const { moduleList: rootStyleModuleList, ignoreList: rootStyleModuleIgnoreList } = getModules(
        componentRootStylePath,
        {}
      );
      const missStyleModuleList = moduleRootStyleList.filter(
        styleModulePath =>
          rootStyleModuleList.every(module => !module.path.includes(styleModulePath)) &&
          rootStyleModuleIgnoreList.every(ignoreWord => !styleModulePath.includes(ignoreWord))
      );

      if (missStyleModuleList.length) {
        returnCode = 1;
        console.log(
          chalk.red(`[${id}]`, 'Dependency style file(s) not included in:', componentRootStylePath)
        );
        missStyleModuleList.forEach(styleModulePath => {
          console.log(chalk.yellow(' - Missing:', styleModulePath));
        });
      } else {
        debug(chalk.green('> All style included!'));
      }
    });
  } catch (err) {
    returnCode = 1;
    console.log(err);
  }

  if (!returnCode) {
    console.log(chalk.green('Congratulations! All style dependencies included!'));
  }

  done(returnCode);
};
