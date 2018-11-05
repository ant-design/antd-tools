const rucksack = require('rucksack-css');

module.exports = {
  plugins: [
    rucksack(),
    require('autoprefixer'),
    require('cssnano')({
      preset: [
        'advanced',
        {
          discardComments: {
            removeAll: true,
          },
        },
      ],
    }),
    require('postcss-preset-env')({
      browsers: [
        'last 2 versions',
        'Firefox ESR',
        '> 1%',
        'ie >= 9',
        'iOS >= 8',
        'Android >= 4',
      ],
    }),
  ],
};
