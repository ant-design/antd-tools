import glob from 'glob';
import fs from 'fs';

const COMPONENT_NAME = /components\/([^/]*)/;
const PROP_NAME = /^\s*\|\s*([^\s|]*)/;

const components: { [key: string]: string[] } = {};

function mappingPropLine(component: string, line: string): void {
  const propMatch = line.match(PROP_NAME);
  if (!propMatch) return;

  const propName = propMatch[1];
  if (!/^[a-z]/.test(propName)) return;

  components[component] = Array.from(new Set([...(components[component] || []), propName]));
}

function apiReport(entities: { [key: string]: string[] }): { [key: string]: string[] } {
  const apis: { [key: string]: string[] } = {};
  Object.keys(entities).forEach(component => {
    const apiList = entities[component];
    apiList.forEach(api => {
      if (typeof apis[api] === 'function') {
        apis[api] = [];
      }
      apis[api] = [...(apis[api] || []), component];
    });
  });

  return apis;
}

function printReport(apis: { [key: string]: string[] }): void {
  const apiList = Object.keys(apis).map(api => ({
    name: api,
    componentList: apis[api],
  }));
  apiList.sort((a, b) => b.componentList.length - a.componentList.length);
  console.log('| name | components | comments |');
  console.log('| ---- | ---------- | -------- |');
  apiList.forEach(({ name, componentList }) => {
    console.log('|', name, '|', componentList.join(', '), '| |');
  });
}

export default (): void => {
  glob('components/*/*.md', (error: Error | null, files: string[]) => {
    files.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      const match = filePath.match(COMPONENT_NAME);
      if (!match) return;
      const component = match[1];

      const lines = content.split(/[\r\n]+/);
      lines.forEach(line => {
        mappingPropLine(component, line);
      });
    });

    printReport(apiReport(components));
  });
};
