const { cssInjection } = require('../../lib/utils/styleUtil');

describe('styleUtil', () => {
  it('cssInjection', () => {
    const libContent = `
"use strict";
require("../../style/index.less");
require("./index.less");

require("../../radio/style");
require("../../checkbox/style");
require("../../dropdown/style");
require("../../spin/style");
require("../../pagination/style");
    `.trim();
    const esContent = `
import '../../style/index.less';
import './index.less';

import '../../radio/style';
import '../../checkbox/style';
import '../../dropdown/style';
import '../../spin/style';
import '../../pagination/style';
    `.trim();

    expect(cssInjection(libContent)).toEqual(`
"use strict";
require("../../style/index.css");
require("./index.css");

require("../../radio/style/css");
require("../../checkbox/style/css");
require("../../dropdown/style/css");
require("../../spin/style/css");
require("../../pagination/style/css");
    `.trim());
    expect(cssInjection(esContent)).toEqual(`
import '../../style/index.css';
import './index.css';

import '../../radio/style/css';
import '../../checkbox/style/css';
import '../../dropdown/style/css';
import '../../spin/style/css';
import '../../pagination/style/css';
    `.trim());
  });
});