const path = require('path');

const cwd = process.cwd();

function getProjectPath(...filePath) {
  return path.join(cwd, ...filePath);
}

function resolve(moduleName) {
  return require.resolve(moduleName);
}

function injectRequire() {
  const Module = require('module');

  const oriRequire = Module.prototype.require;
  Module.prototype.require = function (...args) {
    const moduleName = args[0];
    try {
      return oriRequire.apply(this, args);
    } catch (err) {
      const newArgs = [...args];
      newArgs[0] = getProjectPath('node_modules', moduleName);
      return oriRequire.apply(this, newArgs);
    }
  };
}

module.exports = {
  getProjectPath,
  resolve,
  injectRequire,
};
