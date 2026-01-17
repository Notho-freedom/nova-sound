export type FeatureFlagKey =
  | 'cloudUpload'
  | 'bunnyUpload'
  | 'planethosterUpload'
  | 'cloudinaryUpload'
  | 'aiFeatures';

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

const DEFAULT_FLAGS: FeatureFlags = {
  cloudUpload: true,
  bunnyUpload: true,
  planethosterUpload: true,
  cloudinaryUpload: true,
  aiFeatures: true,
};

const LOCAL_STORAGE_KEY = 'nexus-feature-flags';

function parseFlags(raw?: string | null): Partial<FeatureFlags> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return {};
}

function parseDisabledList(raw?: string | null): Partial<FeatureFlags> {
  if (!raw) return {};
  const disabled = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as FeatureFlagKey[];

  return disabled.reduce<Partial<FeatureFlags>>((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
}

export function getServerFeatureFlags(): FeatureFlags {
  const raw = process.env.FEATURE_FLAGS || process.env.NEXT_PUBLIC_FEATURE_FLAGS || null;
  const rawDisabled = process.env.FEATURE_FLAGS_DISABLED || process.env.NEXT_PUBLIC_FEATURE_FLAGS_DISABLED || null;
  return {
    ...DEFAULT_FLAGS,
    ...parseFlags(raw),
    ...parseDisabledList(rawDisabled),
  };
}

export function getFeatureFlags(): FeatureFlags {
  const flags = {
    ...getServerFeatureFlags(),
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const local = parseFlags(localStorage.getItem(LOCAL_STORAGE_KEY));
      return { ...flags, ...local };
    } catch {
      return flags;
    }
  }

  return flags;
}

export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return getFeatureFlags()[flag];
}

export function isFeatureEnabledServer(flag: FeatureFlagKey): boolean {
  return getServerFeatureFlags()[flag];
}
