/**
 * Anti-scalping and bot protection system
 */

interface PurchaseLimit {
  maxPerUser: number;
  maxPerSession: number;
  maxPerPhone: number;
  windowMinutes: number;
}

interface FingerprintData {
  userAgent: string;
  acceptLanguage: string;
  timezone?: string;
  screenHints?: string;
  ipHash: string;
}

interface RiskScore {
  score: number;
  reasons: string[];
  action: 'allow' | 'challenge' | 'block';
}

// Default purchase limits
export const DEFAULT_LIMITS: PurchaseLimit = {
  maxPerUser: 6,
  maxPerSession: 4,
  maxPerPhone: 8,
  windowMinutes: 60
};

// Event-specific overrides (for high-demand events)
export const HIGH_DEMAND_LIMITS: PurchaseLimit = {
  maxPerUser: 4,
  maxPerSession: 2,
  maxPerPhone: 4,
  windowMinutes: 120
};

// In-memory tracking (would be Redis in production)
const purchaseTracker = new Map<string, { count: number; lastPurchase: number }>();
const reservationTracker = new Map<string, { count: number; expiredCount: number; lastAttempt: number }>();
const fingerprintRisk = new Map<string, { score: number; lastUpdate: number }>();

export function generateFingerprint(data: FingerprintData): string {
  const normalized = [
    data.userAgent.toLowerCase().slice(0, 100),
    data.acceptLanguage.toLowerCase().slice(0, 20),
    data.timezone || '',
    data.ipHash
  ].join('|');
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

export function hashIP(ip: string): string {
  // Partial hash - preserves some info for debugging but protects privacy
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  // IPv6 or other
  return ip.slice(0, 12) + '...';
}

export function checkPurchaseLimit(
  key: string,
  limits: PurchaseLimit = DEFAULT_LIMITS
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const windowMs = limits.windowMinutes * 60 * 1000;
  
  const tracker = purchaseTracker.get(key);
  
  if (!tracker || (now - tracker.lastPurchase) > windowMs) {
    // Window expired or new user
    return { allowed: true, remaining: limits.maxPerUser, resetIn: 0 };
  }
  
  const remaining = limits.maxPerUser - tracker.count;
  const resetIn = Math.ceil((windowMs - (now - tracker.lastPurchase)) / 1000);
  
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetIn
  };
}

export function recordPurchase(key: string): void {
  const now = Date.now();
  const existing = purchaseTracker.get(key);
  
  if (existing) {
    purchaseTracker.set(key, {
      count: existing.count + 1,
      lastPurchase: now
    });
  } else {
    purchaseTracker.set(key, { count: 1, lastPurchase: now });
  }
}

export function recordExpiredReservation(fingerprint: string): void {
  const now = Date.now();
  const existing = reservationTracker.get(fingerprint);
  
  if (existing) {
    reservationTracker.set(fingerprint, {
      count: existing.count + 1,
      expiredCount: existing.expiredCount + 1,
      lastAttempt: now
    });
  } else {
    reservationTracker.set(fingerprint, { count: 1, expiredCount: 1, lastAttempt: now });
  }
}

export function calculateRiskScore(
  fingerprint: string,
  signals: {
    requestsPerMinute?: number;
    failedAttempts?: number;
    expiredReservations?: number;
    multipleAccounts?: boolean;
    headlessBrowser?: boolean;
    rapidClicks?: boolean;
    ipChanges?: number;
  }
): RiskScore {
  let score = 0;
  const reasons: string[] = [];

  // Check requests per minute
  if (signals.requestsPerMinute && signals.requestsPerMinute > 30) {
    score += 30;
    reasons.push('high_request_rate');
  } else if (signals.requestsPerMinute && signals.requestsPerMinute > 15) {
    score += 15;
    reasons.push('elevated_request_rate');
  }

  // Failed attempts
  if (signals.failedAttempts && signals.failedAttempts > 5) {
    score += 25;
    reasons.push('many_failed_attempts');
  } else if (signals.failedAttempts && signals.failedAttempts > 2) {
    score += 10;
    reasons.push('some_failed_attempts');
  }

  // Expired reservations (hold farming)
  if (signals.expiredReservations && signals.expiredReservations > 3) {
    score += 35;
    reasons.push('hold_farming_suspected');
  } else if (signals.expiredReservations && signals.expiredReservations > 1) {
    score += 15;
    reasons.push('multiple_expired_reservations');
  }

  // Multiple accounts
  if (signals.multipleAccounts) {
    score += 20;
    reasons.push('multiple_accounts_same_fingerprint');
  }

  // Headless browser detection
  if (signals.headlessBrowser) {
    score += 40;
    reasons.push('headless_browser_detected');
  }

  // Rapid clicks (inhuman speed)
  if (signals.rapidClicks) {
    score += 25;
    reasons.push('rapid_clicks_detected');
  }

  // IP changes
  if (signals.ipChanges && signals.ipChanges > 3) {
    score += 20;
    reasons.push('frequent_ip_changes');
  }

  // Check historical risk
  const historicalRisk = fingerprintRisk.get(fingerprint);
  if (historicalRisk) {
    score += historicalRisk.score * 0.3; // Add 30% of historical score
  }

  // Update fingerprint risk
  fingerprintRisk.set(fingerprint, { score, lastUpdate: Date.now() });

  // Determine action
  let action: 'allow' | 'challenge' | 'block';
  if (score >= 70) {
    action = 'block';
  } else if (score >= 40) {
    action = 'challenge';
  } else {
    action = 'allow';
  }

  return { score, reasons, action };
}

export function isHeadlessBrowser(userAgent: string): boolean {
  const headlessPatterns = [
    /headless/i,
    /phantom/i,
    /selenium/i,
    /puppeteer/i,
    /playwright/i,
    /webdriver/i,
    /chrome\/\d+.*safari\/\d+.*$/i // Chrome without proper Safari string
  ];
  
  return headlessPatterns.some(pattern => pattern.test(userAgent));
}

export function getCooldownSeconds(expiredReservations: number): number {
  if (expiredReservations >= 5) return 900;   // 15 minutes
  if (expiredReservations >= 3) return 300;   // 5 minutes
  if (expiredReservations >= 2) return 120;   // 2 minutes
  return 0;
}

// Honeypot field names (invisible inputs that bots fill)
export const HONEYPOT_FIELDS = ['website_url', 'company_name', 'fax_number'];

export function checkHoneypot(formData: Record<string, unknown>): boolean {
  return HONEYPOT_FIELDS.some(field => {
    const value = formData[field];
    return value !== undefined && value !== '' && value !== null;
  });
}

// Cleanup old entries (call periodically)
export function cleanupTrackers(): void {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000; // 2 hours

  for (const [key, data] of purchaseTracker.entries()) {
    if (now - data.lastPurchase > maxAge) {
      purchaseTracker.delete(key);
    }
  }

  for (const [key, data] of reservationTracker.entries()) {
    if (now - data.lastAttempt > maxAge) {
      reservationTracker.delete(key);
    }
  }

  for (const [key, data] of fingerprintRisk.entries()) {
    if (now - data.lastUpdate > maxAge) {
      fingerprintRisk.delete(key);
    }
  }
}

// Start cleanup interval
setInterval(cleanupTrackers, 10 * 60 * 1000); // Every 10 minutes
