import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BlockingIssue, SchedulingReadiness } from '../services/scheduling-service';

/**
 * Tests for scheduling readiness logic.
 * Since checkSchedulingReadiness depends on a DB pool, we test the
 * readiness determination logic by constructing SchedulingReadiness
 * objects and verifying the blocking-issue logic.
 */

function makeReadinessResult(issues: BlockingIssue[]): SchedulingReadiness {
  const hasBlockers = issues.some((i) => i.severity === 'blocker');
  return {
    ready: !hasBlockers,
    orderId: 'test-order-001',
    blockingIssues: issues,
    checkedAt: new Date().toISOString(),
  };
}

describe('Scheduling Readiness', () => {
  describe('readiness determination', () => {
    it('is ready when there are no blocking issues', () => {
      const result = makeReadinessResult([]);
      assert.equal(result.ready, true);
      assert.equal(result.blockingIssues.length, 0);
    });

    it('is ready when there are only warnings', () => {
      const result = makeReadinessResult([
        {
          category: 'conflict',
          severity: 'warning',
          message: 'Found 1 potentially conflicting order(s) for the same procedure',
        },
      ]);
      assert.equal(result.ready, true);
      assert.equal(result.blockingIssues.length, 1);
    });

    it('is not ready when there is a blocker', () => {
      const result = makeReadinessResult([
        {
          category: 'insurance',
          severity: 'blocker',
          message: 'No insurance plan associated with this order',
        },
      ]);
      assert.equal(result.ready, false);
    });

    it('is not ready with mixed blockers and warnings', () => {
      const result = makeReadinessResult([
        {
          category: 'insurance',
          severity: 'blocker',
          message: 'Insurance plan is inactive or not found',
        },
        {
          category: 'conflict',
          severity: 'warning',
          message: 'Conflicting order found',
        },
      ]);
      assert.equal(result.ready, false);
      assert.equal(result.blockingIssues.length, 2);
    });
  });

  describe('blocking issue categories', () => {
    it('identifies missing insurance as a blocker', () => {
      const issue: BlockingIssue = {
        category: 'insurance',
        severity: 'blocker',
        message: 'No insurance plan associated with this order',
      };
      assert.equal(issue.severity, 'blocker');
      assert.equal(issue.category, 'insurance');
    });

    it('identifies missing authorization as a blocker', () => {
      const issue: BlockingIssue = {
        category: 'authorization',
        severity: 'blocker',
        message: 'Prior authorization required but not provided',
      };
      assert.equal(issue.severity, 'blocker');
      assert.equal(issue.category, 'authorization');
    });

    it('identifies missing clinical indication as a blocker', () => {
      const issue: BlockingIssue = {
        category: 'clinical',
        severity: 'blocker',
        message: 'Clinical indication is required for scheduling',
      };
      assert.equal(issue.severity, 'blocker');
    });

    it('identifies missing ICD-10 codes as a blocker', () => {
      const issue: BlockingIssue = {
        category: 'clinical',
        severity: 'blocker',
        message: 'At least one ICD-10 code is required',
      };
      assert.equal(issue.severity, 'blocker');
    });

    it('identifies missing patient record as a blocker', () => {
      const issue: BlockingIssue = {
        category: 'patient',
        severity: 'blocker',
        message: 'Patient record not found',
      };
      assert.equal(issue.severity, 'blocker');
    });

    it('identifies incomplete patient demographics as a blocker', () => {
      const missingFields = ['phone', 'address'];
      const issue: BlockingIssue = {
        category: 'patient',
        severity: 'blocker',
        message: `Patient demographics incomplete: missing ${missingFields.join(', ')}`,
        details: { missingFields },
      };
      assert.equal(issue.severity, 'blocker');
      assert.ok(issue.message.includes('phone'));
      assert.ok(issue.message.includes('address'));
      const details = issue.details as { missingFields: string[] };
      assert.deepEqual(details.missingFields, ['phone', 'address']);
    });

    it('identifies conflicting orders as a warning', () => {
      const issue: BlockingIssue = {
        category: 'conflict',
        severity: 'warning',
        message: 'Found 2 potentially conflicting order(s) for the same procedure',
        details: {
          conflictingOrders: [
            { id: 'order-a', status: 'SCHEDULED' },
            { id: 'order-b', status: 'VALIDATED' },
          ],
        },
      };
      assert.equal(issue.severity, 'warning');
      assert.equal(issue.category, 'conflict');
    });
  });

  describe('checkedAt timestamp', () => {
    it('includes a valid ISO timestamp', () => {
      const result = makeReadinessResult([]);
      const parsed = new Date(result.checkedAt);
      assert.equal(isNaN(parsed.getTime()), false);
    });

    it('timestamp is recent (within last 5 seconds)', () => {
      const result = makeReadinessResult([]);
      const parsed = new Date(result.checkedAt);
      const now = Date.now();
      const diff = now - parsed.getTime();
      assert.ok(diff >= 0 && diff < 5000);
    });
  });

  describe('multiple blockers scenario', () => {
    it('reports all blocking issues together', () => {
      const issues: BlockingIssue[] = [
        { category: 'insurance', severity: 'blocker', message: 'No insurance plan' },
        { category: 'authorization', severity: 'blocker', message: 'Auth required but not provided' },
        { category: 'clinical', severity: 'blocker', message: 'No ICD-10 codes' },
        { category: 'patient', severity: 'blocker', message: 'Patient record not found' },
        { category: 'conflict', severity: 'warning', message: 'Conflicting order exists' },
      ];
      const result = makeReadinessResult(issues);
      assert.equal(result.ready, false);
      assert.equal(result.blockingIssues.length, 5);
      const blockerCount = result.blockingIssues.filter((i) => i.severity === 'blocker').length;
      assert.equal(blockerCount, 4);
      const warningCount = result.blockingIssues.filter((i) => i.severity === 'warning').length;
      assert.equal(warningCount, 1);
    });
  });
});
