export enum OrderStatus {
  RECEIVED = 'RECEIVED',
  DOCUMENT_PROCESSING = 'DOCUMENT_PROCESSING',
  INTERPRETED = 'INTERPRETED',
  NORMALIZED = 'NORMALIZED',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  VALIDATED = 'VALIDATED',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  ERROR = 'ERROR',
}

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.RECEIVED]: [
    OrderStatus.DOCUMENT_PROCESSING,
    OrderStatus.INTERPRETED,
    OrderStatus.ERROR,
  ],
  [OrderStatus.DOCUMENT_PROCESSING]: [
    OrderStatus.INTERPRETED,
    OrderStatus.ERROR,
  ],
  [OrderStatus.INTERPRETED]: [
    OrderStatus.NORMALIZED,
    OrderStatus.REVIEW_REQUIRED,
    OrderStatus.ERROR,
  ],
  [OrderStatus.NORMALIZED]: [
    OrderStatus.VALIDATED,
    OrderStatus.REVIEW_REQUIRED,
    OrderStatus.ERROR,
  ],
  [OrderStatus.REVIEW_REQUIRED]: [
    OrderStatus.NORMALIZED,
    OrderStatus.REJECTED,
  ],
  [OrderStatus.VALIDATED]: [
    OrderStatus.SCHEDULED,
    OrderStatus.REVIEW_REQUIRED,
  ],
  [OrderStatus.SCHEDULED]: [
    OrderStatus.COMPLETED,
    OrderStatus.ERROR,
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.ERROR]: [],
};

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed !== undefined && allowed.includes(to);
}

export function getAllowedTransitions(status: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

export function isTerminalStatus(status: OrderStatus): boolean {
  const allowed = ALLOWED_TRANSITIONS[status];
  return allowed !== undefined && allowed.length === 0;
}
