'use strict';

import { dirname } from 'path';
import fs from 'fs';
import { getProjectPath } from './utils/projectHelper';
import type { NodePath } from '@babel/traverse';
import type { ImportDeclaration, ExportNamedDeclaration } from '@babel/types';

function replacePath(path: NodePath<ImportDeclaration | ExportNamedDeclaration>): void {
  const source = path.node.source;
  if (source && /\/lib\//.test(source.value)) {
    const esModule = source.value.replace('/lib/', '/es/');
    const esPath = dirname(getProjectPath('node_modules', esModule));
    if (fs.existsSync(esPath)) {
      source.value = esModule;
    }
  }
  // @ant-design/icons/xxx => @ant-design/icons/es/icons/xxx
  const antdIconMatcher = /@ant-design\/icons\/([^/]*)$/;
  if (source && antdIconMatcher.test(source.value)) {
    const esModule = source.value.replace(
      antdIconMatcher,
      (_, iconName: string) => `@ant-design/icons/es/icons/${iconName}`
    );
    const esPath = dirname(getProjectPath('node_modules', esModule));
    if (fs.existsSync(esPath)) {
      source.value = esModule;
    }
  }
}

function replaceLib() {
  return {
    visitor: {
      ImportDeclaration: replacePath,
      ExportNamedDeclaration: replacePath,
    },
  };
}

export default replaceLib;
