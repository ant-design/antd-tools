import fs from 'fs-extra';
import path from 'path';

const cwd: string = process.cwd();

export function getProjectPath(...filePath: string[]): string {
  return path.join(cwd, ...filePath);
}

export function resolve(moduleName: string): string {
  return require.resolve(moduleName);
}

export interface AntdToolsConfig {
  dist?: {
    finalize?: VoidFunction;
  };
  bail?: boolean;
  compile?: {
    transformTSFile?: (file: File) => File | File[];
    transformFile?: (file: File) => File | File[];
    finalize?: VoidFunction;
  };
}

export async function getConfig(): Promise<AntdToolsConfig> {
  const configPath: string = getProjectPath('.antd-tools.config.js');
  if (fs.existsSync(configPath)) {
    const configModule = await import(configPath);
    return configModule.default || configModule;
  }

  return {};
}

/**
 * 是否存在可用的 browserslist 配置
 * https://github.com/browserslist/browserslist#queries
 * @returns
 */
export function isThereHaveBrowserslistConfig(): boolean {
  try {
    const packageJson = fs.readJsonSync(getProjectPath('package.json'));
    if (packageJson.browserslist) {
      return true;
    }
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  } catch (e) {
    // DO NOTHING
  }
  if (fs.existsSync(getProjectPath('.browserslistrc'))) {
    return true;
  }
  if (fs.existsSync(getProjectPath('browserslist'))) {
    return true;
  }
  // parent 项目的配置支持，需要再补充
  // ROWSERSLIST ROWSERSLIST_ENV 变量的形式，需要再补充。
  return false;
}
