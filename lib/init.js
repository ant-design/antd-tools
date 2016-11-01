
'use strict';

// from publish-please

const path = require('path');
const writeFile = require('fs').writeFileSync;
const chalk = require('chalk');
const getNpmArgs = require('./utils/get-npm-args');

const pathJoin = path.join;

function reportNoConfig() {
  console.log(
    chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
  console.log(
    chalk.bgRed('!! Unable to setup antd-tools: project\'s package.json either missing !!'));
  console.log(
    chalk.bgRed('!! or malformed. Run `npm init` and then reinstall antd-tools.       !!'));
  console.log(
    chalk.bgRed('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
}

function reportCompletion() {
  console.log(
    chalk.bgGreen('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
  console.log(
    chalk.bgGreen('!! antd-tools was successfully installed for the project. !!'));
  console.log(
    chalk.bgGreen('!! Use `npm run pub` command for publishing.       !!'));
  console.log(
    chalk.bgGreen('!! publishing configuration.                                  !!'));
  console.log(
    chalk.bgGreen('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'));
}

function addConfigHooks(cfg, projectDir) {
  if (!cfg.scripts) {
    cfg.scripts = {};
  }

  if (cfg.scripts.pub) {
    return false;
  }

  cfg.scripts = Object.assign(cfg.scripts, {
    dist: 'antd-tools run dist',
    compile: 'antd-tools run compile',
    clean: 'antd-tools run clean',
    start: 'antd-tools run start',
    site: 'antd-tools run site',
    deploy: 'antd-tools run update-self && antd-tools run deploy',
    'just-deploy': 'antd-tools run just-deploy',
    pub: 'antd-tools run update-self && antd-tools run pub',
  });

  if (cfg.scripts.prepublish) {
    cfg.scripts['pre-publish'] = cfg.scripts.prepublish;
  }

  cfg.scripts.prepublish = 'antd-tools run guard';

  writeFile(pathJoin(projectDir, 'package.json'), JSON.stringify(cfg, null, 2));

  return true;
}

function init() {
  const testMode = process.argv.indexOf('--test-mode') > -1;

  // NOTE: don't run on dev installation (running `npm install` in this repo)
  if (!testMode) {
    const npmArgs = getNpmArgs();

    if (!npmArgs || !npmArgs.some(arg => /^antd-tools(@\d+\.\d+.\d+)?$/.test(arg))) {
      return;
    }
  }
  // NOTE: <projectDir>/node_modules/antd-tools/lib
  const projectDir = pathJoin(__dirname, '../../../');

  const cfg = require(path.join(projectDir, 'package.json'));

  if (!cfg) {
    reportNoConfig();
    process.exit(1);
  } else if (addConfigHooks(cfg, projectDir)) {
    reportCompletion();
  }
}

init();
