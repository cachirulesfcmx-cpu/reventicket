/**
 * Fee calculation system for the marketplace
 * Supports configurable service fees, processing fees, and insurance
 */

// Simple fee rate from environment variable
const DEFAULT_SIMPLE_FEE_RATE = 0.15; // 15%
const MIN_FEE_RATE = 0.00;
const MAX_FEE_RATE = 0.50; // 50% max

/**
 * Get the fee rate from environment variable or default
 * FEE_RATE should be a decimal like 0.15 for 15%
 */
export function getFeeRate(): number {
  const envRate = process.env.FEE_RATE;
  
  if (!envRate) {
    return DEFAULT_SIMPLE_FEE_RATE;
  }
  
  const parsed = parseFloat(envRate);
  
  if (isNaN(parsed)) {
    console.warn(`Invalid FEE_RATE "${envRate}", using default ${DEFAULT_SIMPLE_FEE_RATE}`);
    return DEFAULT_SIMPLE_FEE_RATE;
  }
  
  if (parsed < MIN_FEE_RATE || parsed > MAX_FEE_RATE) {
    console.warn(`FEE_RATE ${parsed} out of range [${MIN_FEE_RATE}, ${MAX_FEE_RATE}], clamping`);
    return Math.max(MIN_FEE_RATE, Math.min(MAX_FEE_RATE, parsed));
  }
  
  return parsed;
}

/**
 * Calculate fees from ticket price using server fee rate
 * Returns values in same unit as input (e.g., if price is decimal, result is decimal)
 */
export function calculateServerFees(ticketPrice: number, feeRate?: number): {
  ticketPrice: number;
  fees: number;
  totalAmount: number;
  feeRateUsed: number;
} {
  const rate = feeRate ?? getFeeRate();
  const fees = Math.round(ticketPrice * rate * 100) / 100; // Round to 2 decimals
  const totalAmount = Math.round((ticketPrice + fees) * 100) / 100;
  
  return {
    ticketPrice,
    fees,
    totalAmount,
    feeRateUsed: rate
  };
}

export interface FeeConfig {
  serviceFeePercent: number;      // Platform service fee (%)
  serviceFeeMin: number;          // Minimum service fee (MXN)
  serviceFeeMax: number;          // Maximum service fee (MXN)
  processingFeePercent: number;   // Payment processing fee (%)
  processingFeeFixed: number;     // Fixed processing fee (MXN)
  insurancePercent: number;       // Cancellation insurance (%)
  insuranceEnabled: boolean;      // Whether insurance is available
}

export interface FeeBreakdown {
  subtotal: number;
  serviceFee: number;
  processingFee: number;
  insurance: number;
  total: number;
  currency: string;
}

// Default fee configuration
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  serviceFeePercent: 15,      // 15% service fee
  serviceFeeMin: 50,          // Minimum $50 MXN
  serviceFeeMax: 2000,        // Maximum $2000 MXN
  processingFeePercent: 3.6,  // 3.6% payment processing
  processingFeeFixed: 5,      // $5 MXN fixed
  insurancePercent: 18,       // 18% cancellation insurance
  insuranceEnabled: true
};

// Category-specific overrides
export const CATEGORY_FEE_OVERRIDES: Record<string, Partial<FeeConfig>> = {
  'f1': {
    serviceFeePercent: 18,    // Higher fee for F1 events
    serviceFeeMax: 5000
  },
  'vip': {
    serviceFeePercent: 20,    // Higher fee for VIP tickets
    serviceFeeMax: 10000
  }
};

