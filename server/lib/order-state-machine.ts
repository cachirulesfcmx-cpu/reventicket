export type OrderStatus = 
  | 'pending' 
  | 'reserved' 
  | 'awaiting_payment'
  | 'paid' 
  | 'cancelled' 
  | 'expired'
  | 'failed'
  | 'refunded';

export type ActorType = 'user' | 'admin' | 'system';

const VALID_TRANSITIONS: Record<OrderStatus, Partial<Record<OrderStatus, ActorType[]>>> = {
  pending: {
    reserved: ['system'],
    cancelled: ['user', 'admin', 'system'],
  },
  reserved: {
    paid: ['admin'],
    cancelled: ['user', 'admin'],
    expired: ['system'],
    awaiting_payment: ['system'],
  },
  awaiting_payment: {
    paid: ['admin'],
    cancelled: ['user', 'admin'],
    expired: ['system'],
  },
  paid: {
    refunded: ['admin'],
  },
  cancelled: {},
  expired: {},
  failed: {},
  refunded: {},
};

export interface TransitionResult {
  allowed: boolean;
  error?: string;
}

export function assertTransitionAllowed(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
  actor: ActorType
): TransitionResult {
  if (fromStatus === toStatus) {
    return { allowed: true };
  }
  
  const transitions = VALID_TRANSITIONS[fromStatus];
  if (!transitions) {
    return { 
      allowed: false, 
      error: `Estado "${fromStatus}" no reconocido` 
    };
  }
  
  const allowedActors = transitions[toStatus];
  if (!allowedActors) {
    return { 
      allowed: false, 
      error: `Transición de "${fromStatus}" a "${toStatus}" no permitida` 
    };
  }
  
  if (!allowedActors.includes(actor)) {
    return { 
      allowed: false, 
      error: `Actor "${actor}" no puede realizar transición de "${fromStatus}" a "${toStatus}"` 
    };
  }
  
  return { allowed: true };
}

export function isTerminalState(status: OrderStatus): boolean {
  return ['paid', 'cancelled', 'expired', 'refunded'].includes(status);
}

export function canUserCancel(status: OrderStatus): boolean {
  return ['pending', 'reserved', 'awaiting_payment'].includes(status);
}

export function canConfirmPayment(status: OrderStatus): boolean {
  return ['reserved', 'awaiting_payment'].includes(status);
}
