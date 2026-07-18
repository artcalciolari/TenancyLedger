import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  DiffCoverageError,
  diffCoverageExitCode,
  evaluateDiffCoverage,
  formatDiffCoverageReport,
  resolveBaseRef,
  toRepositoryRelativePath,
} from './diff-coverage.mjs';

const COLLECT_COVERAGE_FROM = [
  '**/*.ts',
  '!**/*.spec.ts',
  '!**/*.module.ts',
  '!**/*.controller.ts',
  '!**/*.dto.ts',
  '!**/*.typeorm.repository.ts',
  '!database/**',
  '!main.ts',
  '!app.setup.ts',
  '!infrastructure/storage.module.ts',
];

const COVERED_FILE = 'backend/src/contexts/example/example.service.ts';

function sourceDiff(file = COVERED_FILE, range = '+1,3') {
  return [
    `diff --git a/${file} b/${file}`,
    'index 1111111..2222222 100644',
    `--- a/${file}`,
    `+++ b/${file}`,
    `@@ -1,0 ${range} @@`,
    '+changed source',
    '',
  ].join('\n');
}

function coverageEntry({ lineHits = 1, functionHits = 1, branchHits = [1, 1] } = {}) {
  return {
    path: COVERED_FILE,
    statementMap: {
      0: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
    },
    fnMap: {
      0: {
        name: 'calculate',
        decl: { start: { line: 1, column: 0 }, end: { line: 1, column: 20 } },
        loc: { start: { line: 1, column: 0 }, end: { line: 3, column: 1 } },
      },
    },
    branchMap: {
      0: {
        type: 'if',
        loc: { start: { line: 3, column: 0 }, end: { line: 3, column: 20 } },
        locations: branchHits.map(() => ({
          start: { line: 3, column: 0 },
          end: { line: 3, column: 20 },
        })),
      },
    },
    s: { 0: lineHits },
    f: { 0: functionHits },
    b: { 0: branchHits },
  };
}

function evaluate({
  diffText = sourceDiff(),
  coveragePath = `C:\\repo\\${COVERED_FILE.replaceAll('/', '\\')}`,
  coverage = coverageEntry(),
  repositoryRoot = 'C:\\repo',
} = {}) {
  return evaluateDiffCoverage({
    diffText,
    coverageMap: coveragePath ? { [coveragePath]: coverage } : {},
    repositoryRoot,
    collectCoverageFrom: COLLECT_COVERAGE_FROM,
  });
}

