import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';

const probe = String.raw`
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const instant = process.argv[1];
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [instant])); }
}
function load(file) {
  const module = { exports: {} };
  let source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('EstimateTool.tsx')) {
    source += '\nexport const fixtureDefaults = createDefaultState;\n';
    if (!fs.existsSync('lib/calendar-date.ts')) source += '\nexport const fixtureHelpers = { todayISO, addDaysISO };\n';
  }
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
  if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error(result.diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, " ")).join("; "));
  const compiled = result.outputText;
  const require = name => {
    if (name === 'react' || name === 'react/jsx-runtime') return {};
    if (name === '@/lib/track') return { track() {} };
    if (name === '@/lib/calendar-date') return load('lib/calendar-date.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
    throw new Error('Unexpected import ' + name);
  };
  vm.runInNewContext(compiled, { module, exports: module.exports, require, Date: FixedDate, Intl, crypto: { randomUUID: () => 'dummy' } });
  return module.exports;
}
const component = load('app/p/mitsumori/EstimateTool.tsx');
const helpers = fs.existsSync('lib/calendar-date.ts') ? load('lib/calendar-date.ts') : component.fixtureHelpers;
console.log(JSON.stringify({ today: helpers.todayISO(), defaults: component.fixtureDefaults(), added: [
  helpers.addDaysISO('2026-10-05', 30),
  helpers.addDaysISO('2026-01-31', 1),
  helpers.addDaysISO('2026-12-31', 1),
  helpers.addDaysISO('2028-02-28', 1),
  helpers.addDaysISO('2026-10-05', 0),
  helpers.addDaysISO('2026-10-05', -1),
  helpers.addDaysISO('2026-03-07', 2)
] }));
`;

for (const [zone, instant, today] of [
  ['Asia/Tokyo', '2026-10-05T08:30:00+09:00', '2026-10-05'],
  ['UTC', '2026-10-05T08:30:00Z', '2026-10-05'],
  ['America/Los_Angeles', '2026-10-05T00:30:00Z', '2026-10-04'],
]) {
  test(`local today, estimate number and calendar arithmetic stay consistent in ${zone}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe, instant], { encoding: 'utf8', env: { ...process.env, TZ: zone } });
    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout);
    assert.equal(data.today, today);
    assert.equal(data.defaults.issueDate, today);
    assert.equal(data.defaults.estimateNumber, `MITSU-${today.replaceAll('-', '')}-1`);
    assert.equal(data.defaults.validUntil, today === '2026-10-05' ? '2026-11-04' : '2026-11-03');
    assert.deepEqual(data.added, ['2026-11-04', '2026-02-01', '2027-01-01', '2028-02-29', '2026-10-05', '2026-10-04', '2026-03-09']);
  });
}
