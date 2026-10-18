export function frontendBuildCacheKey(env: Record<string, string | undefined>, options?: { source?: string }): string;

export function frontendBuildConfig(options: {
  command: string;
  mode: string;
  env: Record<string, string>;
  processEnv?: Record<string, string | undefined>;
}): { contextPath: string; metadata: Record<string, unknown> | null };

export function productionBuildMetadataPlugin(metadata: Record<string, unknown> | null): {
  name: string;
  generateBundle: () => void;
};
