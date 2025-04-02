import { Command } from 'commander';
import { majo } from 'majo';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import unified from 'unified';
import parse from 'remark-parse';
import stringify from 'remark-stringify';
import yamlConfig from 'remark-yaml-config';
import frontmatter from 'remark-frontmatter';

// Minimal interface for AST node
interface Node {
  type: string;
  children?: Node[];
  value?: string;
}
interface Root {
  children: Node[];
}
interface Context {
  files: Record<string, unknown>;
  fileContents(filename: string): string;
  meta: Record<string, unknown>;
  writeContents(filename: string, content: string): void;
}

// Define fileAPIs type
interface FileAPI {
  static: Set<string>;
  size: Set<string>;
  dynamic: Set<string>;
  deprecated: Set<string>;
}
let fileAPIs: Record<string, FileAPI> = {};

const remarkWithYaml = unified()
  .use(parse)
  .use(stringify, {
    listItemIndent: '1',
    stringLength: () => 3,
  })
  .use(frontmatter)
  .use(yamlConfig);

const stream = majo();

// Updated get with improved types
function get(obj: unknown, pathStr: string = '', defaultValue?: unknown): unknown {
  return (
    pathStr.split('.').reduce((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj) || defaultValue
  );
}

function getCellValue(node: Node): string {
  let cloneNode: Node = { ...node };
  // Traverse until a text node is found
  while (cloneNode.type !== 'text' && cloneNode.children && cloneNode.children.length > 0) {
    cloneNode = cloneNode.children[0];
  }
  return cloneNode.value || '';
}

function checkForCellDeletion(node: Node): boolean {
  let cloneNode: Node = { ...node };
  while (cloneNode.children && Array.isArray(cloneNode.children)) {
    if (cloneNode.type === 'delete') {
      return true;
    }
    cloneNode = cloneNode.children[0];
  }
  return cloneNode.type === 'delete';
}

// from small to large
const sizeBreakPoints = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
const whiteMethodList = ['afterChange', 'beforeChange'];

const groups = {
  isDynamic: (val: string): boolean => /^on[A-Z]/.test(val) || whiteMethodList.indexOf(val) > -1,
  isSize: (val: string): boolean => sizeBreakPoints.indexOf(val) > -1,
  isDeprecated: checkForCellDeletion,
};

function asciiSort(prev: string | number, next: string | number): number {
  if (prev > next) {
    return 1;
  }
  if (prev < next) {
    return -1;
  }
  return 0;
}

// follow the alphabet order
function alphabetSort(nodes: Node[]): Node[] {
  return nodes.sort((a, b) =>
    asciiSort(getCellValue(a).toLowerCase(), getCellValue(b).toLowerCase())
  );
}

function sizeSort(nodes: Node[]): Node[] {
  return nodes.sort((a, b) =>
    asciiSort(
      sizeBreakPoints.indexOf(getCellValue(a).toLowerCase()),
      sizeBreakPoints.indexOf(getCellValue(b).toLowerCase())
    )
  );
}

function sort(ast: Root, filename: string): Root {
  const nameMatch = filename.match(/^components\/([^/]*)\//);
  const componentName = nameMatch ? nameMatch[1] : 'unknown';
  fileAPIs[componentName] = fileAPIs[componentName] || {
    static: new Set<string>(),
    size: new Set<string>(),
    dynamic: new Set<string>(),
    deprecated: new Set<string>(),
  };

  ast.children.forEach((child: Node) => {
    // Initialize arrays with Node type
    const staticProps: Node[] = [];
    const dynamicProps: Node[] = [];
    const sizeProps: Node[] = [];
    const deprecatedProps: Node[] = [];

    if (child.type === 'table' && child.children) {
      // Skip table header (thead)
      child.children.slice(1).forEach((node: Node) => {
        const value = getCellValue(node);
        if (groups.isDeprecated(node)) {
          deprecatedProps.push(node);
          fileAPIs[componentName].deprecated.add(value);
        } else if (groups.isDynamic(value)) {
          dynamicProps.push(node);
          fileAPIs[componentName].dynamic.add(value);
        } else if (groups.isSize(value)) {
          sizeProps.push(node);
          fileAPIs[componentName].size.add(value);
        } else {
          staticProps.push(node);
          fileAPIs[componentName].static.add(value);
        }
      });

      child.children = [
        child.children[0],
        ...alphabetSort(staticProps),
        ...sizeSort(sizeProps),
        ...alphabetSort(dynamicProps),
        ...alphabetSort(deprecatedProps), // deprecated props should be the last
      ];
    }
  });
  return ast;
}

function sortAPI(md: string, filename: string): string {
  const ast = remarkWithYaml.parse(md) as Root;
  const sortedAst = sort(ast, filename);
  return remarkWithYaml.stringify(sortedAst);
}

function sortMiddleware(ctx: Context): void {
  Object.keys(ctx.files).forEach((filename: string) => {
    const content: string = ctx.fileContents(filename);
    const sortedContent: string = sortAPI(content, filename);
    if (get(ctx.meta, 'program.report', false)) {
      console.log(chalk.cyan(`🔍 report ${filename}`));
    } else {
      ctx.writeContents(filename, sortedContent);
    }
  });
}

export default (): void => {
  fileAPIs = {};
  const program = new Command();
  program
    .version('0.1.0')
    .option(
      '-f, --file [file]',
      'Specify which file to be transformed',
      'components/**/index.+(zh-CN|en-US).md'
    )
    .option('-o, --output [output]', 'Specify component api output path', '~component-api.json')
    .option('-r, --report', 'Only output the report, will not modify the file', false)
    .parse(process.argv);
  // inject context to the majo stream
  function injectContext(ctx: Context): void {
    if (typeof ctx.meta !== 'object') ctx.meta = {};
    Object.assign(ctx.meta, { program });
  }
  /* eslint-disable no-console */
  stream
    .source(program.file)
    .use(injectContext)
    .use(sortMiddleware)
    .dest('.')
    .then(() => {
      if (program.output) {
        const data: Record<string, unknown> = {};
        Object.keys(fileAPIs).forEach(componentName => {
          data[componentName] = {
            static: [...fileAPIs[componentName].static],
            size: [...fileAPIs[componentName].size],
            dynamic: [...fileAPIs[componentName].dynamic],
            deprecated: [...fileAPIs[componentName].deprecated],
          };
        });
        const reportPath = path.resolve(program.output);
        fs.writeFileSync(reportPath, JSON.stringify(data, null, 2), 'utf8');
        console.log(chalk.cyan(`API list file: ${reportPath}`));
      }
    })
    .then(() => {
      console.log(chalk.green(`sort ant-design api successfully!`));
    });
  /* eslint-enable no-console */
};
