const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 함수를 찾을 수 없습니다.`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} 함수의 끝을 찾을 수 없습니다.`);
}

function loadGenerateAIHealthReport(weeklyCounts, options = {}) {
  const v17 = path.join(__dirname, '..', 'Code_17.gs');
  const baseline = path.join(__dirname, '..', '..', 'Code_16.gs');
  const sourcePath = fs.existsSync(v17) ? v17 : baseline;
  const source = fs.readFileSync(sourcePath, 'utf8');
  const functionSource = extractFunction(source, 'generateAIHealthReport');
  const fallbackCalls = [];

  const context = {
    Logger: { log() {} },
    PropertiesService: {
      getScriptProperties() {
        return { getProperty() { return null; } };
      },
    },
    getWeeklyDetailedData() {
      return {
        details: 'fixture',
        recordedDays: Math.max(weeklyCounts.caffeine, weeklyCounts.sleep),
        caffeineRecordedDays: weeklyCounts.caffeine,
        sleepRecordedDays: weeklyCounts.sleep,
        totalDays: 7,
        overCaffeineDays: [],
      };
    },
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        if (options.throwAfterWeekly) throw new Error('fixture spreadsheet failure');
        return { getSheetByName() { return null; } };
      },
    },
    getStructuredFallbackAnalysis(...args) {
      fallbackCalls.push(args);
      return `RULE:${args[4]}:${args[5]}`;
    },
    getInsufficientDataMessage(_recorded, _total, _cafAvg, _sleepAvg, cafDays, sleepDays) {
      return `INSUFFICIENT:${cafDays}:${sleepDays}`;
    },
    normalizeId(value) { return String(value); },
    Utilities: { formatDate() { return '08/31'; } },
    Date,
  };

  vm.createContext(context);
  vm.runInContext(`${functionSource}; this.generateAIHealthReport = generateAIHealthReport;`, context);

  const response = context.generateAIHealthReport('10101', '테스트 학생', 1152, 165, 9.2, 60, 150);
  return { response, fallbackCalls };
}

for (const fixture of [
  { caffeine: 5, sleep: 0, expected: 'RULE:5:0' },
  { caffeine: 3, sleep: 3, expected: 'RULE:3:3' },
]) {
  test(`API 키 없이 카페인 ${fixture.caffeine}일·수면 ${fixture.sleep}일이면 실제 기록으로 규칙 분석한다`, () => {
    const { response, fallbackCalls } = loadGenerateAIHealthReport(fixture);

    assert.equal(response.success, true);
    assert.equal(response.source, 'Rule');
    assert.equal(response.analysis, fixture.expected);
    assert.equal(fallbackCalls.length, 1);
    assert.equal(fallbackCalls[0][4], fixture.caffeine);
    assert.equal(fallbackCalls[0][5], fixture.sleep);
  });
}

test('API 키 없이 카페인·수면이 모두 0일이면 데이터 부족 상태를 유지한다', () => {
  const { response, fallbackCalls } = loadGenerateAIHealthReport({ caffeine: 0, sleep: 0 });

  assert.equal(response.success, true);
  assert.equal(response.source, 'InsufficientData');
  assert.equal(response.analysis, 'INSUFFICIENT:0:0');
  assert.equal(fallbackCalls.length, 0);
});

test('기록 조회 후 예외가 발생해도 바깥 폴백에 실제 기록일을 전달한다', () => {
  const { response, fallbackCalls } = loadGenerateAIHealthReport(
    { caffeine: 5, sleep: 0 },
    { throwAfterWeekly: true }
  );

  assert.equal(response.success, true);
  assert.equal(response.source, 'Fallback');
  assert.equal(fallbackCalls.length, 1);
  assert.equal(fallbackCalls[0][4], 5);
  assert.equal(fallbackCalls[0][5], 0);
});
