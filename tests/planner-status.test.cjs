const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

// Exercise the actual planner functions, including React event handlers, with
// batched state setters. No browser, saved planner data, or server is used.
const source = readFileSync(path.join(__dirname, '../app/components/week-planner.tsx'), 'utf8');
const ast = ts.createSourceFile('planner.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const names = [
  'asDate', 'addHours', 'getEndDate', 'getScheduledRuns', 'getVisibleProducts',
  'getProductInventory', 'isRunAwaitingReview', 'isRunFinishedOrAwaitingReview',
  'getAutomaticProjectStage', 'getAutomaticRunStage', 'getRunStage',
  'getRunActionLabels', 'getSegmentLabel', 'getProgress', 'getCardActions',
  'canRemoveProject', 'requestProjectRemoval', 'confirmProjectRemoval',
  'adjustManualProductStock', 'updateRunStatus', 'handleProjectStageDrop', 'undoLastKanbanMove'
];
const compiled = ts.transpileModule(names.map(name => {
  assert.ok(functions.has(name), `Missing planner function: ${name}`);
  return functions.get(name);
}).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
const now = new Date('2026-09-14T12:00:00Z');
const product = { id: 'stool', name: 'stool', printDurationHours: 4, pelletUsageKg: 2 };
function run(id, status = 'planned', date = '2026-09-10T08:00:00Z') {
  return { id, status, productId: product.id, project: 'project', startDateTime: date };
}
function harness(runs = []) {
  const ctx = {
    HOUR_MS: 3600000, now, runs, productData: [product], productById: new Map([[product.id, product]]),
    statusLabels: { planned: 'planned', reprint: 'reprint', printing: 'printing', finished: 'printed', failed: 'failed' },
    PROJECT_STAGES: ['planned', 'printing', 'ready', 'packed', 'shipped'].map(id => ({ id, label: id })),
    manualRunStages: {}, shippedInventoryRunIds: new Set(), manualProductInventory: { stool: runs.filter(run => run.status === "finished").length },
    materialStockKg: 20, pendingUndoKanbanMove: null, nativeDragRef: { current: null },
    window: { setTimeout() {} }, savePlannerSnapshot() {}, boxesUsed: 0,
    subtractShippingBox() { ctx.boxesUsed++; },
  };
  const updates = [];
  for (const [setter, key] of Object.entries({
    setRuns: 'runs', setManualProductInventory: 'manualProductInventory',
    setManualRunStages: 'manualRunStages', setShippedInventoryRunIds: 'shippedInventoryRunIds',
    setPendingUndoKanbanMove: 'pendingUndoKanbanMove', setPendingUndoMove: 'pendingUndoMove',
    setHiddenProjectIds: 'hiddenProjectIds', setExpandedProjectIds: 'expandedProjectIds',
    setPendingProjectRemoval: 'pendingProjectRemoval',
    setMaterialStockKg: 'materialStockKg', setNotice: 'notice', setDragState: 'dragState'
  })) ctx[setter] = value => updates.push(() => { ctx[key] = typeof value === 'function' ? value(ctx[key]) : value; });
  vm.createContext(ctx);
  vm.runInContext(compiled, ctx);
  for (const name of ['updateRunStatus', 'handleProjectStageDrop', 'undoLastKanbanMove', 'requestProjectRemoval', 'confirmProjectRemoval']) {
    const handler = ctx[name];
    ctx[name] = (...args) => {
      handler(...args);
      while (updates.length) updates.shift()();
    };
  }
  ctx.entries = () => ctx.getScheduledRuns(ctx.runs, ctx.productById);
  ctx.stock = () => ctx.getProductInventory(ctx.runs, ctx.now, ctx.manualProductInventory, ctx.productData, ctx.productById)[0].stockCount;
  ctx.drop = (ids, stage, bundle = true) => {
    ctx.kanbanRows = ctx.entries().map(entry => ({ ...entry, projectKey: entry.run.project }));
    ctx.handleProjectStageDrop({ preventDefault() {}, stopPropagation() {}, dataTransfer: {
      getData: () => `${bundle ? 'kanban-group' : 'kanban-run'}:${ids.join(',')}`
    } }, stage);
  };
  return ctx;
}

for (const status of ['planned', 'reprint']) {
  test(`${status}: elapsed dates never imply printed, progress, stock or review`, () => {
    const h = harness([run('a', status)]);
    const entry = h.entries()[0];
    for (const date of ['2026-09-09T12:00:00Z', '2026-09-10T08:00:00Z', '2026-09-10T12:00:00Z', '2026-09-14T12:00:00Z']) {
      const time = new Date(date);
      assert.equal(h.getAutomaticRunStage(entry, time), 'planned');
      assert.equal(h.getAutomaticProjectStage({ runs: [entry] }, time), 'planned');
      assert.equal(h.isRunFinishedOrAwaitingReview(entry, time), false);
      assert.equal(h.getSegmentLabel(entry), status);
      assert.equal(h.getProgress(entry, time), null);
      assert.equal(h.stock(), 0);
    }
    assert.deepEqual(Array.from(h.getRunActionLabels(entry, now)), ['print started']);
    assert.deepEqual(Array.from(h.getRunActionLabels(entry, new Date('2026-09-09'))), []);
    assert.equal(h.getSegmentLabel({ ...entry, startsBeforeSegment: true }), 'continued');
  });
}

test('explicit start, review and completion control stage and inventory', () => {
  const h = harness([run('a')]);
  h.updateRunStatus(h.runs[0], 'printing', now.toISOString());
  let entry = h.entries()[0];
  assert.equal(h.getAutomaticRunStage(entry, now), 'printing');
  assert.equal(h.isRunFinishedOrAwaitingReview(entry, now), false);
  assert.equal(h.getProgress(entry, now), 0);
  const end = new Date('2026-09-14T16:00:00Z');
  assert.equal(h.isRunFinishedOrAwaitingReview(entry, end), true);
  assert.equal(h.getAutomaticRunStage(entry, end), 'ready');
  assert.equal(h.stock(), 0);
  assert.equal(h.materialStockKg, 20);
  assert.deepEqual(Array.from(h.getRunActionLabels(entry, end)), ['print okay?', 'print not okay?']);
  h.updateRunStatus(h.runs[0], 'finished');
  assert.equal(h.stock(), 1);
  assert.equal(h.materialStockKg, 18);
  assert.equal(h.boxesUsed, 1);
  h.updateRunStatus(h.runs[0], 'finished');
  assert.equal(h.stock(), 1);
  assert.equal(h.materialStockKg, 18);
});

test('failed print consumes material without creating finished stock', () => {
  const h = harness([run('a', 'printing')]);
  h.updateRunStatus(h.runs[0], 'failed');
  assert.equal(h.stock(), 0);
  assert.equal(h.materialStockKg, 18);
  assert.equal(h.getSegmentLabel(h.entries()[0]), 'failed');
  assert.equal(h.isRunFinishedOrAwaitingReview(h.entries()[0], now), false);
});

for (const bundle of [false, true]) {
  test(`${bundle ? 'bundle' : 'single'} moves, Shipped stock and Undo`, () => {
    const h = harness([run('a', 'finished'), run('b', 'finished'), run('c')]);
    const ids = bundle ? ['a', 'b', 'c'] : ['a'];
    const shippedCount = bundle ? 2 : 1;
    assert.equal(h.stock(), 2);
    h.drop(ids, 'shipped', bundle);
    assert.equal(h.stock(), 2 - shippedCount);
    assert.equal(h.shippedInventoryRunIds.size, ids.length);
    for (const id of ids) assert.equal(h.manualRunStages[id], 'shipped');
    h.drop(ids, 'shipped', bundle);
    assert.equal(h.stock(), 2 - shippedCount);
    h.undoLastKanbanMove();
    assert.equal(h.stock(), 2);
    assert.equal(h.shippedInventoryRunIds.size, 0);
    for (const id of ids) assert.equal(h.manualRunStages[id], undefined);
    assert.equal(h.getRunStage(h.entries()[2], h.manualRunStages, now), 'planned');
    h.drop(ids, 'shipped', bundle);
    h.drop(ids, 'packed', bundle);
    assert.equal(h.stock(), 2);
    h.undoLastKanbanMove();
    assert.equal(h.stock(), 2 - shippedCount);
    for (const id of ids) assert.equal(h.manualRunStages[id], 'shipped');
  });
}

test('completion after shipping does not add available inventory', () => {
  const h = harness([run('a')]);
  h.drop(['a'], 'shipped', false);
  h.updateRunStatus(h.runs[0], 'finished');
  assert.equal(h.stock(), 0);
  h.drop(['a'], 'packed', false);
  assert.equal(h.stock(), 1);
});


test('remove shipped project hides only its overview and never deducts inventory twice', () => {
  const h = harness([run('a', 'finished'), run('b', 'finished')]);
  h.kanbanRows = h.entries().map(entry => ({ ...entry, projectKey: 'project' }));
  h.hiddenProjectIds = new Set();
  h.expandedProjectIds = new Set(['shipped-project']);
  h.pendingProjectRemoval = null;
  h.drop(['a'], 'shipped', false);
  h.requestProjectRemoval({ id: 'project', project: 'project' });
  assert.equal(h.pendingProjectRemoval, null, 'partially shipped project stays visible');
  h.drop(['b'], 'shipped', false);
  const stock = h.stock();
  const shippedIds = [...h.shippedInventoryRunIds];
  const runs = JSON.stringify(h.runs);
  h.requestProjectRemoval({ id: 'project', project: 'project' });
  h.confirmProjectRemoval();
  assert.equal(h.hiddenProjectIds.has('project'), true);
  assert.equal(h.expandedProjectIds.has('shipped-project'), false);
  assert.equal(h.stock(), stock);
  assert.deepEqual([...h.shippedInventoryRunIds], shippedIds);
  assert.equal(JSON.stringify(h.runs), runs);
});
