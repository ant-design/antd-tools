import type { NodePath } from '@babel/traverse';
import type { ImportDeclaration } from '@babel/types';

function rewriteSource(
  t: typeof import('@babel/types'),
  path: NodePath<ImportDeclaration>,
  libDir: string
): void {
  if (libDir === 'dist') {
    const matches = path.node.source.value.match(new RegExp('^antd(-mobile)?$'));
    if (matches) {
      path.node.source.value = `../../../dist/${matches[0]}`;
    }
  }
}

export default rewriteSource;
