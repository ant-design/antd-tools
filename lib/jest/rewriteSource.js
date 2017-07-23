function rewriteSource(t, path, libDir) {
  if (libDir === 'dist') {
    const matches = path.node.source.value.match(new RegExp('^antd(-mobile)?$'));
    if (matches) {
      path.node.source.value = `../../../dist/${matches[0]}`;
    }

    if (path.node.source.value === 'moment') {
      path.insertAfter(t.ExpressionStatement(
        t.CallExpression(
          t.MemberExpression(
            t.Identifier('moment'),
            t.Identifier('locale')
          ),
          [
            t.StringLiteral('zh-CN'),
          ]
        )
      ));
    }
  }
}

module.exports = rewriteSource;
