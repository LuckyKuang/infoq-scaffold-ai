import path from 'path';

export const sharedResolve = {
  alias: {
    '@': path.resolve(__dirname, '../src')
  },
  extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
};

export const sharedScssPreprocessorOptions = {
  scss: {
    api: 'modern-compiler' as const
  }
};
