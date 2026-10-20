const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
process.env.TZ = 'Europe/Berlin';
const source = readFileSync(require('node:path').join(__dirname, '../app/components/week-planner.tsx'), 'utf8');
const ast = ts.createSourceFile('planner.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['asDate','addHours','addDays','getDayStart','getStartOfWeek','getWeekStart','getWeekEnd',
  'getCalendarDayOffset','getCalendarHours','getSegmentDisplayHours','setCalendarHour','getHoursBetween',
  'getLaterDate','getEarlierDate','getEndDate','buildSegmentsForRun','getCurrentTimeStyle','getTimelineStyle'];
const found = new Map();
function visit(n) { if(ts.isFunctionDeclaration(n) && n.name) found.set(n.name.text, n.getText(ast)); ts.forEachChild(n,visit); }
visit(ast);
const ctx = { HOUR_MS:3600000, DAY_MS:86400000, DAY_HOURS:24, WEEK_DAYS:7, getTimelineColorStyle:()=>({}) };
vm.createContext(ctx);
vm.runInContext(ts.transpileModule(names.map(n=>{assert.ok(found.has(n));return found.get(n);}).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);
const local = s => new Date(s);
for(const [base,next] of [['2026-10-19T00:00:00','2026-10-26T00:00:00'],['2026-03-23T00:00:00','2026-03-30T00:00:00']]) {
 test(`week stays Monday midnight across DST from ${base}`,()=>{
  const start=ctx.getWeekStart(local(base),1);
  assert.equal(start.getTime(),local(next).getTime());
  assert.equal(start.getDay(),1);assert.equal(start.getHours(),0);
  for(let i=0;i<7;i++){const day=ctx.addDays(start,i);assert.equal(day.getDay(),(i+1)%7);assert.equal(day.getHours(),0);}
  assert.equal(ctx.getWeekStart(start,-1).getTime(),local(base).getTime());
 });
}
for(const [week,sunday] of [['2026-10-19T00:00:00','2026-10-25'],['2026-03-23T00:00:00','2026-03-29']]) {
 test(`clock rows, current time, timeline and drop align on ${sunday}`,()=>{
  const w=local(week),start=local(sunday+'T10:00:00'),end=local(sunday+'T14:00:00');
  const seg=ctx.buildSegmentsForRun({start,end,run:{},product:{}},w)[0];
  assert.equal(seg.dayIndex,6);assert.equal(seg.topHours,10);assert.equal(seg.durationHours,4);
  const marker=ctx.getCurrentTimeStyle(start,w);assert.equal(marker['--day-index'],6);assert.equal(marker['--start-hour'],'10.00');
  assert.equal(ctx.setCalendarHour(ctx.addDays(w,6),10).getTime(),start.getTime());
  const style=ctx.getTimelineStyle({start,end,type:'event'},w,0);
  assert.ok(Math.abs(parseFloat(style['--timeline-left'])-154/168*100)<1e-9);
 });
}
test('real print duration across the autumn change remains elapsed hours',()=>{
 const run={startDateTime:'2026-10-24T22:00:00'},product={printDurationHours:8};
 const start=local(run.startDateTime),end=ctx.getEndDate(run,product);
 assert.equal(end.getHours(),5);assert.equal(end-start,8*3600000);
 const segments=ctx.buildSegmentsForRun({start,end,run,product},local('2026-10-19T00:00:00'));
 assert.equal(segments.length,2);assert.equal(segments[0].dayIndex,5);assert.equal(segments[0].durationHours,2);
 assert.equal(segments[1].dayIndex,6);assert.equal(segments[1].durationHours,5);
});
test('October 26 print belongs to Monday October 26, including its overnight tail',()=>{
 const w=ctx.getWeekStart(local('2026-10-19T00:00:00'),1);
 const segments=ctx.buildSegmentsForRun({start:local('2026-10-26T15:00:00'),end:local('2026-10-27T03:00:00'),run:{},product:{}},w);
 assert.equal(segments[0].dayIndex,0);assert.equal(segments[0].topHours,15);assert.equal(segments[0].durationHours,9);
 assert.equal(segments[1].dayIndex,1);assert.equal(segments[1].durationHours,3);
});
