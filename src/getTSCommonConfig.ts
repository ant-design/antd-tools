import * as fs from 'fs-extra';
import { getProjectPath } from './utils/projectHelper';

interface CompilerOptions {
  noUnusedParameters: boolean;
  noUnusedLocals: boolean;
  strictNullChecks: boolean;
  target: string;
  jsx: string;
  moduleResolution: string;
  declaration: boolean;
  allowSyntheticDefaultImports: boolean;
  [key: string]: unknown;
}

interface TsConfig {
  compilerOptions?: CompilerOptions;
}

export default function (): CompilerOptions {
  let my: TsConfig = {};
  if (fs.existsSync(getProjectPath('tsconfig.json'))) {
    my = fs.readJsonSync(getProjectPath('tsconfig.json'));
  }
  const defaultOptions: CompilerOptions = {
    noUnusedParameters: true,
    noUnusedLocals: true,
    strictNullChecks: true,
    target: 'es2020',
    jsx: 'preserve',
    moduleResolution: 'node',
    declaration: true,
    allowSyntheticDefaultImports: true,
  };

  return {
    ...defaultOptions,
    ...my.compilerOptions,
  };
}
