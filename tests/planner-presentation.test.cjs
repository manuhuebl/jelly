const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const file = path.join(__dirname, '../app/lib/planner-presentation.ts');
const moduleExports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText, { exports: moduleExports });
const { getProductColors, getEventColors } = moduleExports;

test('saved product colors get presentation overrides without mutating the record', () => {
  const saved = Object.freeze({ id: 'len', color: '#a1a3de', printDurationHours: 8.5 });
  assert.equal(getProductColors(saved).background, '#482049');
  assert.equal(getProductColors(saved).foreground, '#f0dfa4');
  assert.equal(saved.color, '#a1a3de');
  assert.equal(saved.printDurationHours, 8.5);
});

test('custom products retain their saved color and get legible contrasting text', () => {
  const saved = Object.freeze({ id: 'custom-object', color: '#fff' });
  assert.equal(getProductColors(saved).background, '#fff');
  assert.notEqual(getProductColors(saved).foreground, '#f0dfa4');
  assert.equal(getProductColors({ id: 'custom-object', color: '#000' }).foreground, '#f0dfa4');
});

test('events use the reference palette while preserving custom event colors and dates', () => {
  const event = Object.freeze({ type: 'social media', startDateTime: '2026-09-14T10:00:00' });
  assert.equal(getEventColors(event).background, '#feb5ed');
  assert.equal(getEventColors({ ...event, color: '#145a87' }).background, '#145a87');
  assert.equal(event.startDateTime, '2026-09-14T10:00:00');
  assert.equal(getEventColors({ type: 'deadline' }).foreground, '#ffffff');
});
