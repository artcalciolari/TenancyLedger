import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DIFF_COVERAGE_THRESHOLDS = Object.freeze({
  lines: 100,
  functions: 100,
  branches: 95,
});

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, '..', '..');
const ZERO_SHA_PATTERN = /^0{7,64}$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40,64}$/i;

export class DiffCoverageError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = 'DiffCoverageError';
  }
}

function portablePath(value) {
  return path.posix.normalize(String(value).replaceAll('\\', '/'));
}

function isPortableAbsolute(value) {
  return value.startsWith('/') || /^[A-Za-z]:\//.test(value);
}

function isWindowsPath(value) {
  return /^[A-Za-z]:\//.test(value);
}

function comparisonValue(value, caseInsensitive) {
  return caseInsensitive ? value.toLowerCase() : value;
}

export function toRepositoryRelativePath(filePath, repositoryRoot) {
  const normalizedFile = portablePath(filePath).replace(/^\.\//, '');
  const normalizedRoot = portablePath(repositoryRoot).replace(/\/$/, '');

  if (!isPortableAbsolute(normalizedFile)) {
    if (normalizedFile === 'src' || normalizedFile.startsWith('src/')) {
      return portablePath(`backend/${normalizedFile}`);
    }
    return normalizedFile;
  }

  const caseInsensitive = isWindowsPath(normalizedFile) || isWindowsPath(normalizedRoot);
  const comparableFile = comparisonValue(normalizedFile, caseInsensitive);
  const comparableRoot = comparisonValue(normalizedRoot, caseInsensitive);

  if (comparableFile === comparableRoot) return '';
  if (!comparableFile.startsWith(`${comparableRoot}/`)) return null;
  return normalizedFile.slice(normalizedRoot.length + 1);
}

function repositoryPathKey(filePath, repositoryRoot) {
  const normalized = portablePath(filePath);
  return isWindowsPath(portablePath(repositoryRoot)) ? normalized.toLowerCase() : normalized;
}

function globToRegExp(glob) {
  const normalized = portablePath(glob);
  let expression = '^';

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*') {
      if (normalized[index + 1] === '*') {
        if (normalized[index + 2] === '/') {
          expression += '(?:.*/)?';
          index += 2;
        } else {
          expression += '.*';
          index += 1;
        }
      } else {
        expression += '[^/]*';
      }
      continue;
    }
    if (character === '?') {
      expression += '[^/]';
      continue;
    }
    expression += character.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
  }

  return new RegExp(`${expression}$`);
}

export function createUnitCoverageClassifier(collectCoverageFrom) {
  if (!Array.isArray(collectCoverageFrom) || collectCoverageFrom.length === 0) {
    throw new DiffCoverageError(
      'backend/package.json must define jest.collectCoverageFrom for diff coverage classification.',
    );
  }

  const rules = collectCoverageFrom.map((rawPattern) => {
    const pattern = String(rawPattern);
    const excluded = pattern.startsWith('!');
    const glob = excluded ? pattern.slice(1) : pattern;
    return { excluded, pattern, matcher: globToRegExp(glob) };
  });

  return (repositoryRelativeFile) => {
    const normalizedFile = portablePath(repositoryRelativeFile);
    const sourcePrefix = 'backend/src/';
    if (!normalizedFile.startsWith(sourcePrefix)) {
      return {
        included: false,
        reason: 'outside backend/src',
      };
    }

    const sourceRelativeFile = normalizedFile.slice(sourcePrefix.length);
    let included = false;
    let matchedPattern = null;
    for (const rule of rules) {
      if (!rule.matcher.test(sourceRelativeFile)) continue;
      included = !rule.excluded;
      matchedPattern = rule.pattern;
    }

    if (included) return { included: true, matchedPattern };
    if (matchedPattern?.startsWith('!')) {
      return {
        included: false,
        matchedPattern,
        reason: `excluded by Jest collectCoverageFrom pattern ${JSON.stringify(matchedPattern)}`,
      };
    }
    return {
      included: false,
      matchedPattern,
      reason: 'not selected by Jest collectCoverageFrom',
    };
  };
}

