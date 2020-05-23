const { getProjectPath } = require('../utils/projectHelper'); // eslint-disable-line import/order

const fs = require('fs');
const chalk = require('chalk');
const fetch = require('node-fetch');
const readline = require('readline');

function getMajorVersion(version) {
  const match = version && version.match(/^\d+/);

  if (match) {
    return `@${match[0]}.x`;
  }

  return '';
}

function getVersionFromURL(url, name) {
  const affix = url.slice(url.indexOf(name) + name.length + 1);
  return affix.slice(0, affix.indexOf('/'));
}

module.exports = function (packageName, packageVersion, done) {
  console.log(chalk.cyan('Fetching latest version file list...'));
  fetch(`https://unpkg.com/${packageName}${getMajorVersion(packageVersion)}/?meta`)
    .then(res => {
      const version = getVersionFromURL(res.url, packageName);
      return res.json().then(json => ({ version, ...json }));
    })
    .then(({ version, files: pkgFiles }) => {
      // Loop all the exist files
      function flattenPath(files, fileList = []) {
        (files || []).forEach(({ path, files: subFiles }) => {
          fileList.push(path);
          flattenPath(subFiles, fileList);
        });
        return fileList;
      }
      return { version, fileList: flattenPath(pkgFiles) };
    })
    .then(({ version, fileList }) => {
      // Find missing files
      const missingFiles = fileList.filter(filePath => !fs.existsSync(getProjectPath(filePath)));

      if (missingFiles.length) {
        console.log(
          chalk.red(`⚠️  Some file missing in current build (last version: ${version}):`)
        );
        missingFiles.forEach(filePath => {
          console.log(` - ${filePath}`);
        });
        return Promise.reject('Please double confirm with files.'); // eslint-disable-line prefer-promise-reject-errors
      }

      console.log(
        chalk.green('✅ Nothing missing compare to latest version:'),
        chalk.yellow(version)
      );
      return 0;
    })
    .then(done)
    .catch(err => {
      console.error(err);
      console.log(chalk.yellow('\nNeed confirm for file diff:'));

      function userConfirm() {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        rl.question(
          ['Type "YES" to confirm it is safe.', 'Type "NO" to exit process.', ''].join('\n'),
          answer => {
            rl.close();

            if (answer === 'YES') {
              console.log(chalk.green('✅ Confirm it is OK.'));
              done();
            } else if (answer === 'NO') {
              console.log(chalk.red('🚫 Aha! Catch you!'));
              done(1);
            } else {
              console.log(chalk.yellow('Invalidate input. Type again!'));
              userConfirm();
            }
          }
        );
      }

      userConfirm();
    });
};
