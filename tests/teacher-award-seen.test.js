const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const gasSource = fs.readFileSync(path.join(root, 'Code_17.gs'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} 함수를 찾을 수 없습니다.`);
  const open = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} 함수의 끝을 찾을 수 없습니다.`);
}

function makeAwardSheet() {
  const header = [
    '수여일시', '학년', '반', '번호', '학번', '학생이름',
    'awardId', '뱃지이름', '이미지', '배경색', '글자색',
    '코멘트', '수여교사', '학생확인일시',
  ];
  const row = [
    '2026-08-31 21:30', '', '', '', '0', '테스트',
    'sleep_reg6', '수면 6회 등록', '😴', '#dbeafe', '#1d4ed8',
    '', '', '',
  ];
  const data = [header, row];
  return {
    data,
    getDataRange() { return { getValues() { return data; } }; },
    getLastColumn() { return header.length; },
    getRange(rowNumber, columnNumber) {
      return {
        setValue(value) { data[rowNumber - 1][columnNumber - 1] = value; },
      };
    },
  };
}

test('학생이 확인한 교사 뱃지는 서버 시트에 확인 시각을 기록한다', () => {
  const sheet = makeAwardSheet();
  sheet.data[0].pop();
  sheet.data[1].pop();
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet() { return {
      getSheetByName(name) {
        if (name !== 'students') return null;
        return { getDataRange() { return { getValues() { return [
          ['학년', '반', '번호', '이름', '학번'],
          ['', '', '', '테스트', '0'],
        ]; } }; } };
      },
    }; } },
    _getOrCreateAwardSheet_() { return sheet; },
    _nowKST_() { return '2026-08-31 22:00'; },
    _tsToStr_(value) { return String(value || ''); },
    normalizeId(value) { return String(value ?? '').replace(/\.0+$/, '').trim(); },
    LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
    Logger: { log() {} },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction(gasSource, 'markTeacherAwardsSeen')}; this.fn = markTeacherAwardsSeen;`, context);

  const result = context.fn('0', '테스트', [{
    grantedAt: '2026-08-31 21:30',
    awardId: 'sleep_reg6',
    name: '수면 6회 등록',
  }]);

  assert.equal(result.success, true);
  assert.equal(result.updated, 1);
  assert.equal(sheet.data[0][13], '학생확인일시');
  assert.equal(sheet.data[1][13], '2026-08-31 22:00');
});

test('학생 이름이 로그인 정보와 다르면 뱃지 확인 상태를 변경하지 않는다', () => {
  const sheet = makeAwardSheet();
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet() { return {
      getSheetByName() { return { getDataRange() { return { getValues() { return [
        ['학년', '반', '번호', '이름', '학번'],
        ['', '', '', '테스트', '0'],
      ]; } }; } }; },
    }; } },
    _getOrCreateAwardSheet_() { return sheet; },
    _nowKST_() { return '2026-08-31 22:00'; },
    _tsToStr_(value) { return String(value || ''); },
    normalizeId(value) { return String(value ?? '').replace(/\.0+$/, '').trim(); },
    Logger: { log() {} },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction(gasSource, 'markTeacherAwardsSeen')}; this.fn = markTeacherAwardsSeen;`, context);

  const result = context.fn('0', '다른이름', [{
    grantedAt: '2026-08-31 21:30', awardId: 'sleep_reg6', name: '수면 6회 등록',
  }]);

  assert.equal(result.success, false);
  assert.equal(result.updated, 0);
  assert.equal(sheet.data[1][13], '');
});

