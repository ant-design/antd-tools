const rucksack = require('rucksack-css');
const autoprefixer = require('autoprefixer');

module.exports = {
  postcssOptions: {
    plugins: [rucksack(), autoprefixer()],
  },
};
