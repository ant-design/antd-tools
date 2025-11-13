import * as babel from '@babel/core';

function rewriteSource(
  t: typeof babel.types,
  path: babel.NodePath<babel.types.ImportDeclaration>,
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