test('교사 뱃지 조회 응답에 서버의 학생 확인 시각을 포함한다', () => {
  const sheet = makeAwardSheet();
  sheet.data[1][13] = '2026-08-31 22:00';
  const context = {
    SpreadsheetApp: { getActiveSpreadsheet() { return {}; } },
    _getOrCreateAwardSheet_() { return sheet; },
    _tsToStr_(value) { return String(value || ''); },
    normalizeId(value) { return String(value ?? '').replace(/\.0+$/, '').trim(); },
    Logger: { log() {} },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction(gasSource, 'getTeacherAwardsForStudent')}; this.fn = getTeacherAwardsForStudent;`, context);

  const result = context.fn('0');

  assert.equal(result.success, true);
  assert.equal(result.awards.length, 1);
  assert.equal(result.awards[0].seenAt, '2026-08-31 22:00');
});

test('서버에서 이미 확인된 뱃지는 브라우저 저장값이 없어도 신규 알림으로 보지 않는다', () => {
  const context = {
    user: { studentId: '0' },
    localStorage: { getItem() { return null; } },
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction(htmlSource, '_taBadgeKey'),
    extractFunction(htmlSource, 'getSeenTeacherAwardIds'),
    extractFunction(htmlSource, '_awardKey'),
    extractFunction(htmlSource, 'getNewTeacherAwards'),
    'this.fn = getNewTeacherAwards;',
  ].join('\n'), context);

  const result = context.fn([{
    grantedAt: '2026-08-31 21:30',
    awardId: 'sleep_reg6',
    name: '수면 6회 등록',
    seenAt: '2026-08-31 22:00',
  }]);

  assert.deepEqual(Array.from(result), []);
});

test('일시적인 빈 뱃지 응답은 브라우저의 기존 확인 기록을 지우지 않는다', () => {
  const stored = new Map([['seenTeacherAwards_0', JSON.stringify(['2026-08-31 21:30|수면 6회 등록'])]]);
  const context = {
    user: { studentId: '0' },
    localStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); },
    },
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction(htmlSource, '_taBadgeKey'),
    extractFunction(htmlSource, 'getSeenTeacherAwardIds'),
    extractFunction(htmlSource, '_awardKey'),
    extractFunction(htmlSource, '_pruneSeenAwardIds'),
    'this.fn = _pruneSeenAwardIds;',
  ].join('\n'), context);

  context.fn([]);

  assert.deepEqual(JSON.parse(stored.get('seenTeacherAwards_0')), ['2026-08-31 21:30|수면 6회 등록']);
});

test('확인 버튼 처리는 로컬 캐시와 GAS 서버 양쪽에 확인 상태를 저장한다', () => {
  const stored = new Map();
  let serverCall = null;
  const runner = {
    success: null,
    withSuccessHandler(fn) { this.success = fn; return this; },
    withFailureHandler() { return this; },
    markTeacherAwardsSeen(studentId, studentName, awards) {
      serverCall = { studentId, studentName, awards };
      this.success({ success: true, updated: awards.length });
    },
  };
  const context = {
    user: { studentId: '0', name: '테스트' },
    localStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); },
    },
    google: { script: { run: runner } },
    console: { warn() {} },
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction(htmlSource, '_taBadgeKey'),
    extractFunction(htmlSource, 'getSeenTeacherAwardIds'),
    extractFunction(htmlSource, '_awardKey'),
    extractFunction(htmlSource, '_teacherAwardSeenQueueKey'),
    extractFunction(htmlSource, '_readTeacherAwardSeenQueue'),
    extractFunction(htmlSource, '_writeTeacherAwardSeenQueue'),
    extractFunction(htmlSource, '_flushTeacherAwardSeenQueue'),
    extractFunction(htmlSource, 'markTeacherAwardsSeen'),
    'this.fn = markTeacherAwardsSeen;',
  ].join('\n'), context);

  context.fn([{
    grantedAt: '2026-08-31 21:30',
    awardId: 'sleep_reg6',
    name: '수면 6회 등록',
  }]);

  assert.deepEqual(JSON.parse(stored.get('seenTeacherAwards_0')), ['2026-08-31 21:30|수면 6회 등록']);
  assert.equal(serverCall.studentId, '0');
  assert.equal(serverCall.studentName, '테스트');
  assert.deepEqual(Array.from(serverCall.awards, item => ({ ...item })), [{
    grantedAt: '2026-08-31 21:30',
    awardId: 'sleep_reg6',
    name: '수면 6회 등록',
  }]);
  assert.deepEqual(JSON.parse(stored.get('pendingTeacherAwardSeen_0')), []);
});

test('서버 저장 실패 항목은 대기열에 남고 다음 새로고침에서 성공하면 제거된다', () => {
  const stored = new Map();
  let shouldSucceed = false;
  let calls = 0;
  const runner = {
    success: null,
    failure: null,
    withSuccessHandler(fn) { this.success = fn; return this; },
    withFailureHandler(fn) { this.failure = fn; return this; },
    markTeacherAwardsSeen(_studentId, _studentName, awards) {
      calls += 1;
      if (shouldSucceed) this.success({ success: true, updated: awards.length });
      else this.failure(new Error('network'));
    },
  };
  const context = {
    user: { studentId: '0', name: '테스트' },
    localStorage: {
      getItem(key) { return stored.get(key) || null; },
      setItem(key, value) { stored.set(key, value); },
    },
    google: { script: { run: runner } },
    console: { warn() {} },
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction(htmlSource, '_taBadgeKey'),
    extractFunction(htmlSource, 'getSeenTeacherAwardIds'),
    extractFunction(htmlSource, '_awardKey'),
    extractFunction(htmlSource, '_teacherAwardSeenQueueKey'),
    extractFunction(htmlSource, '_readTeacherAwardSeenQueue'),
    extractFunction(htmlSource, '_writeTeacherAwardSeenQueue'),
    extractFunction(htmlSource, '_flushTeacherAwardSeenQueue'),
    extractFunction(htmlSource, 'markTeacherAwardsSeen'),
    'this.mark = markTeacherAwardsSeen; this.flush = _flushTeacherAwardSeenQueue;',
  ].join('\n'), context);

  context.mark([{ grantedAt: '2026-08-31 21:30', awardId: 'sleep_reg6', name: '수면 6회 등록' }]);
  assert.equal(calls, 1);
  assert.equal(JSON.parse(stored.get('pendingTeacherAwardSeen_0')).length, 1);

  shouldSucceed = true;
  context.flush();
  assert.equal(calls, 2);
  assert.deepEqual(JSON.parse(stored.get('pendingTeacherAwardSeen_0')), []);
});

test('구형 9열 뱃지 시트는 확인 상태를 보존하며 14열 형식으로 변환한다', () => {
  const rows = [
    ['수여일시', 'studentId', 'awardId', '뱃지이름', '이미지', '배경색', '글자색', '코멘트', '수여교사', '학생확인일시'],
    ['2026-08-31 21:30', '0', 'sleep_reg6', '수면 6회 등록', '😴', '#dbeafe', '#1d4ed8', '', '', '2026-08-31 22:00'],
  ];
  const sheet = {
    values: rows,
    clearCalled: false,
    clearContents() { this.clearCalled = true; this.values = []; },
    getRange(_row, _col, _rowCount, _colCount) {
      return { setValues: values => { this.values = values; } };
    },
  };
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractFunction(gasSource, '_migrateLegacyAwardSheet_')}; this.fn = _migrateLegacyAwardSheet_;`, context);

  context.fn(sheet, rows);

  assert.equal(sheet.values[0].length, 14);
  assert.equal(sheet.values[0][13], '학생확인일시');
  assert.equal(sheet.values[1][4], '0');
  assert.equal(sheet.values[1][6], 'sleep_reg6');
  assert.equal(sheet.values[1][13], '2026-08-31 22:00');
  assert.equal(sheet.clearCalled, false);
});