export function calculateFees(
  ticketPrice: number,
  quantity: number,
  options: {
    includeInsurance?: boolean;
    category?: string;
    customConfig?: Partial<FeeConfig>;
  } = {}
): FeeBreakdown {
  // Merge configs
  let config = { ...DEFAULT_FEE_CONFIG };
  
  if (options.category && CATEGORY_FEE_OVERRIDES[options.category]) {
    config = { ...config, ...CATEGORY_FEE_OVERRIDES[options.category] };
  }
  
  if (options.customConfig) {
    config = { ...config, ...options.customConfig };
  }

  const subtotal = ticketPrice * quantity;
  
  // Calculate service fee
  let serviceFee = subtotal * (config.serviceFeePercent / 100);
  serviceFee = Math.max(config.serviceFeeMin, Math.min(config.serviceFeeMax, serviceFee));
  
  // Calculate processing fee
  const processingFee = (subtotal + serviceFee) * (config.processingFeePercent / 100) + config.processingFeeFixed;
  
  // Calculate insurance (optional)
  const insurance = options.includeInsurance && config.insuranceEnabled
    ? subtotal * (config.insurancePercent / 100)
    : 0;
  
  // Round all values to 2 decimal places
  const roundedServiceFee = Math.round(serviceFee * 100) / 100;
  const roundedProcessingFee = Math.round(processingFee * 100) / 100;
  const roundedInsurance = Math.round(insurance * 100) / 100;
  const total = subtotal + roundedServiceFee + roundedProcessingFee + roundedInsurance;

  return {
    subtotal,
    serviceFee: roundedServiceFee,
    processingFee: roundedProcessingFee,
    insurance: roundedInsurance,
    total: Math.round(total * 100) / 100,
    currency: 'MXN'
  };
}

export function formatFeeBreakdown(fees: FeeBreakdown): string[] {
  const lines: string[] = [
    `Subtotal: $${fees.subtotal.toLocaleString('es-MX')} ${fees.currency}`,
    `Cargo por servicio: $${fees.serviceFee.toLocaleString('es-MX')} ${fees.currency}`,
    `Cargo por procesamiento: $${fees.processingFee.toLocaleString('es-MX')} ${fees.currency}`,
  ];
  
  if (fees.insurance > 0) {
    lines.push(`Seguro de cancelación: $${fees.insurance.toLocaleString('es-MX')} ${fees.currency}`);
  }
  
  lines.push(`Total: $${fees.total.toLocaleString('es-MX')} ${fees.currency}`);
  
  return lines;
}

// Dynamic pricing factors
export interface DynamicPricingFactors {
  demandMultiplier: number;      // Based on sales velocity
  scarcityMultiplier: number;    // Based on remaining inventory
  timeMultiplier: number;        // Based on time to event
  basePrice: number;
}

export function calculateDynamicPrice(
  basePrice: number,
  factors: Partial<DynamicPricingFactors>,
  limits: { min: number; max: number }
): number {
  const demandMult = factors.demandMultiplier ?? 1.0;
  const scarcityMult = factors.scarcityMultiplier ?? 1.0;
  const timeMult = factors.timeMultiplier ?? 1.0;

  let adjustedPrice = basePrice * demandMult * scarcityMult * timeMult;
  
  // Apply limits
  adjustedPrice = Math.max(limits.min, Math.min(limits.max, adjustedPrice));
  
  // Round to nearest 10 MXN
  return Math.round(adjustedPrice / 10) * 10;
}

export function getDemandMultiplier(salesPerHour: number, avgSalesPerHour: number): number {
  if (avgSalesPerHour === 0) return 1.0;
  const ratio = salesPerHour / avgSalesPerHour;
  
  if (ratio > 3) return 1.25;      // Very high demand
  if (ratio > 2) return 1.15;      // High demand
  if (ratio > 1.5) return 1.08;    // Above average
  if (ratio < 0.3) return 0.92;    // Low demand
  if (ratio < 0.5) return 0.95;    // Below average
  return 1.0;
}

export function getScarcityMultiplier(availablePercent: number): number {
  if (availablePercent < 5) return 1.30;   // Almost sold out
  if (availablePercent < 10) return 1.20;  // Very scarce
  if (availablePercent < 20) return 1.10;  // Scarce
  if (availablePercent > 80) return 0.95;  // Lots available
  return 1.0;
}

export function getTimeMultiplier(daysToEvent: number): number {
  if (daysToEvent < 1) return 1.25;    // Day of event
  if (daysToEvent < 3) return 1.15;    // Very soon
  if (daysToEvent < 7) return 1.08;    // Within a week
  if (daysToEvent > 60) return 0.95;   // Far away
  return 1.0;
}
