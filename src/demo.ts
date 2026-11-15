import { buildContext, renderContext, type Evidence } from './index.js';

const documents: Evidence[] = [
  { id: 'incident', source: 'CloudWatch incident summary', tenantId: 'engineering', updatedAt: '2026-11-14', authority: 0.9,
    text: 'SQS consumer Lambda failed with Aurora database connection timeout after deployment.' },
  { id: 'runbook', source: 'Production runbook', tenantId: 'engineering', updatedAt: '2026-11-01', authority: 1,
    text: 'Aurora connection timeout troubleshooting: inspect database connections, concurrency and pool configuration.' },
  { id: 'frontend', source: 'UI notes', tenantId: 'engineering', updatedAt: '2026-11-14', authority: 0.8,
    text: 'React dashboard typography and spacing.' },
  { id: 'private', source: 'Another tenant', tenantId: 'another-team', updatedAt: '2026-11-14', authority: 1,
    text: 'Aurora connection timeout confidential root cause.' }
];

const result = buildContext({
  task: 'Investigate Lambda Aurora connection timeout',
  documents,
  tenantId: 'engineering',
  budgetTokens: 120,
  now: new Date('2026-11-15T00:00:00Z')
});
console.table(result.selected.map(d => ({ id: d.id, score: d.score.toFixed(3), tokens: d.estimatedTokens })));
console.log('Used approximate evidence tokens:', result.usedTokens);
console.log('Exclusions:', result.excluded);
console.log('\nSelected context:\n' + renderContext(result.selected));
