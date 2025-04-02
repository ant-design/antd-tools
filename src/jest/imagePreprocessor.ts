import urlLoader from 'url-loader';
import getWebpackConfig from '../getWebpackConfig';

const { svgRegex, svgOptions, imageOptions } = getWebpackConfig;

interface LoaderContext {
  resourcePath: string;
  query?: Record<string, unknown>;
}

function process(src: string, filename: string): { code: string } {
  const instance: LoaderContext = { resourcePath: filename };
  if (svgRegex.test(filename)) {
    instance.query = svgOptions;
  } else {
    instance.query = imageOptions;
  }
  const result = urlLoader.call(instance, src);
  return { code: result };
}

export default {
  process,
};
