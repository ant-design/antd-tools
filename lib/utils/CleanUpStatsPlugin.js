/* eslint-disable class-methods-use-this */

class CleanUpStatsPlugin {
  shouldPickStatChild(child) {
    return child.name.indexOf('mini-css-extract-plugin') !== 0;
  }

  apply(compiler) {
    compiler.hooks.done.tap('CleanUpStatsPlugin', (stats) => {
      const { children } = stats.compilation;
      if (Array.isArray(children)) {
        // eslint-disable-next-line no-param-reassign
        stats.compilation.children = children
          .filter(child => this.shouldPickStatChild(child));
      }
    });
  }
}

module.exports = CleanUpStatsPlugin;