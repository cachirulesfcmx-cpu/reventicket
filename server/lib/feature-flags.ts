export interface FeatureFlags {
  RISK_ENGINE_ENABLED: boolean;
  ANALYTICS_ENABLED: boolean;
  WALLET_ENABLED: boolean;
  RESALE_ENABLED: boolean;
  FRAUD_STRICT_MODE: 'low' | 'medium' | 'high';
}

export function getFeatureFlags(): FeatureFlags {
  return {
    RISK_ENGINE_ENABLED: process.env.RISK_ENGINE_ENABLED === 'true',
    ANALYTICS_ENABLED: process.env.ANALYTICS_ENABLED === 'true',
    WALLET_ENABLED: process.env.WALLET_ENABLED === 'true',
    RESALE_ENABLED: process.env.RESALE_ENABLED === 'true',
    FRAUD_STRICT_MODE: (process.env.FRAUD_STRICT_MODE as 'low' | 'medium' | 'high') || 'low',
  };
}

export function isFeatureEnabled(flag: keyof Omit<FeatureFlags, 'FRAUD_STRICT_MODE'>): boolean {
  const flags = getFeatureFlags();
  return flags[flag];
}

export function getFraudStrictMode(): 'low' | 'medium' | 'high' {
  return getFeatureFlags().FRAUD_STRICT_MODE;
}
