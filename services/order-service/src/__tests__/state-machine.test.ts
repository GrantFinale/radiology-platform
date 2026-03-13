import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  OrderStatus,
  isValidTransition,
  getAllowedTransitions,
  isTerminalStatus,
} from '../utils/state-machine';

describe('OrderStatus State Machine', () => {
  describe('isValidTransition', () => {
    it('allows RECEIVED -> DOCUMENT_PROCESSING', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.DOCUMENT_PROCESSING), true);
    });

    it('allows RECEIVED -> INTERPRETED', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.INTERPRETED), true);
    });

    it('allows RECEIVED -> ERROR', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.ERROR), true);
    });

    it('allows DOCUMENT_PROCESSING -> INTERPRETED', () => {
      assert.equal(isValidTransition(OrderStatus.DOCUMENT_PROCESSING, OrderStatus.INTERPRETED), true);
    });

    it('allows DOCUMENT_PROCESSING -> ERROR', () => {
      assert.equal(isValidTransition(OrderStatus.DOCUMENT_PROCESSING, OrderStatus.ERROR), true);
    });

    it('allows INTERPRETED -> NORMALIZED', () => {
      assert.equal(isValidTransition(OrderStatus.INTERPRETED, OrderStatus.NORMALIZED), true);
    });

    it('allows INTERPRETED -> REVIEW_REQUIRED', () => {
      assert.equal(isValidTransition(OrderStatus.INTERPRETED, OrderStatus.REVIEW_REQUIRED), true);
    });

    it('allows INTERPRETED -> ERROR', () => {
      assert.equal(isValidTransition(OrderStatus.INTERPRETED, OrderStatus.ERROR), true);
    });

    it('allows NORMALIZED -> VALIDATED', () => {
      assert.equal(isValidTransition(OrderStatus.NORMALIZED, OrderStatus.VALIDATED), true);
    });

    it('allows NORMALIZED -> REVIEW_REQUIRED', () => {
      assert.equal(isValidTransition(OrderStatus.NORMALIZED, OrderStatus.REVIEW_REQUIRED), true);
    });

    it('allows NORMALIZED -> ERROR', () => {
      assert.equal(isValidTransition(OrderStatus.NORMALIZED, OrderStatus.ERROR), true);
    });

    it('allows REVIEW_REQUIRED -> NORMALIZED', () => {
      assert.equal(isValidTransition(OrderStatus.REVIEW_REQUIRED, OrderStatus.NORMALIZED), true);
    });

    it('allows REVIEW_REQUIRED -> REJECTED', () => {
      assert.equal(isValidTransition(OrderStatus.REVIEW_REQUIRED, OrderStatus.REJECTED), true);
    });

    it('allows VALIDATED -> SCHEDULED', () => {
      assert.equal(isValidTransition(OrderStatus.VALIDATED, OrderStatus.SCHEDULED), true);
    });

    it('allows VALIDATED -> REVIEW_REQUIRED', () => {
      assert.equal(isValidTransition(OrderStatus.VALIDATED, OrderStatus.REVIEW_REQUIRED), true);
    });

    it('allows SCHEDULED -> COMPLETED', () => {
      assert.equal(isValidTransition(OrderStatus.SCHEDULED, OrderStatus.COMPLETED), true);
    });

    it('allows SCHEDULED -> ERROR', () => {
      assert.equal(isValidTransition(OrderStatus.SCHEDULED, OrderStatus.ERROR), true);
    });

    // Invalid transitions
    it('rejects RECEIVED -> VALIDATED (skipping steps)', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.VALIDATED), false);
    });

    it('rejects RECEIVED -> COMPLETED (skipping steps)', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.COMPLETED), false);
    });

    it('rejects RECEIVED -> SCHEDULED (skipping steps)', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.SCHEDULED), false);
    });

    it('rejects DOCUMENT_PROCESSING -> VALIDATED (skipping steps)', () => {
      assert.equal(isValidTransition(OrderStatus.DOCUMENT_PROCESSING, OrderStatus.VALIDATED), false);
    });

    it('rejects COMPLETED -> RECEIVED (backwards)', () => {
      assert.equal(isValidTransition(OrderStatus.COMPLETED, OrderStatus.RECEIVED), false);
    });

    it('rejects REJECTED -> RECEIVED (backwards from terminal)', () => {
      assert.equal(isValidTransition(OrderStatus.REJECTED, OrderStatus.RECEIVED), false);
    });

    it('rejects ERROR -> RECEIVED (backwards from terminal)', () => {
      assert.equal(isValidTransition(OrderStatus.ERROR, OrderStatus.RECEIVED), false);
    });

    it('rejects COMPLETED -> SCHEDULED (backwards from terminal)', () => {
      assert.equal(isValidTransition(OrderStatus.COMPLETED, OrderStatus.SCHEDULED), false);
    });

    it('rejects self-transitions', () => {
      assert.equal(isValidTransition(OrderStatus.RECEIVED, OrderStatus.RECEIVED), false);
      assert.equal(isValidTransition(OrderStatus.VALIDATED, OrderStatus.VALIDATED), false);
    });

    it('rejects VALIDATED -> ERROR (not in allowed list)', () => {
      assert.equal(isValidTransition(OrderStatus.VALIDATED, OrderStatus.ERROR), false);
    });
  });

  describe('getAllowedTransitions', () => {
    it('returns correct transitions from RECEIVED', () => {
      const allowed = getAllowedTransitions(OrderStatus.RECEIVED);
      assert.deepEqual(allowed, [
        OrderStatus.DOCUMENT_PROCESSING,
        OrderStatus.INTERPRETED,
        OrderStatus.ERROR,
      ]);
    });

    it('returns correct transitions from DOCUMENT_PROCESSING', () => {
      const allowed = getAllowedTransitions(OrderStatus.DOCUMENT_PROCESSING);
      assert.deepEqual(allowed, [
        OrderStatus.INTERPRETED,
        OrderStatus.ERROR,
      ]);
    });

    it('returns correct transitions from INTERPRETED', () => {
      const allowed = getAllowedTransitions(OrderStatus.INTERPRETED);
      assert.deepEqual(allowed, [
        OrderStatus.NORMALIZED,
        OrderStatus.REVIEW_REQUIRED,
        OrderStatus.ERROR,
      ]);
    });

    it('returns correct transitions from NORMALIZED', () => {
      const allowed = getAllowedTransitions(OrderStatus.NORMALIZED);
      assert.deepEqual(allowed, [
        OrderStatus.VALIDATED,
        OrderStatus.REVIEW_REQUIRED,
        OrderStatus.ERROR,
      ]);
    });

    it('returns correct transitions from REVIEW_REQUIRED', () => {
      const allowed = getAllowedTransitions(OrderStatus.REVIEW_REQUIRED);
      assert.deepEqual(allowed, [
        OrderStatus.NORMALIZED,
        OrderStatus.REJECTED,
      ]);
    });

    it('returns correct transitions from VALIDATED', () => {
      const allowed = getAllowedTransitions(OrderStatus.VALIDATED);
      assert.deepEqual(allowed, [
        OrderStatus.SCHEDULED,
        OrderStatus.REVIEW_REQUIRED,
      ]);
    });

    it('returns correct transitions from SCHEDULED', () => {
      const allowed = getAllowedTransitions(OrderStatus.SCHEDULED);
      assert.deepEqual(allowed, [
        OrderStatus.COMPLETED,
        OrderStatus.ERROR,
      ]);
    });

    it('returns empty array for COMPLETED (terminal)', () => {
      assert.deepEqual(getAllowedTransitions(OrderStatus.COMPLETED), []);
    });

    it('returns empty array for REJECTED (terminal)', () => {
      assert.deepEqual(getAllowedTransitions(OrderStatus.REJECTED), []);
    });

    it('returns empty array for ERROR (terminal)', () => {
      assert.deepEqual(getAllowedTransitions(OrderStatus.ERROR), []);
    });
  });

  describe('isTerminalStatus', () => {
    it('identifies COMPLETED as terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.COMPLETED), true);
    });

    it('identifies REJECTED as terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.REJECTED), true);
    });

    it('identifies ERROR as terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.ERROR), true);
    });

    it('identifies RECEIVED as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.RECEIVED), false);
    });

    it('identifies DOCUMENT_PROCESSING as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.DOCUMENT_PROCESSING), false);
    });

    it('identifies INTERPRETED as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.INTERPRETED), false);
    });

    it('identifies NORMALIZED as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.NORMALIZED), false);
    });

    it('identifies REVIEW_REQUIRED as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.REVIEW_REQUIRED), false);
    });

    it('identifies VALIDATED as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.VALIDATED), false);
    });

    it('identifies SCHEDULED as non-terminal', () => {
      assert.equal(isTerminalStatus(OrderStatus.SCHEDULED), false);
    });
  });
});
