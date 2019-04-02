const { getProjectPath } = require('../utils/projectHelper'); // eslint-disable-line import/order

const fs = require('fs');
const chalk = require('chalk');
const fetch = require('node-fetch');
const readline = require('readline');

module.exports = function(packageName, done) {
  console.log(chalk.cyan('Fetching latest version file list...'));
  fetch(`https://unpkg.com/${packageName}/?meta`)
    .then(res => res.json())
    .then(({ files: pkgFiles }) => {
      // Loop all the exist files
      function flattenPath(files, fileList = []) {
        (files || []).forEach(({ path, files: subFiles }) => {
          fileList.push(path);
          flattenPath(subFiles, fileList);
        });
        return fileList;
      }
      return flattenPath(pkgFiles);
    })
    .then(fileList => {
      // Find missing files
      const missingFiles = fileList.filter(filePath => !fs.existsSync(getProjectPath(filePath)));

      if (missingFiles.length) {
        console.log(chalk.yellow('⚠️  Some file missing in current build:'));
        missingFiles.forEach(filePath => {
          console.log(` - ${filePath}`);
        });
        return Promise.reject('Please double confirm with files.'); // eslint-disable-line prefer-promise-reject-errors
      }

      console.log(chalk.green('✅ Nothing missing with latest version.'));
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
          ['Type "YES" to confirm it is safe.', 'Type "NO" to fail this check.', ''].join('\n'),
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
