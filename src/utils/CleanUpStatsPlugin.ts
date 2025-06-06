import type { Compilation, Compiler, WebpackError } from 'webpack';

interface CleanUpStatsPluginOptions {
  MiniCSSExtractPlugin: boolean;
  tsLoader: boolean;
}

// We should use `stats` props of webpack. But it not work in v4.
export default class CleanUpStatsPlugin {
  option: CleanUpStatsPluginOptions;

  constructor(option?: Partial<CleanUpStatsPluginOptions>) {
    this.option = {
      MiniCSSExtractPlugin: true,
      tsLoader: true,
      ...option,
    };
  }

  shouldPickStatChild(child: Compilation): boolean {
    const { MiniCSSExtractPlugin } = this.option;
    if (MiniCSSExtractPlugin && child.name.includes('mini-css-extract-plugin')) return false;
    return true;
  }

  shouldPickWarning(message: WebpackError): boolean {
    const { tsLoader } = this.option;
    if (tsLoader && /export .* was not found in .*/.test(message.details || String(message))) {
      return false;
    }
    return true;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.done.tap('CleanUpStatsPlugin', stats => {
      const { children, warnings } = stats.compilation;
      if (Array.isArray(children)) {
        stats.compilation.children = children.filter(child => this.shouldPickStatChild(child));
      }
      if (Array.isArray(warnings)) {
        stats.compilation.warnings = warnings.filter(message => this.shouldPickWarning(message as WebpackError));
      }
    });
  }
}