for (const legacyHeader of ['studentId', '학번']) {
  test(`구형 ${legacyHeader} 헤더 시트는 실제 진입점에서 14열로 변환한다`, () => {
    const sheet = {
      values: [
        ['수여일시', legacyHeader, 'awardId', '뱃지이름', '이미지', '배경색', '글자색', '코멘트', '수여교사'],
        ['2026-08-31 21:30', '0', 'sleep_reg6', '수면 6회 등록', '😴', '#dbeafe', '#1d4ed8', '', ''],
      ],
      getDataRange() { return { getValues: () => this.values }; },
      getRange() {
        return {
          setValues: values => { this.values = values; },
          setValue: value => { this.values[0][13] = value; },
        };
      },
      clearContents() { throw new Error('기존 데이터를 먼저 지우면 안 됩니다.'); },
    };
    const context = {
      LockService: { getScriptLock() { return { waitLock() {}, releaseLock() {} }; } },
      Logger: { log() {} },
    };
    vm.createContext(context);
    vm.runInContext([
      extractFunction(gasSource, '_migrateLegacyAwardSheet_'),
      extractFunction(gasSource, '_getOrCreateAwardSheet_'),
      'this.fn = _getOrCreateAwardSheet_;',
    ].join('\n'), context);

    const result = context.fn({ getSheetByName() { return sheet; } });

    assert.equal(result.values[0][1], '학년');
    assert.equal(result.values[0][13], '학생확인일시');
    assert.equal(result.values[1][4], '0');
  });
}
