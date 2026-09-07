import crypto from 'crypto';
import { readFileSync } from 'fs';
import urlLoader from 'url-loader';
import pkg from '../../package.json';

interface TransformOptions {
  supportsStaticESM?: boolean;
  configString?: string;
  instrument?: boolean;
}

function process(_src: string, filename: string, options: TransformOptions = {}): { code: string } {
  const instance = {
    resourcePath: filename,
    query: {
      // Jest does not provide webpack's file emission context for large assets.
      limit: true,
      esModule: !!options.supportsStaticESM,
    },
  };
  // Jest supplies UTF-8 text, which cannot preserve arbitrary image bytes.
  const result = urlLoader.call(instance, readFileSync(filename));
  return { code: result };
}

function getCacheKey(_src: string, filename: string, options: TransformOptions): string {
  // Different binary files can have identical decoded text in Jest's default key.
  return crypto
    .createHash('md5')
    .update(readFileSync(filename))
    .update('\0')
    .update(
      JSON.stringify([
        filename,
        options.configString,
        options.supportsStaticESM,
        options.instrument,
      ])
    )
    .update('\0')
    .update(pkg.version)
    .digest('hex');
}

export default {
  process,
  getCacheKey,
};
