import { getProjectPath } from '../utils/projectHelper';
import { join } from 'path';
import chalk from 'chalk';
import fetch from 'node-fetch';
import readline from 'readline';
import minimist from 'minimist';
import Arborist from '@npmcli/arborist';
import packlist from 'npm-packlist';

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

  function getLatestVersionFileList() {
    return fetch(`https://unpkg.com/${packageName}${mergedVersion}/?meta`)
      .then(res => {
        const version = getVersionFromURL(res.url, packageName);
        return res.json().then((json: object) => ({ version, ...json }));
      })
      .then(({ version, files: pkgFiles }: { version: string; files: FileItem[] }) => {
        function flattenPath(files: FileItem[], fileList: string[] = []): string[] {
          (files || []).forEach(({ path, files: subFiles }) => {
            const realPath = argv.path ? join(argv.path, path) : path
            fileList.push(realPath);
            flattenPath(subFiles, fileList);
          });
          return fileList;
        }
        return { version, fileList: flattenPath(pkgFiles) };
      })
  }

  function getLocalVersionFileList() {
    const arborist = new Arborist({ path: getProjectPath() });
    return arborist.loadActual().then(packlist) as Promise<string[]>;
  }


  Promise.all([
    getLocalVersionFileList(),
    getLatestVersionFileList(),
  ])
    .then(([localFiles, { version, fileList }]) => {
      const localSet = new Set(localFiles);
      const remoteSet = new Set(fileList);

      const missingFiles: string[] = [];
      const addedFiles: string[] = [];

      const allFiles = new Set([...fileList, ...localFiles]);
      allFiles.forEach(filePath => {
        if (!localSet.has(filePath)) {
          missingFiles.push(filePath);
        } else if (!remoteSet.has(filePath)) {
          addedFiles.push(filePath);
        }
      });
      return { missingFiles, addedFiles, version };
    })
    .then(({ missingFiles, addedFiles, version }) => {


      if (addedFiles.length) {
        console.log(
          chalk.yellow(`⚠️  Some file added in current build (last version: ${version}):`)
        );
        addedFiles.forEach(filePath => {
          console.log(chalk.yellow(` + ${filePath}`));
        });

        // Separator
        console.log();
        console.log(chalk.gray(`-`.repeat(process.stdout.columns || 64)));
        console.log();
      }

      if (missingFiles.length) {
        console.log(
          chalk.red(`⚠️  Some file missing in current build (last version: ${version}):`)
        );
        missingFiles.forEach(filePath => {
          console.log(chalk.red(` - ${filePath}`));
        });
      }

      const total = missingFiles.length + addedFiles.length;

      if (total) {
        return Promise.reject(
          new Error(`Please double confirm with files. ${missingFiles.length} missing, ${addedFiles.length} added.`)
        );
      }
      console.log(
        chalk.green('✅ Nothing missing compare to latest version:'),
        chalk.gray(version)
      );
      return Promise.resolve(true);
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