describe('changed-code coverage evaluation', () => {
  test('passes a covered production change across lines, functions, and branches', () => {
    const result = evaluate();

    assert.equal(result.passed, true);
    assert.equal(diffCoverageExitCode(result), 0);
    assert.deepEqual(
      Object.fromEntries(
        Object.entries(result.summary).map(([metric, value]) => [
          metric,
          { covered: value.covered, total: value.total },
        ]),
      ),
      {
        lines: { covered: 1, total: 1 },
        functions: { covered: 1, total: 1 },
        branches: { covered: 2, total: 2 },
      },
    );
  });

  test('fails uncovered lines, functions, and branch outcomes with actionable locations', () => {
    const result = evaluate({
      coverage: coverageEntry({ lineHits: 0, functionHits: 0, branchHits: [1, 0] }),
    });
    const output = formatDiffCoverageReport(result);

    assert.equal(result.passed, false);
    assert.equal(diffCoverageExitCode(result), 1);
    assert.deepEqual(result.thresholdFailures, ['lines', 'functions', 'branches']);
    assert.match(output, new RegExp(`${COVERED_FILE}:2 line`));
    assert.match(output, new RegExp(`${COVERED_FILE}:1 function`));
    assert.match(output, new RegExp(`${COVERED_FILE}:3 if branch outcome 2`));
    assert.match(output, /Diff coverage result: FAIL/);
  });

  test('accepts exactly 95% branch coverage and rejects anything lower', () => {
    const exactlyNinetyFive = evaluate({
      coverage: coverageEntry({ branchHits: [...Array(19).fill(1), 0] }),
    });
    const belowNinetyFive = evaluate({
      coverage: coverageEntry({ branchHits: [...Array(18).fill(1), 0, 0] }),
    });

    assert.equal(exactlyNinetyFive.summary.branches.covered, 19);
    assert.equal(exactlyNinetyFive.summary.branches.total, 20);
    assert.equal(exactlyNinetyFive.passed, true);
    assert.equal(belowNinetyFive.passed, false);
    assert.deepEqual(belowNinetyFive.thresholdFailures, ['branches']);
  });

  test('normalizes absolute Windows and POSIX coverage paths against Git paths', () => {
    assert.equal(
      toRepositoryRelativePath(
        'C:\\WORK\\Repo\\backend\\src\\contexts\\example\\example.service.ts',
        'c:\\work\\repo',
      ),
      COVERED_FILE,
    );
    assert.equal(
      toRepositoryRelativePath(
        '/home/runner/work/repo/backend/src/contexts/example/example.service.ts',
        '/home/runner/work/repo',
      ),
      COVERED_FILE,
    );

    const windows = evaluate({
      coveragePath: 'C:\\WORK\\Repo\\backend\\src\\contexts\\example\\example.service.ts',
      repositoryRoot: 'c:\\work\\repo',
    });
    const posix = evaluate({
      coveragePath: '/home/runner/work/repo/backend/src/contexts/example/example.service.ts',
      repositoryRoot: '/home/runner/work/repo',
    });
    assert.equal(windows.passed, true);
    assert.equal(posix.passed, true);
  });

  test('reports and classifies a changed file excluded from the unit universe', () => {
    const controller = 'backend/src/contexts/example/example.controller.ts';
    const result = evaluate({
      diffText: sourceDiff(controller, '+7,2'),
      coveragePath: null,
    });
    const output = formatDiffCoverageReport(result);

    assert.equal(result.passed, true);
    assert.equal(result.files[0].classification, 'excluded');
    assert.match(result.files[0].reason, /!\*\*\/\*\.controller\.ts/);
    assert.match(output, new RegExp(`EXCLUDED ${controller}`));
    assert.match(output, /not counted by the unit diff gate/);
  });

  test('fails loudly when an included changed file is absent from the coverage map', () => {
    const result = evaluate({ coveragePath: null });
    const output = formatDiffCoverageReport(result);

    assert.equal(result.passed, false);
    assert.deepEqual(result.missingCoverageFiles, [COVERED_FILE]);
    assert.match(output, /included in unit coverage but absent from coverage-final\.json/);
    assert.match(output, /Run npm run test:ci immediately/);
  });

  test('passes explicitly when backend/src has no diff', () => {
    const result = evaluate({ diffText: '', coveragePath: null });
    const output = formatDiffCoverageReport(result);

    assert.equal(result.passed, true);
    assert.match(output, /No backend\/src diff .* gate passes/);
    assert.match(output, /Diff coverage result: PASS/);
  });
});

describe('base ref resolution', () => {
  const sha = 'a'.repeat(40);

  test('uses origin/main as the local default when no base is supplied', () => {
    const calls = [];
    const result = resolveBaseRef({
      requestedBase: undefined,
      requestedSource: undefined,
      fallbackBase: undefined,
      isCi: false,
      git: (arguments_) => {
        calls.push(arguments_);
        return `${sha}\n`;
      },
    });

    assert.equal(result.label, 'origin/main');
    assert.equal(result.source, 'local default');
    assert.match(calls[0].at(-1), /^origin\/main/);
  });

  test('rejects an all-zero CI SHA and uses the configured visible fallback', () => {
    const result = resolveBaseRef({
      requestedBase: '0'.repeat(40),
      requestedSource: 'DIFF_COVERAGE_BASE',
      fallbackBase: 'HEAD^',
      isCi: true,
      git: () => `${sha}\n`,
    });

    assert.equal(result.label, 'HEAD^');
    assert.match(result.warnings.join('\n'), /all-zero SHA/);
    assert.match(result.warnings.join('\n'), /visible fallback base/);
  });

  test('falls back after an unavailable requested base and fails closed without any commit', () => {
    const fallbackResult = resolveBaseRef({
      requestedBase: 'missing-base',
      requestedSource: 'command-line base',
      fallbackBase: 'HEAD^',
      isCi: true,
      git: (arguments_) => {
        if (arguments_.at(-1).startsWith('missing-base')) {
          throw new DiffCoverageError('unknown revision');
        }
        return `${sha}\n`;
      },
    });
    assert.equal(fallbackResult.label, 'HEAD^');
    assert.match(fallbackResult.warnings.join('\n'), /missing-base .* unavailable/);

    assert.throws(
      () =>
        resolveBaseRef({
          requestedBase: undefined,
          fallbackBase: undefined,
          isCi: true,
          git: () => {
            throw new DiffCoverageError('no parent');
          },
        }),
      /No safe base commit is available/,
    );
  });
});