function decodeGitQuotedPath(value) {
  const bytes = [];
  for (let index = 1; index < value.length - 1; index += 1) {
    if (value[index] !== '\\') {
      bytes.push(...Buffer.from(value[index]));
      continue;
    }

    const escape = value[index + 1];
    const octal = value.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 3;
      continue;
    }

    const escapedCharacters = {
      a: '\x07',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      v: '\v',
      '\\': '\\',
      '"': '"',
    };
    bytes.push(...Buffer.from(escapedCharacters[escape] ?? escape));
    index += 1;
  }
  return Buffer.from(bytes).toString('utf8');
}

function parseGitPath(rawPath) {
  const trimmed = rawPath.trim();
  if (trimmed === '/dev/null') return null;
  const decoded =
    trimmed.startsWith('"') && trimmed.endsWith('"') ? decodeGitQuotedPath(trimmed) : trimmed;
  return portablePath(decoded.replace(/^[ab]\//, ''));
}

export function parseUnifiedDiff(diffText) {
  const files = [];
  let current = null;
  let insideHunk = false;

  const finishCurrent = () => {
    if (!current) return;
    const filePath = current.newPath ?? current.renamedTo ?? current.oldPath;
    if (filePath) {
      files.push({
        path: filePath,
        changedLines: current.changedLines,
        deleted: current.newPath === null && current.oldPath !== null,
      });
    }
    current = null;
    insideHunk = false;
  };

  for (const line of String(diffText).split(/\r?\n/)) {
    if (line.startsWith('diff --git ')) {
      finishCurrent();
      current = {
        oldPath: undefined,
        newPath: undefined,
        renamedTo: undefined,
        changedLines: new Set(),
      };
      continue;
    }
    if (!current) continue;

    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (hunk) {
      insideHunk = true;
      const startLine = Number.parseInt(hunk[1], 10);
      const lineCount = hunk[2] === undefined ? 1 : Number.parseInt(hunk[2], 10);
      for (let offset = 0; offset < lineCount; offset += 1) {
        current.changedLines.add(startLine + offset);
      }
      continue;
    }
    if (insideHunk) continue;

    if (line.startsWith('--- ')) {
      current.oldPath = parseGitPath(line.slice(4));
    } else if (line.startsWith('+++ ')) {
      current.newPath = parseGitPath(line.slice(4));
    } else if (line.startsWith('rename to ')) {
      current.renamedTo = parseGitPath(line.slice('rename to '.length));
    }
  }

  finishCurrent();
  return files;
}

function isLocation(value) {
  return (
    value &&
    Number.isInteger(value.start?.line) &&
    Number.isInteger(value.end?.line) &&
    value.start.line > 0 &&
    value.end.line >= value.start.line
  );
}

function changedLinesInLocation(changedLines, location) {
  if (!isLocation(location)) return [];
  return [...changedLines].filter(
    (line) => line >= location.start.line && line <= location.end.line,
  );
}

function numericHitCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function emptyMetric() {
  return { covered: 0, total: 0, uncovered: [] };
}

function analyzeFileCoverage(filePath, changedLines, fileCoverage) {
  const metrics = {
    lines: emptyMetric(),
    functions: emptyMetric(),
    branches: emptyMetric(),
  };

  const lineHits = new Map();
  for (const [statementId, location] of Object.entries(fileCoverage.statementMap ?? {})) {
    for (const line of changedLinesInLocation(changedLines, location)) {
      const hits = numericHitCount(fileCoverage.s?.[statementId]);
      lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
    }
  }
  for (const [line, hits] of [...lineHits.entries()].sort(([left], [right]) => left - right)) {
    metrics.lines.total += 1;
    if (hits > 0) metrics.lines.covered += 1;
    else metrics.lines.uncovered.push({ file: filePath, line });
  }

  for (const [functionId, functionMetadata] of Object.entries(fileCoverage.fnMap ?? {})) {
    const declaration = isLocation(functionMetadata.decl)
      ? functionMetadata.decl
      : functionMetadata.loc;
    const touchedLines = changedLinesInLocation(changedLines, declaration);
    if (touchedLines.length === 0) continue;

    metrics.functions.total += 1;
    if (numericHitCount(fileCoverage.f?.[functionId]) > 0) {
      metrics.functions.covered += 1;
    } else {
      metrics.functions.uncovered.push({
        file: filePath,
        line: touchedLines[0],
        name: functionMetadata.name || '(anonymous)',
      });
    }
  }

  for (const [branchId, branchMetadata] of Object.entries(fileCoverage.branchMap ?? {})) {
    const locations = Array.isArray(branchMetadata.locations) ? branchMetadata.locations : [];
    const branchLocation = isLocation(branchMetadata.loc) ? branchMetadata.loc : locations[0];
    const touchedLines = changedLinesInLocation(changedLines, branchLocation);
    if (touchedLines.length === 0) continue;

    const hitCounts = Array.isArray(fileCoverage.b?.[branchId]) ? fileCoverage.b[branchId] : [];
    const outcomeCount = Math.max(locations.length, hitCounts.length);
    for (let outcome = 0; outcome < outcomeCount; outcome += 1) {
      metrics.branches.total += 1;
      if (numericHitCount(hitCounts[outcome]) > 0) {
        metrics.branches.covered += 1;
      } else {
        const outcomeLocation = locations[outcome];
        const outcomeLines = changedLinesInLocation(changedLines, outcomeLocation);
        metrics.branches.uncovered.push({
          file: filePath,
          line: outcomeLines[0] ?? touchedLines[0] ?? outcomeLocation?.start?.line,
          type: branchMetadata.type || 'branch',
          outcome: outcome + 1,
        });
      }
    }
  }

  return metrics;
}

function buildCoverageIndex(coverageMap, repositoryRoot) {
  if (!coverageMap || Array.isArray(coverageMap) || typeof coverageMap !== 'object') {
    throw new DiffCoverageError('coverage-final.json must contain an Istanbul coverage map.');
  }

  const index = new Map();
  let outsideRepository = 0;
  for (const [coveragePath, coverageData] of Object.entries(coverageMap)) {
    const candidates = [coveragePath, coverageData?.path].filter(Boolean);
    let repositoryRelative = null;
    for (const candidate of candidates) {
      repositoryRelative = toRepositoryRelativePath(candidate, repositoryRoot);
      if (repositoryRelative?.startsWith('backend/src/')) break;
    }

    if (!repositoryRelative?.startsWith('backend/src/')) {
      outsideRepository += 1;
      continue;
    }

    const key = repositoryPathKey(repositoryRelative, repositoryRoot);
    if (index.has(key)) {
      throw new DiffCoverageError(
        `coverage-final.json contains duplicate entries for ${repositoryRelative}.`,
      );
    }
    index.set(key, coverageData);
  }

  return { index, outsideRepository };
}

function addMetric(target, source) {
  target.covered += source.covered;
  target.total += source.total;
  target.uncovered.push(...source.uncovered);
}

function metricPercentage(metric) {
  if (metric.total === 0) return null;
  return (metric.covered / metric.total) * 100;
}

function metricPasses(metric, threshold) {
  const percentage = metricPercentage(metric);
  return percentage === null || percentage + Number.EPSILON >= threshold;
}

export function evaluateDiffCoverage({
  diffText,
  coverageMap,
  repositoryRoot,
  collectCoverageFrom,
  thresholds = DIFF_COVERAGE_THRESHOLDS,
}) {
  const changedFiles = parseUnifiedDiff(diffText);
  const classify = createUnitCoverageClassifier(collectCoverageFrom);
  const { index: coverageIndex, outsideRepository } = buildCoverageIndex(
    coverageMap,
    repositoryRoot,
  );
  const summary = {
    lines: emptyMetric(),
    functions: emptyMetric(),
    branches: emptyMetric(),
  };
  const files = [];
  const missingCoverageFiles = [];

  for (const changedFile of changedFiles) {
    const normalizedFile = portablePath(changedFile.path);
    if (changedFile.deleted) {
      files.push({
        path: normalizedFile,
        classification: 'deleted',
        changedLineCount: 0,
      });
      continue;
    }
    if (changedFile.changedLines.size === 0) {
      files.push({
        path: normalizedFile,
        classification: 'no-added-lines',
        changedLineCount: 0,
      });
      continue;
    }

    const classification = classify(normalizedFile);
    if (!classification.included) {
      files.push({
        path: normalizedFile,
        classification: 'excluded',
        reason: classification.reason,
        changedLineCount: changedFile.changedLines.size,
      });
      continue;
    }

    const coverage = coverageIndex.get(repositoryPathKey(normalizedFile, repositoryRoot));
    if (!coverage) {
      missingCoverageFiles.push(normalizedFile);
      files.push({
        path: normalizedFile,
        classification: 'missing-coverage',
        changedLineCount: changedFile.changedLines.size,
      });
      continue;
    }

    const metrics = analyzeFileCoverage(normalizedFile, changedFile.changedLines, coverage);
    addMetric(summary.lines, metrics.lines);
    addMetric(summary.functions, metrics.functions);
    addMetric(summary.branches, metrics.branches);
    files.push({
      path: normalizedFile,
      classification: 'included',
      changedLineCount: changedFile.changedLines.size,
      metrics,
    });
  }

  const thresholdFailures = Object.entries(thresholds)
    .filter(([metric, threshold]) => !metricPasses(summary[metric], threshold))
    .map(([metric]) => metric);

  return {
    passed: missingCoverageFiles.length === 0 && thresholdFailures.length === 0,
    changedFiles,
    files,
    summary,
    thresholds,
    thresholdFailures,
    missingCoverageFiles,
    outsideRepositoryCoverageEntries: outsideRepository,
  };
}

function formatMetric(metric, threshold) {
  const percentage = metricPercentage(metric);
  if (percentage === null) return `N/A (0 instrumented locations; required ${threshold}%)`;
  return `${metric.covered}/${metric.total} (${percentage.toFixed(2)}%; required ${threshold}%)`;
}

export function formatDiffCoverageReport(report, context = {}) {
  const lines = [];
  if (context.base) {
    lines.push(`Diff coverage base: ${context.base.label} -> ${context.base.sha}`);
  }
  for (const warning of context.warnings ?? []) lines.push(`WARNING: ${warning}`);
  if (context.coverageFile) lines.push(`Coverage map: ${context.coverageFile}`);

  if (report.changedFiles.length === 0) {
    lines.push('No backend/src diff against the selected base; the diff coverage gate passes.');
  }

  for (const file of report.files) {
    if (file.classification === 'excluded') {
      lines.push(
        `EXCLUDED ${file.path}: ${file.changedLineCount} changed line(s); ${file.reason}. ` +
          'Reported only and not counted by the unit diff gate.',
      );
      continue;
    }
    if (file.classification === 'deleted') {
      lines.push(`DELETED ${file.path}: no new executable lines to evaluate.`);
      continue;
    }
    if (file.classification === 'no-added-lines') {
      lines.push(`NO-ADDED-LINES ${file.path}: no added or modified line to evaluate.`);
      continue;
    }
    if (file.classification === 'missing-coverage') {
      lines.push(
        `ERROR ${file.path}: included in unit coverage but absent from coverage-final.json. ` +
          'Run npm run test:ci immediately before npm run coverage:diff.',
      );
      continue;
    }

    const instrumentedLocations = Object.values(file.metrics).reduce(
      (total, metric) => total + metric.total,
      0,
    );
    if (instrumentedLocations === 0) {
      lines.push(
        `INCLUDED ${file.path}: ${file.changedLineCount} changed line(s), but no changed ` +
          'instrumented statement/function/branch location.',
      );
    } else {
      lines.push(`INCLUDED ${file.path}: ${file.changedLineCount} changed line(s).`);
    }
  }

  lines.push('Changed-code coverage:');
  for (const metric of ['lines', 'functions', 'branches']) {
    lines.push(`  ${metric}: ${formatMetric(report.summary[metric], report.thresholds[metric])}`);
  }

  for (const uncovered of report.summary.lines.uncovered) {
    lines.push(`UNCOVERED ${uncovered.file}:${uncovered.line} line`);
  }
  for (const uncovered of report.summary.functions.uncovered) {
    lines.push(
      `UNCOVERED ${uncovered.file}:${uncovered.line} function ${JSON.stringify(uncovered.name)}`,
    );
  }
  for (const uncovered of report.summary.branches.uncovered) {
    lines.push(
      `UNCOVERED ${uncovered.file}:${uncovered.line} ${uncovered.type} branch outcome ` +
        `${uncovered.outcome}`,
    );
  }

  if (report.outsideRepositoryCoverageEntries > 0) {
    lines.push(
      `NOTE: ${report.outsideRepositoryCoverageEntries} coverage map entr${
        report.outsideRepositoryCoverageEntries === 1 ? 'y was' : 'ies were'
      } outside this repository and ignored.`,
    );
  }
  lines.push(`Diff coverage result: ${report.passed ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}

export function diffCoverageExitCode(report) {
  return report.passed ? 0 : 1;
}

export function parseCommandLine(arguments_) {
  const result = { base: undefined, help: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (argument === '--base') {
      if (!arguments_[index + 1]) {
        throw new DiffCoverageError('--base requires a Git ref or SHA.');
      }
      result.base = arguments_[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith('--base=')) {
      result.base = argument.slice('--base='.length);
      continue;
    }
    if (argument.startsWith('-')) {
      throw new DiffCoverageError(`Unknown option: ${argument}`);
    }
    if (result.base !== undefined) {
      throw new DiffCoverageError('Provide only one base ref.');
    }
    result.base = argument;
  }
  return result;
}

export function createGitRunner(repositoryRoot, environment = process.env) {
  return (arguments_) => {
    const executable = environment.DIFF_COVERAGE_GIT || 'git';
    const result = spawnSync(executable, arguments_, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: environment,
      maxBuffer: 50 * 1024 * 1024,
      windowsHide: true,
    });
    if (result.error) {
      throw new DiffCoverageError(
        `Could not run Git (${executable}). Ensure Git is installed and available on PATH.`,
        { cause: result.error },
      );
    }
    if (result.status !== 0) {
      const detail = result.stderr?.trim() || `exit code ${result.status}`;
      throw new DiffCoverageError(`git ${arguments_.join(' ')} failed: ${detail}`);
    }
    return result.stdout;
  };
}

function usableBase(value) {
  const normalized = value?.trim();
  return normalized && !ZERO_SHA_PATTERN.test(normalized) ? normalized : null;
}

export function resolveBaseRef({ requestedBase, requestedSource, fallbackBase, isCi, git }) {
  const warnings = [];
  const requested = usableBase(requestedBase);
  const fallback = usableBase(fallbackBase);

  if (requestedBase !== undefined && !requested) {
    warnings.push(
      `${requestedSource ?? 'configured base'} is missing or an all-zero SHA and cannot be used.`,
    );
  }
  if (fallbackBase !== undefined && !fallback) {
    warnings.push('DIFF_COVERAGE_FALLBACK_BASE is empty or an all-zero SHA and cannot be used.');
  }

  const candidates = [];
  const addCandidate = (label, source) => {
    if (!label || candidates.some((candidate) => candidate.label === label)) return;
    candidates.push({ label, source });
  };
  addCandidate(requested, requestedSource ?? 'configured base');
  addCandidate(fallback, 'DIFF_COVERAGE_FALLBACK_BASE');

  if (candidates.length === 0 || requested) {
    if (isCi) addCandidate('HEAD^', 'CI safe fallback');
    else {
      addCandidate('origin/main', 'local default');
      addCandidate('HEAD^', 'local fallback');
    }
  }

  for (const [index, candidate] of candidates.entries()) {
    let sha;
    try {
      sha = git([
        'rev-parse',
        '--verify',
        '--quiet',
        '--end-of-options',
        `${candidate.label}^{commit}`,
      ]).trim();
    } catch (error) {
      warnings.push(
        `Base candidate ${candidate.label} (${candidate.source}) is unavailable: ${error.message}`,
      );
      continue;
    }
    if (!COMMIT_SHA_PATTERN.test(sha)) {
      warnings.push(`${candidate.label} did not resolve to a commit SHA.`);
      continue;
    }

    try {
      const mergeBase = git(['merge-base', sha, 'HEAD']).trim();
      if (!COMMIT_SHA_PATTERN.test(mergeBase)) {
        warnings.push(
          `Base candidate ${candidate.label} (${candidate.source}) did not produce a valid merge base with HEAD and cannot be used.`,
        );
        continue;
      }
    } catch (error) {
      warnings.push(
        `Base candidate ${candidate.label} (${candidate.source}) is disconnected from HEAD or its merge base could not be validated: ${error.message}`,
      );
      continue;
    }

    if (index > 0 || (!requested && candidate.source.toLowerCase().includes('fallback'))) {
      warnings.push(`Using ${candidate.label} (${candidate.source}) as the visible fallback base.`);
    }
    return { label: candidate.label, sha, source: candidate.source, warnings };
  }

  throw new DiffCoverageError(
    `No safe base commit is available. Tried: ${
      candidates.map((candidate) => candidate.label).join(', ') || '(none)'
    }. Fetch the base history or pass --base <ref>.\n${warnings.join('\n')}`,
  );
}

export async function runDiffCoverage({
  arguments_ = process.argv.slice(2),
  environment = process.env,
  repositoryRoot = DEFAULT_REPOSITORY_ROOT,
  git = createGitRunner(repositoryRoot, environment),
} = {}) {
  const commandLine = parseCommandLine(arguments_);
  if (commandLine.help) {
    return {
      help:
        'Usage: node scripts/diff-coverage.mjs [--base <ref>|<ref>]\n' +
        'Environment: DIFF_COVERAGE_BASE, DIFF_COVERAGE_FALLBACK_BASE, DIFF_COVERAGE_GIT',
    };
  }

  const environmentBase = environment.DIFF_COVERAGE_BASE;
  const requestedBase = commandLine.base ?? environmentBase;
  const requestedSource = commandLine.base
    ? 'command-line base'
    : environmentBase !== undefined
      ? 'DIFF_COVERAGE_BASE'
      : undefined;
  const isCi = environment.GITHUB_ACTIONS === 'true' || environment.CI === 'true';
  const base = resolveBaseRef({
    requestedBase,
    requestedSource,
    fallbackBase: environment.DIFF_COVERAGE_FALLBACK_BASE,
    isCi,
    git,
  });

  const packageFile = path.join(repositoryRoot, 'backend', 'package.json');
  const coverageFile = path.join(repositoryRoot, 'backend', 'coverage', 'coverage-final.json');
  let backendPackage;
  let coverageMap;
  try {
    backendPackage = JSON.parse(await readFile(packageFile, 'utf8'));
  } catch (error) {
    throw new DiffCoverageError(`Could not read ${packageFile}: ${error.message}`, {
      cause: error,
    });
  }
  try {
    coverageMap = JSON.parse(await readFile(coverageFile, 'utf8'));
  } catch (error) {
    throw new DiffCoverageError(
      `Could not read fresh unit coverage at ${coverageFile}. ` +
        `Run "npm run test:ci" in backend immediately before this gate: ${error.message}`,
      { cause: error },
    );
  }

  const diffText = git([
    '-c',
    'core.quotePath=false',
    'diff',
    '--unified=0',
    '--no-color',
    '--no-ext-diff',
    '--find-renames',
    `${base.sha}...HEAD`,
    '--',
    'backend/src',
  ]);
  const report = evaluateDiffCoverage({
    diffText,
    coverageMap,
    repositoryRoot,
    collectCoverageFrom: backendPackage.jest?.collectCoverageFrom,
  });
  const relativeCoverageFile = portablePath(path.relative(repositoryRoot, coverageFile));
  return {
    report,
    output: formatDiffCoverageReport(report, {
      base,
      warnings: base.warnings,
      coverageFile: relativeCoverageFile,
    }),
  };
}

async function main() {
  try {
    const result = await runDiffCoverage();
    if (result.help) {
      console.log(result.help);
      return;
    }
    console.log(result.output);
    process.exitCode = diffCoverageExitCode(result.report);
  } catch (error) {
    console.error(`Diff coverage error: ${error.message}`);
    process.exitCode = 1;
  }
}

const invokedFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedFile === import.meta.url) await main();
