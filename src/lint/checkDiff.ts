import { getProjectPath } from '../utils/projectHelper';
import fs from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import readline from 'readline';
import minimist from 'minimist';

const argv = minimist(process.argv.slice(2));

// Added interface to replace "any"
interface FileItem {
  path: string;
  files?: FileItem[];
}

function getMajorVersion(version: string, specificVersion?: string): string {
  if (specificVersion) {
    return `@${specificVersion}`;
  }

  const match = version && version.match(/^\d+/);

  if (match) {
    return `@${match[0]}.x`;
  }

  return '';
}

function getVersionFromURL(url: string, name: string): string {
  const affix = url.slice(url.indexOf(name) + name.length + 1);
  return affix.slice(0, affix.indexOf('/'));
}

export default function (
  packageName: string,
  packageVersion: string,
  done: (err?: Error) => void
): void {
  const mergedVersion = getMajorVersion(packageVersion, argv.version);
  console.log(chalk.cyan(`Fetching latest version file list...${packageName}${mergedVersion}`));

  fetch(`https://unpkg.com/${packageName}${mergedVersion}/?meta`)
    .then(res => {
      const version = getVersionFromURL(res.url, packageName);
      return res.json().then((json: object) => ({ version, ...json }));
    })
    .then(({ version, files: pkgFiles }: { version: string; files: FileItem[] }) => {
      function flattenPath(files: FileItem[], fileList: string[] = []): string[] {
        (files || []).forEach(({ path, files: subFiles }) => {
          fileList.push(path);
          flattenPath(subFiles, fileList);
        });
        return fileList;
      }
      return { version, fileList: flattenPath(pkgFiles) };
    })
    .then(({ version, fileList }) => {
      const missingFiles = fileList.filter(filePath => {
        const concatFilePath = argv.path ? join(argv.path, filePath) : filePath;

        return !fs.existsSync(getProjectPath(concatFilePath));
      });

      if (missingFiles.length) {
        console.log(
          chalk.red(`⚠️  Some file missing in current build (last version: ${version}):`)
        );
        missingFiles.forEach(filePath => {
          console.log(` - ${filePath}`);
        });
        return Promise.reject('Please double confirm with files.');
      }

      console.log(
        chalk.green('✅ Nothing missing compare to latest version:'),
        chalk.yellow(version)
      );
      return 0;
    })
    .then(() => done())
    .catch(err => {
      console.error(err);
      console.log(chalk.yellow('\nNeed confirm for file diff:'));

      function userConfirm(): void {
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
              done(new Error('User cancel the process.'));
            } else {
              console.log(chalk.yellow('Invalidate input. Type again!'));
              userConfirm();
            }
          }
        );
      }

      userConfirm();
    });
}
