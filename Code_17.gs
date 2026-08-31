/**
 * 카페인 모니터링 시스템 - Google Apps Script 백엔드
 */

// 웹 앱 초기화
function doGet(e) {
  const param = (e && e.parameter) ? e.parameter : {};
  const page  = param.page || 'index';

  // ⭐ GitHub Pages API 요청 처리 (GET 방식 — CORS 우회)
  // gas-bridge.js 가 ?action=xxx&params=[...] 형태로 GET 요청을 보냄
  if (param.action) {
    return handleAPIRequest(param.action, JSON.parse(param.params || '[]'));
  }

  if (page === 'teacher') {
    // 교사용 모니터링 대시보드
    return HtmlService.createTemplateFromFile('teacher')
      .evaluate()
      .setTitle('교사용 카페인 모니터링 대시보드')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 기본: 학생용 앱
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('카페인 추적기 - 청소년 건강 관리')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// GitHub Pages에서 오는 GET API 요청 처리기
function handleAPIRequest(action, params) {
  try {
    Logger.log('=== GET API 요청 ===');
    Logger.log('action: ' + action);
    Logger.log('params: ' + JSON.stringify(params));

    const ALLOWED_ACTIONS = {
      // 인증
      'checkLogin': checkLogin,
      // 카페인 데이터
      'saveCaffeineData': saveCaffeineData,
      'getCaffeineLogs': getCaffeineLogs,
      'deleteCaffeineData': deleteCaffeineData,
      'updateCaffeineData': updateCaffeineData,
      // 수면 데이터
      'saveSleepData': saveSleepData,
      'getSleepLogs': getSleepLogs,
      'deleteSleepData': deleteSleepData,
      'updateSleepData': updateSleepData,
      // 체중 / 초기설정
      'saveWeightData': saveWeightData,
      'getWeightData': getWeightData,
      'saveInitialSetup': saveInitialSetup,
      // 통계
      'getStats': getStats,
      'getFilteredStats': getFilteredStats,
      // 뱃지
      'getTeacherAwardsForStudent': getTeacherAwardsForStudent,
      // 문의
      'submitInquiry': submitInquiry,
      'getMyInquiries': getMyInquiries,
      // 카페인 DB
      'getCaffeineDB': getCaffeineDB,
      // 연결 테스트
      'testConnection': testConnection,
      // AI 분석
      'generateAIHealthReport': generateAIHealthReport,
      'analyzeDrinkImageWithAI': analyzeDrinkImageWithAI,
      // 교사용
      'getTeacherData': getTeacherData,
      'handleAIReportForTeacher': handleAIReportForTeacher,
      'grantTeacherAwards': grantTeacherAwards,
      'revokeTeacherAward': revokeTeacherAward,
      'getInquiries': getInquiries,
      'replyToInquiry': replyToInquiry,
      'deleteInquiry': deleteInquiry,
      'getUnreadInquiries': getUnreadInquiries,
      'markInquiryNotified': markInquiryNotified,
      'exportDataToNewSheet': exportDataToNewSheet,
      // 교사→학생 메시지
      'sendTeacherMessage': sendTeacherMessage,
      'saveTeacherPdfAndSendMessage': saveTeacherPdfAndSendMessage,
      'getSentTeacherMessages': getSentTeacherMessages,
      'getTeacherMessages': getTeacherMessages,
      'markTeacherMessageRead': markTeacherMessageRead,
      'deleteTeacherMessage': deleteTeacherMessage,
      'deleteBulkTeacherMessages': deleteBulkTeacherMessages,
      'replyToTeacherMessage': replyToTeacherMessage,
      'getUnreadStudentReplies': getUnreadStudentReplies,
      'markStudentReplyRead': markStudentReplyRead,
      // AI 수면 메모 단어 분류
      'analyzeSleepMemoWords': analyzeSleepMemoWords,
      // 뱃지 임계값 (구버전 호환)
      'getBadgeThresholds': getBadgeThresholds,
      'saveBadgeThresholds': saveBadgeThresholds,
      // 뱃지 설정 v2 (연속/누적 타입 지원)
      'getBadgeConfig': getBadgeConfig,
      'saveBadgeConfig': saveBadgeConfig,
      // 뱃지 설정 v3 (챌린지 교사 승인 방식)
      'getChallengeBadgeConfig': getChallengeBadgeConfig,
      'saveChallengeBadgeConfig': saveChallengeBadgeConfig,
      // 승인 대기 / 기각 / 수여설정 GAS 동기화
      'getPendingBadges': getPendingBadges,
      'savePendingBadgesData': savePendingBadgesData,
      'getDismissedBadges': getDismissedBadges,
      'saveDismissedBadgesData': saveDismissedBadgesData,
      'getAwardSettings': getAwardSettings,
      'saveAwardSettingsData': saveAwardSettingsData,
      // AI 분석 결과 저장/불러오기
      'saveAIReport': saveAIReport,
      'getAIReport': getAIReport,
      // 수면 기준 설정 (연령대)
      'getSleepSettings': getSleepSettings,
      'saveSleepSettings': saveSleepSettings,
    };

    if (!ALLOWED_ACTIONS[action]) {
      throw new Error('허용되지 않은 action: ' + action);
    }

    const fn = ALLOWED_ACTIONS[action];
    let result;
    if (params.length === 0)      result = fn();
    else if (params.length === 1) result = fn(params[0]);
    else if (params.length === 2) result = fn(params[0], params[1]);
    else                          result = fn(...params);

    Logger.log('GET API 결과: ' + JSON.stringify(result));

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('❌ GET API 오류: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Students 시트 자동 학번 생성
// 학년, 반, 번호가 입력되면 자동으로 학번 ID 생성 (예: 1학년 1반 1번 → 1101)
function onEdit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();
    
    // students 시트에서만 동작
    if (sheetName !== 'students') return;
    
    const range = e.range;
    const row = range.getRow();
    
    // 헤더 행은 제외
    if (row === 1) return;
    
    // 편집된 컬럼이 A(학년), B(반), C(번호) 중 하나인 경우
    const col = range.getColumn();
    if (col >= 1 && col <= 3) {
      const gradeCell = sheet.getRange(row, 1); // A: 학년
      const classCell = sheet.getRange(row, 2); // B: 반
      const numberCell = sheet.getRange(row, 3); // C: 번호
      const idCell = sheet.getRange(row, 5);    // E: 학번 ID
      
      const grade = gradeCell.getValue();
      const classNum = classCell.getValue();
      const number = numberCell.getValue();
      
      // 모든 값이 입력되었는지 확인
      if (grade && classNum && number) {
        // 학번 생성: 학년(1자리) + 반(1자리) + 번호(2자리)
        const studentId = String(grade) + String(classNum) + String(number).padStart(2, '0');
        idCell.setValue(Number(studentId));
        
        Logger.log(`자동 학번 생성: ${row}행 - ${studentId}`);
      }
    }
  } catch (error) {
    Logger.log('onEdit 오류: ' + error);
  }
}

// 학번 분석 함수
function parseStudentId(studentId) {
  const str = normalizeId(studentId);
  if (str.length === 4) {
    return {
      grade: str.charAt(0),
      class: str.charAt(1),
      number: str.substring(2)
    };
  }
  return { grade: "-", class: "-", number: "-" };
}

// ⭐ 학번 정규화: 숫자 1101.0 → "1101", 문자 "1101" → "1101"
function normalizeId(val) {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') return String(Math.round(val)).trim();
  return String(val).replace(/\.0+$/, '').trim();
}

// KST 시간 포맷 함수
function getKSTTimestamp() {
  const now = new Date();
  return Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
}

// KST 날짜만 포맷
function getKSTDate() {
  const now = new Date();
  return Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd");
}

// 로그인 확인
// Students 시트 구조: A:학년, B:반, C:번호, D:이름, E:학번ID
function checkLogin(studentId, name) {
  try {
    Logger.log('=== 로그인 시도 ===');
    Logger.log('입력된 학번: "' + studentId + '"');
    Logger.log('입력된 이름: "' + name + '"');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("students");
    
    if (!sheet) {
      Logger.log('❌ students 시트를 찾을 수 없음');
      return { success: false, message: "학생 명단 시트를 찾을 수 없습니다." };
    }
    
    const data = sheet.getDataRange().getValues();
    Logger.log('students 시트 데이터 행 수: ' + (data.length - 1) + '명');
    
    // 처음 5개 행 로그 출력 (디버깅용)
    for (let i = 1; i < Math.min(6, data.length); i++) {
      Logger.log(`${i}행 - E열(학번): "${data[i][4]}", D열(이름): "${data[i][3]}"`);
    }
    
    for (let i = 1; i < data.length; i++) {
      // ⭐ normalizeId로 숫자(1101.0) → "1101" 처리
      const rowId   = normalizeId(data[i][4]);  // E열: 학번
      const rowName = String(data[i][3]).trim(); // D열: 이름
      const inputId = normalizeId(studentId);
      
      if (rowId === inputId && rowName === name.trim()) {
        Logger.log('✅ 로그인 성공: ' + i + '행에서 일치');
        // 비수치 학번(교직원·교생)은 "학번_이름" 복합키로 고유화
        const uniqueId = /^\d+$/.test(inputId) ? inputId : inputId + '_' + name.trim();
        return {
          success: true,
          studentId: uniqueId,
          name: name
        };
      }
    }
    
    Logger.log('❌ 일치하는 데이터 없음');
    return { success: false, message: "등록되지 않은 정보입니다. 학번과 이름을 다시 확인해주세요." };
  } catch (error) {
    Logger.log('❌ 로그인 오류: ' + error);
    return { success: false, message: "오류가 발생했습니다: " + error.message };
  }
}

// 카페인 데이터 저장
// 컬럼: A:타임스탬프, B:학년, C:반, D:번호, E:전체학번, F:성명, G:음료명, H:함량, I:섭취시간, J:고유ID, K:섭취이유
function saveCaffeineData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("caffeine");
    
    if (!sheet) {
      throw new Error("카페인 시트를 찾을 수 없습니다.");
    }
    
    const kstTimestamp = getKSTTimestamp();
    const p = parseStudentId(normalizeId(payload.studentId));
    
    // 섭취 시간 처리
    let intakeTime = payload.time || kstTimestamp;
    if (intakeTime.includes('T')) {
      const dt = new Date(intakeTime);
      intakeTime = Utilities.formatDate(dt, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    }
    
    sheet.appendRow([
      kstTimestamp,      // A: 타임스탬프 (기록 시간)
      p.grade,           // B: 학년
      p.class,           // C: 반
      p.number,          // D: 번호
      normalizeId(payload.studentId), // E: 전체학번
      payload.name,      // F: 성명
      payload.drink,     // G: 음료명
      payload.mg,        // H: 함량
      intakeTime,        // I: 섭취시간
      payload.id || '',      // J: 고유ID
      payload.reason || '',  // K: 섭취이유
      payload.symptom || ''  // L: 부작용 경험
    ]);
    
    return { success: true };
  } catch (error) {
    Logger.log('카페인 저장 오류: ' + error);
    throw error;
  }
}

// 수면 데이터 저장 (중복 날짜 처리)
// 컬럼: A:타임스탬프, B:학년, C:반, D:번호, E:전체학번, F:성명, G:날짜, H:취침, I:기상, J:시간, K:컨디션, L:메모, M:고유ID
function getWakeDateFromSleepPayload(payload) {
  const sleepDate = String(payload && payload.date || '').substring(0, 10);
  const sleepTime = String(payload && payload.sleepTime || '').substring(0, 5);
  const wakeTime = String(payload && payload.wakeTime || '').substring(0, 5);
  if (!sleepDate) return '';
  if (!sleepTime || !wakeTime || wakeTime > sleepTime) return sleepDate;
  const parts = sleepDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return sleepDate;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + 1);
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd');
}

function saveSleepData(payload) {
  try {
    // payload 검증
    if (!payload) {
      Logger.log('❌ saveSleepData: payload가 undefined입니다');
      throw new Error("데이터가 전달되지 않았습니다.");
    }
    
    Logger.log('=== saveSleepData 시작 ===');
    Logger.log('받은 데이터: ' + JSON.stringify(payload));
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("sleep") || (() => {
      const s = ss.insertSheet("sleep");
      s.appendRow([
        "타임스탬프", "학년", "반", "번호", "전체학번", "성명",
        "날짜", "취침시간", "기상날짜", "기상시간", "수면시간",
        "컨디션", "메모", "고유ID",
        "취침전스마트폰", "취침전활동", "잠들기소요시간", "수면중각성", "낮졸림"
      ]);
      s.setFrozenRows(1);
      Logger.log("✅ sleep 시트 자동 생성 완료");
      return s;
    })();
    
    // 필수 필드 확인
    if (!payload.studentId) {
      Logger.log('❌ payload.studentId가 없습니다: ' + JSON.stringify(payload));
      throw new Error("학번이 전달되지 않았습니다.");
    }
    
    if (!payload.date) {
      Logger.log('❌ payload.date가 없습니다');
      throw new Error("날짜가 전달되지 않았습니다.");
    }
    
    const kstTimestamp = getKSTTimestamp();
    const p = parseStudentId(normalizeId(payload.studentId));
    const resolvedWakeDate = payload.wakeDate || getWakeDateFromSleepPayload(payload);
    
    Logger.log(`학번: ${payload.studentId}, 날짜: ${payload.date}`);
    
    // 기존 데이터 확인 - 같은 날짜에 같은 학생의 데이터가 있는지 체크
    const data = sheet.getDataRange().getValues();
    let existingRowIndex = -1;
    
    Logger.log(`기존 데이터 검색 시작: 총 ${data.length - 1}행 확인`);
    Logger.log(`검색 조건 - 학번: "${payload.studentId}", 날짜: "${payload.date}"`);
    
    for (let i = 1; i < data.length; i++) {
      const rowStudentId = normalizeId(data[i][4]); // E열
      const rowDateRaw = data[i][6];                  // G열
      
      // 날짜 형식 통일 (Date 객체든 문자열이든 YYYY-MM-DD 형식으로)
      let rowDate = '';
      if (rowDateRaw instanceof Date) {
        rowDate = Utilities.formatDate(rowDateRaw, "Asia/Seoul", "yyyy-MM-dd");
      } else if (rowDateRaw) {
        rowDate = String(rowDateRaw).trim();
        // YYYY-MM-DD 형식이 아니면 변환 시도
        if (rowDate.includes('/')) {
          const parts = rowDate.split('/');
          if (parts.length === 3) {
            rowDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
      }
      
      // 디버깅 로그 (처음 3개만)
      if (i <= 3) {
        Logger.log(`Row ${i + 1}: 학번="${rowStudentId}", 날짜="${rowDate}" (원본: ${rowDateRaw})`);
      }
      
      // 같은 학생의 같은 날짜 기록이 있는 경우
      // 비수치 학번(교직원·교생)은 이름(F열)까지 함께 비교해 개인 구분
      const payloadNormId = normalizeId(payload.studentId);
      const isNumericPayloadId = /^\d+$/.test(payloadNormId);
      const rowName = String(data[i][5] || '').trim(); // F열: 성명
      const nameMatch = isNumericPayloadId || rowName === String(payload.name || '').trim();
      if (rowStudentId === payloadNormId &&
          rowDate === String(payload.date).trim() &&
          nameMatch) {
        existingRowIndex = i + 1; // 시트는 1-based index
        Logger.log(`✅ 기존 데이터 발견: Row ${existingRowIndex}`);
        Logger.log(`   학번 일치: "${rowStudentId}" === "${payload.studentId}"`);
        Logger.log(`   날짜 일치: "${rowDate}" === "${payload.date}"`);
        break;
      }
    }
    
    if (existingRowIndex === -1) {
      Logger.log(`기존 데이터 없음 - 새로 추가됨`);
    }
    
    let wasUpdated = false;
    
    if (existingRowIndex > 0) {
      // 기존 데이터가 있으면 해당 행 삭제
      Logger.log(`⚠️ Row ${existingRowIndex} 삭제 시작...`);
      sheet.deleteRow(existingRowIndex);
      Logger.log(`✅ 기존 수면 기록 삭제 완료: 학번=${payload.studentId}, 날짜=${payload.date}`);
      wasUpdated = true;
    }
    
    // 새로운 데이터 추가 (항상)
    Logger.log(`새 데이터 추가 중...`);
    sheet.appendRow([
      kstTimestamp,           // A: 타임스탬프
      p.grade,                // B: 학년
      p.class,                // C: 반
      p.number,               // D: 번호
      normalizeId(payload.studentId),      // E: 전체학번
      payload.name,           // F: 성명
      payload.date,           // G: 날짜
      payload.sleepTime,      // H: 취침 시간
      resolvedWakeDate,       // I: wake date
      payload.wakeTime,       // I: 기상 시간
      payload.hours,          // J: 수면 시간
      payload.condition,      // K: 컨디션 (이모지)
      payload.memo || '',     // L: 메모
      payload.id || '',       // M: 고유ID
      payload.smartphone || '',  // N: 취침 전 스마트폰
      payload.activity || '',    // O: 취침 전 활동
      payload.latency || '',     // P: 수면 잠들기 소요시간
      payload.awakenings || '',  // Q: 수면 중 각성
      payload.daytime || ''      // R: 낮 졸림
    ]);
    
    Logger.log(`✅ 수면 기록 저장 완료: 학번=${payload.studentId}, 날짜=${payload.date}, 덮어쓰기=${wasUpdated}`);
    Logger.log('=== saveSleepData 종료 ===');
    
    return { 
      success: true, 
      updated: wasUpdated,
      message: wasUpdated ? '같은 날짜의 기존 데이터가 수정되었습니다.' : '수면 기록이 저장되었습니다.'
    };
  } catch (error) {
    Logger.log('❌ 수면 저장 오류: ' + error);
    Logger.log('오류 스택: ' + error.stack);
    throw error;
  }
}

// 체중 데이터 저장
function saveWeightData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("info");
    
    if (!sheet) {
      throw new Error("info 시트를 찾을 수 없습니다.");
    }
    
    const kstTimestamp = getKSTTimestamp();
    const p = parseStudentId(normalizeId(payload.studentId));
    
    // 기존 데이터 확인
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim() === normalizeId(payload.studentId)) {
        rowIndex = i + 1; // 시트 행 번호 (1-based)
        break;
      }
    }
    
    if (rowIndex > 0) {
      // 기존 데이터 업데이트
      sheet.getRange(rowIndex, 1).setValue(kstTimestamp);
      sheet.getRange(rowIndex, 7).setValue(payload.weight);
    } else {
      // 새 데이터 추가
      sheet.appendRow([
        kstTimestamp,      // A: 타임스탬프
        p.grade,           // B: 학년
        p.class,           // C: 반
        p.number,          // D: 번호
        payload.name,      // E: 성명
        normalizeId(payload.studentId), // F: 전체학번
        payload.weight     // G: 몸무게
      ]);
    }
    
    return { success: true };
  } catch (error) {
    Logger.log('체중 저장 오류: ' + error);
    throw error;
  }
}

// 체중 데이터 조회
function getWeightData(studentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("info");

    if (!sheet) {
      Logger.log('info 시트를 찾을 수 없습니다');
      return { success: false, weight: null };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('info 데이터가 없습니다');
      return { success: false, weight: null };
    }

    // F열(6)~K열(11): 학번, 몸무게, 목표카페인, 목표취침, 목표기상, 연령대
    const range = sheet.getRange(2, 6, lastRow - 1, 6);
    const data = range.getValues();

    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === normalizeId(studentId)) {
        const weight = parseFloat(data[i][1]);
        if (weight && weight > 0) {
          Logger.log(`초기설정 조회 성공: ${studentId} = ${weight}kg`);
          return {
            success: true,
            weight: weight,
            targetCaf:     data[i][2] ? parseInt(data[i][2])    : null,
            targetBedtime: data[i][3] ? String(data[i][3]).trim() : null,
            targetWakeTime:data[i][4] ? String(data[i][4]).trim() : null,
            ageGroup:      data[i][5] ? String(data[i][5]).trim() : 'teen'
          };
        }
      }
    }

    Logger.log(`초기설정 정보 없음: ${studentId}`);
    return { success: false, weight: null };
  } catch (error) {
    Logger.log('체중 조회 오류: ' + error);
    return { success: false, weight: null };
  }
}

// 초기 설정 저장 (체중 + 목표 카페인 + 목표 취침/기상시간)
function saveInitialSetup(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("info");
    if (!sheet) throw new Error("info 시트를 찾을 수 없습니다.");

    const kstTimestamp = getKSTTimestamp();
    const p = parseStudentId(normalizeId(payload.studentId));
    const normId = normalizeId(payload.studentId);

    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim() === normId) { rowIndex = i + 1; break; }
    }

    if (rowIndex > 0) {
      // 기존 행 업데이트
      sheet.getRange(rowIndex, 1).setValue(kstTimestamp);        // A: 타임스탬프
      sheet.getRange(rowIndex, 7).setValue(payload.weight);      // G: 몸무게
      sheet.getRange(rowIndex, 8).setValue(payload.targetCaf || '');   // H: 목표카페인
      sheet.getRange(rowIndex, 9).setValue(payload.targetBedtime || ''); // I: 목표취침
      sheet.getRange(rowIndex, 10).setValue(payload.targetWakeTime || ''); // J: 목표기상
      sheet.getRange(rowIndex, 11).setValue(payload.ageGroup || 'teen'); // K: 연령대
    } else {
      // 새 행 추가
      sheet.appendRow([
        kstTimestamp,   // A: 타임스탬프
        p.grade,        // B: 학년
        p.class,        // C: 반
        p.number,       // D: 번호
        payload.name,   // E: 성명
        normId,         // F: 전체학번
        payload.weight, // G: 몸무게
        payload.targetCaf || '',       // H: 목표카페인
        payload.targetBedtime || '',   // I: 목표취침시간
        payload.targetWakeTime || '',  // J: 목표기상시간
        payload.ageGroup || 'teen'     // K: 연령대
      ]);
    }

    Logger.log(`초기설정 저장 완료: ${normId}, 체중=${payload.weight}, 목표카페인=${payload.targetCaf}, 취침=${payload.targetBedtime}, 기상=${payload.targetWakeTime}`);
    return { success: true };
  } catch (error) {
    Logger.log('초기설정 저장 오류: ' + error);
    throw error;
  }
}

// 카페인 데이터 업데이트
function updateCaffeineData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("caffeine");
    
    if (!sheet) {
      throw new Error("카페인 시트를 찾을 수 없습니다.");
    }
    
    const kstTimestamp = getKSTTimestamp();
    
    let intakeTime = payload.time || kstTimestamp;
    if (intakeTime.includes('T')) {
      const dt = new Date(intakeTime);
      intakeTime = Utilities.formatDate(dt, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
    }
    
    let rowIndex = -1;
    if (payload.id) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][9]) === String(payload.id)) { // J열: 고유ID
          rowIndex = i + 1;
          break;
        }
      }
    }
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1).setValue(kstTimestamp);          // A: 타임스탬프
      sheet.getRange(rowIndex, 7).setValue(payload.drink);         // G: 음료명
      sheet.getRange(rowIndex, 8).setValue(payload.mg);            // H: 함량
      sheet.getRange(rowIndex, 9).setValue(intakeTime);            // I: 섭취시간
      sheet.getRange(rowIndex, 11).setValue(payload.reason || '');  // K: 섭취이유
      sheet.getRange(rowIndex, 12).setValue(payload.symptom || ''); // L: 부작용 경험
      return { success: true };
    }

    throw new Error("수정할 기록을 찾을 수 없습니다.");
  } catch (error) {
    Logger.log('카페인 수정 오류: ' + error);
    throw error;
  }
}

// 수면 데이터 업데이트
function updateSleepData(payload) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("sleep");
    
    if (!sheet) {
      throw new Error("수면 시트를 찾을 수 없습니다.");
    }
    
    const kstTimestamp = getKSTTimestamp();
    const resolvedWakeDate = payload.wakeDate || getWakeDateFromSleepPayload(payload);
    
    let rowIndex = -1;
    if (payload.id) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][13]) === String(payload.id)) { // M열: 고유ID
          rowIndex = i + 1;
          break;
        }
      }
    }
    
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1).setValue(kstTimestamp);              // A: 타임스탬프
      sheet.getRange(rowIndex, 7).setValue(payload.date);              // G: 날짜
      sheet.getRange(rowIndex, 8).setValue(payload.sleepTime);         // H: 취침
      sheet.getRange(rowIndex, 9).setValue(resolvedWakeDate);            // I: wake date
      sheet.getRange(rowIndex, 10).setValue(payload.wakeTime);          // J: wake time
      sheet.getRange(rowIndex, 11).setValue(payload.hours);            // J: 시간
      sheet.getRange(rowIndex, 12).setValue(payload.condition);        // K: 컨디션
      sheet.getRange(rowIndex, 13).setValue(payload.memo || '');       // L: 메모
      if (payload.smartphone !== undefined) sheet.getRange(rowIndex, 15).setValue(payload.smartphone || ''); // N
      if (payload.activity   !== undefined) sheet.getRange(rowIndex, 16).setValue(payload.activity   || ''); // O
      if (payload.latency    !== undefined) sheet.getRange(rowIndex, 17).setValue(payload.latency    || ''); // P
      if (payload.awakenings !== undefined) sheet.getRange(rowIndex, 18).setValue(payload.awakenings || ''); // Q
      if (payload.daytime    !== undefined) sheet.getRange(rowIndex, 19).setValue(payload.daytime    || ''); // R
      return { success: true };
    }
    
    throw new Error("수정할 기록을 찾을 수 없습니다.");
  } catch (error) {
    Logger.log('수면 수정 오류: ' + error);
    throw error;
  }
}

// 카페인 데이터 삭제 (실제 행 삭제)
function deleteCaffeineData(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("caffeine");
    
    if (!sheet) {
      throw new Error("카페인 시트를 찾을 수 없습니다.");
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][9]) === String(id)) { // J열: 고유ID
        const rowIndex = i + 1;
        sheet.deleteRow(rowIndex);
        Logger.log(`카페인 기록 삭제 완료: ID=${id}, Row=${rowIndex}`);
        return { success: true };
      }
    }
    
    throw new Error("삭제할 기록을 찾을 수 없습니다.");
  } catch (error) {
    Logger.log('카페인 삭제 오류: ' + error);
    throw error;
  }
}

// 수면 데이터 삭제 (실제 행 삭제)
function deleteSleepData(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("sleep");
    
    if (!sheet) {
      throw new Error("수면 시트를 찾을 수 없습니다.");
    }
    
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][13]) === String(id)) { // N열: 고유ID
        const rowIndex = i + 1;
        sheet.deleteRow(rowIndex);
        Logger.log(`수면 기록 삭제 완료: ID=${id}, Row=${rowIndex}`);
        return { success: true };
      }
    }
    
    throw new Error("삭제할 기록을 찾을 수 없습니다.");
  } catch (error) {
    Logger.log('수면 삭제 오류: ' + error);
    throw error;
  }
}

// 카페인 로그 조회
function getCaffeineLogs(studentId, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("caffeine");
    
    if (!sheet) {
      Logger.log('카페인 시트를 찾을 수 없습니다');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('카페인 데이터가 없습니다');
      return [];
    }
    
    const data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();
    const logs = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowStudentId = String(row[4]).trim(); // E열: 전체학번
      
      if (rowStudentId === normalizeId(studentId)) {
        const intakeTime = row[8]; // I열: 섭취시간
        let timeStr = '';
        
        if (intakeTime instanceof Date) {
          timeStr = Utilities.formatDate(intakeTime, "Asia/Seoul", "yyyy-MM-dd HH:mm:ss");
        } else if (typeof intakeTime === 'string') {
          timeStr = intakeTime;
        }
        
        const dateStr = timeStr.split(' ')[0];
        
        if (startDate && endDate) {
          if (dateStr < startDate || dateStr > endDate) {
            continue;
          }
        }
        
        logs.push({
          id: row[9] || '',                    // J열: 고유ID
          name: row[6] || '',                  // G열: 음료명
          amount: parseFloat(row[7]) || 0,     // H열: 함량
          time: timeStr,
          reason: row[10] || '',              // K열: 섭취이유
          symptom: row[11] || ''              // L열: 부작용 경험
        });
      }
    }
    
    logs.sort((a, b) => {
      const dateA = new Date(a.time);
      const dateB = new Date(b.time);
      return dateB - dateA;
    });
    
    return logs;
  } catch (error) {
    Logger.log('카페인 로그 조회 오류: ' + error);
    return [];
  }
}

// 수면 로그 조회 (강화된 디버깅 버전)
function getSleepLogs(studentId, startDate, endDate) {
  try {
    Logger.log(`=== getSleepLogs 시작 ===`);
    Logger.log(`입력 파라미터:`);
    Logger.log(`  studentId: "${studentId}" (타입: ${typeof studentId})`);
    Logger.log(`  startDate: ${startDate}`);
    Logger.log(`  endDate: ${endDate}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("sleep");
    
    if (!sheet) {
      Logger.log('❌ 수면 시트를 찾을 수 없습니다');
      return [];
    }
    
    const lastRow = sheet.getLastRow();
    Logger.log(`✓ 수면 시트 총 행 수: ${lastRow}`);
    
    if (lastRow <= 1) {
      Logger.log('⚠️ 수면 데이터가 없습니다 (헤더만 존재)');
      return [];
    }
    
    // 모든 데이터 읽기 (A:R, 18개 컬럼)
    const data = sheet.getRange(2, 1, lastRow - 1, 19).getValues();
    Logger.log(`✓ 읽어온 데이터 행 수: ${data.length}`);
    
    const logs = [];
    let matchCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowStudentId = String(row[4]).trim(); // E열: 전체학번
      
      // 모든 행의 학번 출력 (처음 5개만)
      if (i < 5) {
        Logger.log(`Row ${i + 2}: 학번="${rowStudentId}" vs 입력학번="${studentId}"`);
      }
      
      // 학번 비교
      if (rowStudentId === normalizeId(studentId)) {
        matchCount++;
        Logger.log(`  ✓ Row ${i + 2} 매칭됨!`);
        
        const sleepDate = row[6]; // G열: 날짜
        let dateStr = '';
        
        // 날짜 형식 처리
        if (sleepDate instanceof Date) {
          dateStr = Utilities.formatDate(sleepDate, "Asia/Seoul", "yyyy-MM-dd");
          Logger.log(`    날짜(Date): ${dateStr}`);
        } else if (sleepDate) {
          dateStr = String(sleepDate);
          Logger.log(`    날짜(String): ${dateStr}`);
        } else {
          Logger.log(`    ⚠️ 날짜가 비어있음`);
          dateStr = '';
        }
        
        // 날짜 필터링
        if (startDate && endDate) {
          if (dateStr < startDate || dateStr > endDate) {
            Logger.log(`    ⏭️ 날짜 범위 벗어남 (${startDate} ~ ${endDate})`);
            skipCount++;
            continue;
          }
        }
        
        // 시간 데이터 처리
        let startTime = '';
        let endTime = '';
        
        if (row[7] instanceof Date) {
          startTime = Utilities.formatDate(row[7], "Asia/Seoul", "HH:mm");
        } else {
          startTime = String(row[7] || '');
        }
        
        let wakeDateStr = '';
        if (row[8] instanceof Date) {
          wakeDateStr = Utilities.formatDate(row[8], "Asia/Seoul", "yyyy-MM-dd");
        } else {
          wakeDateStr = String(row[8] || '').substring(0, 10);
        }

        if (row[9] instanceof Date) {
          endTime = Utilities.formatDate(row[9], "Asia/Seoul", "HH:mm");
        } else {
          endTime = String(row[9] || '');
        }
        
        // 로그 객체 생성
        const log = {
          id: String(row[13] || ''),           // N: id
          date: dateStr,                       // G열: 날짜
          start: startTime,                    // H열: 취침
          wakeDate: wakeDateStr,
          end: endTime,                        // I열: 기상
          hours: parseFloat(row[10]) || 0,      // J열: 시간
          condition: String(row[11] || ''),    // L: condition
          memo: String(row[12] || ''),         // M: memo
          smartphone: String(row[14] || ''),   // O: smartphone
          activity:   String(row[15] || ''),   // P: activity
          latency:    String(row[16] || ''),   // Q: latency
          awakenings: String(row[17] || ''),   // R: awakenings
          daytime:    String(row[18] || '')    // S: daytime
        };
        
        Logger.log(`    로그 생성: ${JSON.stringify(log)}`);
        logs.push(log);
      }
    }
    
    Logger.log(`\n📊 결과 요약:`);
    Logger.log(`  총 검사한 행: ${data.length}`);
    Logger.log(`  학번 매칭: ${matchCount}개`);
    Logger.log(`  날짜 필터로 제외: ${skipCount}개`);
    Logger.log(`  최종 반환: ${logs.length}개`);
    
    // 날짜 역순 정렬
    logs.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });
    
    Logger.log(`=== getSleepLogs 완료 ===\n`);
    
    return logs;
  } catch (error) {
    Logger.log('❌ 수면 로그 조회 오류: ' + error);
    Logger.log('오류 스택: ' + error.stack);
    return [];
  }
}

// 대시보드 데이터 조회 (사용 안 함 - getStats, getFilteredStats 사용)
function getDashboardData(studentId, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const caffeineSheet = ss.getSheetByName("caffeine");
    const sleepSheet = ss.getSheetByName("sleep");
    
    const dates = [];
    const caffeineData = [];
    const sleepData = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd");
      dates.push(dateStr.substr(5));
      
      let dailyCaffeine = 0;
      let dailySleep = 0;
      
      if (caffeineSheet) {
        const caffeineRows = caffeineSheet.getDataRange().getValues();
        for (let i = 1; i < caffeineRows.length; i++) {
          if (normalizeId(caffeineRows[i][4]) === normalizeId(studentId)) {
            const intakeTime = caffeineRows[i][8]; // I열
            let intakeDateStr;
            if (intakeTime instanceof Date) {
              intakeDateStr = Utilities.formatDate(intakeTime, "Asia/Seoul", "yyyy-MM-dd");
            } else if (typeof intakeTime === 'string') {
              intakeDateStr = intakeTime.split(' ')[0];
            }
            if (intakeDateStr === dateStr) {
              dailyCaffeine += parseFloat(caffeineRows[i][7]) || 0; // H열
            }
          }
        }
      }
      
      if (sleepSheet) {
        const sleepRows = sleepSheet.getDataRange().getValues();
        for (let i = 1; i < sleepRows.length; i++) {
          if (normalizeId(sleepRows[i][4]) === normalizeId(studentId)) {
            const sleepDate = sleepRows[i][6]; // G열
            let sleepDateStr;
            if (sleepDate instanceof Date) {
              sleepDateStr = Utilities.formatDate(sleepDate, "Asia/Seoul", "yyyy-MM-dd");
            } else {
              sleepDateStr = String(sleepDate);
            }
            if (sleepDateStr === dateStr) {
              dailySleep = parseFloat(sleepRows[i][9]) || 0; // J열
            }
          }
        }
      }
      
      caffeineData.push(dailyCaffeine);
      sleepData.push(dailySleep);
    }
    
    return {
      labels: dates,
      caffeineData: caffeineData,
      sleepData: sleepData
    };
  } catch (error) {
    Logger.log('대시보드 데이터 조회 오류: ' + error);
    return {
      labels: [],
      caffeineData: [],
      sleepData: []
    };
  }
}

// 통계 조회 (최근 7일)
function getStats(studentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const caffeineSheet = ss.getSheetByName("caffeine");
    const sleepSheet = ss.getSheetByName("sleep");
    
    const today = getKSTDate();
    
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push(Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd"));
    }
    
    let todayTotal = 0;
    let todayHasRecord = false; // ⭐ 오늘 카페인 기록 존재 여부 (0mg 포함)
    const caffeineByDate = {};
    const caffeineHasByDate = {}; // ⭐ 날짜별 기록 존재 여부
    
    // 카페인 데이터 조회
    if (caffeineSheet) {
      const lastRow = caffeineSheet.getLastRow();
      if (lastRow > 1) {
        const range = caffeineSheet.getRange(2, 5, lastRow - 1, 6); // E:J (학번, 성명, 음료명, 함량, 섭취시간, 고유ID)
        const caffeineData = range.getValues();
        
        for (let i = 0; i < caffeineData.length; i++) {
          if (String(caffeineData[i][0]).trim() === normalizeId(studentId)) { // E열
            const intakeTime = caffeineData[i][4]; // I열
            let dateStr;
            
            if (intakeTime instanceof Date) {
              dateStr = Utilities.formatDate(intakeTime, "Asia/Seoul", "yyyy-MM-dd");
            } else if (typeof intakeTime === 'string') {
              dateStr = intakeTime.split(' ')[0];
            }
            
            const mg = parseFloat(caffeineData[i][3]) || 0; // H열
            
            if (dateStr === today) {
              todayTotal += mg;
              todayHasRecord = true; // ⭐ 0mg 기록도 '기록 있음'으로 처리
            }
            
            if (!caffeineByDate[dateStr]) {
              caffeineByDate[dateStr] = 0;
            }
            caffeineByDate[dateStr] += mg;
            caffeineHasByDate[dateStr] = true; // ⭐ 기록 존재 표시
          }
        }
      }
    }
    
    const sleepByDate = {};
    
    // 수면 데이터 조회
    if (sleepSheet) {
      const lastRow = sleepSheet.getLastRow();
      if (lastRow > 1) {
        const range = sleepSheet.getRange(2, 5, lastRow - 1, 10); // E:M (학번~고유ID)
        const sleepData = range.getValues();
        
        for (let i = 0; i < sleepData.length; i++) {
          if (String(sleepData[i][0]).trim() === normalizeId(studentId)) { // E열
            const date = sleepData[i][2]; // G열
            const hours = parseFloat(sleepData[i][6]) || 0; // J열
            
            let dateStr;
            if (date instanceof Date) {
              dateStr = Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
            } else {
              dateStr = String(date);
            }
            
            sleepByDate[dateStr] = hours;
          }
        }
      }
    }
    
    const caffeineDataArray = dates.map(date => caffeineByDate[date] || 0);
    const caffeineHasDataArray = dates.map(date => caffeineHasByDate[date] || false); // ⭐ 날짜별 기록 존재 여부
    const sleepDataArray = dates.map(date => sleepByDate[date] || 0);
    
    const labels = dates.map(date => {
      const parts = date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });
    
    return {
      todayTotal: todayTotal,
      todayHasRecord: todayHasRecord, // ⭐ 오늘 기록 존재 여부 (0mg 포함)
      labels: labels,
      caffeineData: caffeineDataArray,
      caffeineHasData: caffeineHasDataArray, // ⭐ 날짜별 기록 존재 여부
      sleepData: sleepDataArray
    };
  } catch (error) {
    Logger.log('통계 조회 오류: ' + error);
    Logger.log('오류 상세: ' + error.stack);
    return {
      todayTotal: 0,
      labels: [],
      caffeineData: [],
      sleepData: []
    };
  }
}

// 필터링된 통계 조회
function getFilteredStats(studentId, endDateStr) {
  try {
    Logger.log(`=== getFilteredStats 시작 ===`);
    Logger.log(`학번: ${studentId}, 종료일: ${endDateStr}`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const caffeineSheet = ss.getSheetByName("caffeine");
    const sleepSheet = ss.getSheetByName("sleep");
    
    const endDate = new Date(endDateStr);
    const endDateFormatted = Utilities.formatDate(endDate, "Asia/Seoul", "yyyy-MM-dd");
    
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      dates.push(Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd"));
    }
    
    Logger.log(`조회 기간: ${dates[0]} ~ ${dates[dates.length-1]}`);
    
    let selectedDayTotal = 0;
    const caffeineByDate = {};
    const caffeineHasByDate = {}; // ⭐ 날짜별 기록 존재 여부 (0mg 포함)
    
    // 카페인 데이터 조회
    if (caffeineSheet) {
      const lastRow = caffeineSheet.getLastRow();
      if (lastRow > 1) {
        const range = caffeineSheet.getRange(2, 5, lastRow - 1, 6);
        const caffeineData = range.getValues();
        
        let matchCount = 0;
        for (let i = 0; i < caffeineData.length; i++) {
          if (String(caffeineData[i][0]).trim() === normalizeId(studentId)) {
            const intakeTime = caffeineData[i][4];
            let dateStr;
            
            if (intakeTime instanceof Date) {
              dateStr = Utilities.formatDate(intakeTime, "Asia/Seoul", "yyyy-MM-dd");
            } else if (typeof intakeTime === 'string') {
              dateStr = intakeTime.split(' ')[0];
            }
            
            const mg = parseFloat(caffeineData[i][3]) || 0;
            
            if (dateStr === endDateFormatted) {
              selectedDayTotal += mg;
            }
            
            if (!caffeineByDate[dateStr]) {
              caffeineByDate[dateStr] = 0;
            }
            caffeineByDate[dateStr] += mg;
            caffeineHasByDate[dateStr] = true; // ⭐ 기록 존재 표시 (0mg 포함)
            matchCount++;
          }
        }
        Logger.log(`카페인 데이터 매칭: ${matchCount}건`);
      }
    }
    
    const sleepByDate = {};
    
    // 수면 데이터 조회
    if (sleepSheet) {
      const lastRow = sleepSheet.getLastRow();
      if (lastRow > 1) {
        const range = sleepSheet.getRange(2, 5, lastRow - 1, 10);
        const sleepData = range.getValues();
        
        let matchCount = 0;
        for (let i = 0; i < sleepData.length; i++) {
          if (String(sleepData[i][0]).trim() === normalizeId(studentId)) {
            const date = sleepData[i][2];
            const hours = parseFloat(sleepData[i][6]) || 0;
            
            let dateStr;
            if (date instanceof Date) {
              dateStr = Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd");
            } else {
              dateStr = String(date);
            }
            
            sleepByDate[dateStr] = hours;
            matchCount++;
          }
        }
        Logger.log(`수면 데이터 매칭: ${matchCount}건`);
      }
    }
    
    const caffeineDataArray = dates.map(date => caffeineByDate[date] || 0);
    const caffeineHasDataArray = dates.map(date => caffeineHasByDate[date] || false); // ⭐ 날짜별 기록 존재 여부
    const sleepDataArray = dates.map(date => sleepByDate[date] || 0);
    
    const labels = dates.map(date => {
      const parts = date.split('-');
      return `${parts[1]}/${parts[2]}`;
    });
    
    const result = {
      todayTotal: selectedDayTotal,
      labels: labels,
      caffeineData: caffeineDataArray,
      caffeineHasData: caffeineHasDataArray, // ⭐ 날짜별 기록 존재 여부
      sleepData: sleepDataArray
    };
    
    Logger.log(`결과: todayTotal=${selectedDayTotal}, 카페인 데이터=${caffeineDataArray.length}개, 수면 데이터=${sleepDataArray.length}개`);
    Logger.log(`=== getFilteredStats 완료 ===`);
    
    return result;
  } catch (error) {
    Logger.log('필터링된 통계 조회 오류: ' + error);
    Logger.log('오류 상세: ' + error.stack);
    return {
      todayTotal: 0,
      labels: [],
      caffeineData: [],
      caffeineHasData: [], // ⭐ 날짜별 기록 존재 여부
      sleepData: []
    };
  }
}

// ============================================
// 디버깅: 현재 코드 상태 확인용
// ============================================

/**
 * 이 함수를 실행하여 현재 코드가 올바르게 수정되었는지 확인하세요
 * 실행 방법: 상단 함수 선택 → debugCurrentCode 선택 → 실행(▶) 클릭
 */
function debugCurrentCode() {
  Logger.log('🔍 ===== 코드 상태 진단 시작 =====');
  
  // 1. getWeeklyDetailedData 함수 테스트
  Logger.log('\n📝 테스트 1: getWeeklyDetailedData 함수');
  try {
    const testResult = getWeeklyDetailedData('1101'); // 학번 예시
    
    Logger.log('반환 타입: ' + typeof testResult);
    
    if (typeof testResult === 'string') {
      Logger.log('❌❌❌ 치명적 오류: 문자열로 반환됨!');
      Logger.log('❌ 코드가 수정되지 않았습니다!');
      Logger.log('❌ 최종_정리_코드.gs 파일의 getWeeklyDetailedData 함수로 교체 필요');
    } else if (typeof testResult === 'object') {
      Logger.log('✅ 객체로 반환됨 (정상)');
      Logger.log('✅ recordedDays: ' + testResult.recordedDays);
      Logger.log('✅ totalDays: ' + testResult.totalDays);
      
      if (testResult.recordedDays !== undefined) {
        Logger.log('✅✅✅ 코드가 올바르게 수정됨!');
      } else {
        Logger.log('❌ recordedDays가 없음 - 수정 실패');
      }
    }
  } catch (error) {
    Logger.log('❌ 함수 실행 오류: ' + error);
  }
  
  // 2. generateAIHealthReport 함수 확인
  Logger.log('\n📝 테스트 2: generateAIHealthReport 함수 시그니처 확인');
  const funcString = generateAIHealthReport.toString();
  
  if (funcString.includes('recordedDays < 3')) {
    Logger.log('✅ 데이터 부족 체크 코드 있음');
  } else {
    Logger.log('❌ 데이터 부족 체크 코드 없음 - 수정 필요');
  }
  
  if (funcString.includes('getInsufficientDataMessage')) {
    Logger.log('✅ 데이터 부족 메시지 함수 호출 있음');
  } else {
    Logger.log('❌ 데이터 부족 메시지 함수 호출 없음 - 수정 필요');
  }
  
  Logger.log('\n🔍 ===== 코드 상태 진단 완료 =====');
  Logger.log('\n📋 결과 요약:');
  Logger.log('위 로그를 확인하여:');
  Logger.log('- ✅가 모두 표시되면: 코드 수정 완료, 웹앱 재배포 필요');
  Logger.log('- ❌가 하나라도 있으면: 코드 재수정 필요');
}

// ============================================
// 주간 상세 데이터 수집 (카페인/수면 개별 카운트)
// ============================================

function getWeeklyDetailedData(studentId, startDate, endDate) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const caffeineSheet = ss.getSheetByName("caffeine");
    const sleepSheet = ss.getSheetByName("sleep");
    
    // ⭐ 날짜 배열 생성: startDate/endDate 지정 시 해당 기간, 없으면 오늘 기준 최근 7일
    const dates = [];
    if (startDate && endDate) {
      // 교사가 선택한 조회 기간 사용
      const start = new Date(startDate + 'T00:00:00+09:00');
      const end   = new Date(endDate   + 'T00:00:00+09:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(Utilities.formatDate(new Date(d), "Asia/Seoul", "yyyy-MM-dd"));
      }
      Logger.log(`📅 교사 지정 기간 사용: ${startDate} ~ ${endDate} (${dates.length}일)`);
    } else {
      // 기본: 오늘 기준 최근 7일 (학생용)
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(Utilities.formatDate(date, "Asia/Seoul", "yyyy-MM-dd"));
      }
      Logger.log(`📅 기본 기간 사용: 최근 7일`);
    }
    
    Logger.log(`\n========================================`);
    Logger.log(`=== 📋 주간 데이터 수집 시작 ===`);
    Logger.log(`========================================`);
    Logger.log(`🔍 검색 학번: "${studentId}" (타입: ${typeof studentId})`);
    Logger.log(`📅 분석 기간: ${dates[0]} ~ ${dates[dates.length-1]}`);
    
    // 시트 데이터 전체 확인
    if (caffeineSheet) {
      const caffeineData = caffeineSheet.getDataRange().getValues();
      Logger.log(`\n☕ 카페인 시트 총 ${caffeineData.length - 1}개 행`);
      
      // 처음 3개 행의 학번 샘플 출력
      Logger.log(`   샘플 데이터 (처음 3행):`);
      for (let i = 1; i < Math.min(4, caffeineData.length); i++) {
        const rowId = normalizeId(caffeineData[i][4]);
        Logger.log(`     Row ${i + 1}: 학번="${rowId}" ${rowId === normalizeId(studentId) ? '✅ 일치!' : ''}`);
      }
    }
    
    if (sleepSheet) {
      const sleepData = sleepSheet.getDataRange().getValues();
      Logger.log(`\n😴 수면 시트 총 ${sleepData.length - 1}개 행`);
      
      // 처음 3개 행의 학번 샘플 출력
      Logger.log(`   샘플 데이터 (처음 3행):`);
      for (let i = 1; i < Math.min(4, sleepData.length); i++) {
        const rowId = normalizeId(sleepData[i][4]);
        Logger.log(`     Row ${i + 1}: 학번="${rowId}" ${rowId === normalizeId(studentId) ? '✅ 일치!' : ''}`);
      }
    }
    
    let details = "\n";
    let recordedDays = 0;
    let caffeineRecordedDays = 0;
    let sleepRecordedDays = 0;
    let overCaffeineDays = [];
    
    Logger.log(`\n📊 일별 데이터 수집:`);
    
    dates.forEach(date => {
      let caffeine = 0;
      let sleep = 0;
      let hasCaffeineRecord = false;
      let hasSleepRecord = false;
      let caffeineMatchCount = 0;
      let sleepMatchCount = 0;
      
      // ⭐ 카페인 데이터 수집 (날짜 변환 로직 개선) ⭐
      if (caffeineSheet) {
        const caffeineData = caffeineSheet.getDataRange().getValues();
        for (let i = 1; i < caffeineData.length; i++) {
          const rowStudentId = normalizeId(caffeineData[i][4]);
          const searchStudentId = normalizeId(studentId);
          
          if (rowStudentId === searchStudentId) {
            const intakeTime = caffeineData[i][8];
            let dateStr = "";
            
            if (intakeTime instanceof Date) {
              dateStr = Utilities.formatDate(intakeTime, "Asia/Seoul", "yyyy-MM-dd");
            } else if (typeof intakeTime === 'string') {
              dateStr = intakeTime.split(' ')[0];
            } else if (intakeTime) {
              try {
                const tempDate = new Date(intakeTime);
                dateStr = Utilities.formatDate(tempDate, "Asia/Seoul", "yyyy-MM-dd");
              } catch (e) {
                Logger.log(`   ⚠️ 날짜 변환 실패: ${intakeTime}`);
                continue;
              }
            }
            
            if (dateStr === date) {
              const amount = parseFloat(caffeineData[i][7]) || 0;
              caffeine += amount;
              hasCaffeineRecord = true;
              caffeineMatchCount++;
            }
          }
        }
      }
      
      // ⭐ 수면 데이터 수집 (날짜 변환 로직 개선) ⭐
      if (sleepSheet) {
        const sleepData = sleepSheet.getDataRange().getValues();
        for (let i = 1; i < sleepData.length; i++) {
          const rowStudentId = normalizeId(sleepData[i][4]);
          const searchStudentId = normalizeId(studentId);
          
          if (rowStudentId === searchStudentId) {
            const sleepDate = sleepData[i][6];
            let dateStr = "";
            
            if (sleepDate instanceof Date) {
              dateStr = Utilities.formatDate(sleepDate, "Asia/Seoul", "yyyy-MM-dd");
            } else if (typeof sleepDate === 'string') {
              dateStr = sleepDate.trim().split(' ')[0];
            } else if (sleepDate) {
              try {
                const tempDate = new Date(sleepDate);
                dateStr = Utilities.formatDate(tempDate, "Asia/Seoul", "yyyy-MM-dd");
              } catch (e) {
                Logger.log(`   ⚠️ 날짜 변환 실패: ${sleepDate}`);
                continue;
              }
            }
            
            if (dateStr === date) {
              const hours = parseFloat(sleepData[i][10]) || 0;
              sleep = hours;
              hasSleepRecord = true;
              sleepMatchCount++;
            }
          }
        }
      }
      
      if (hasCaffeineRecord) caffeineRecordedDays++;
      if (hasSleepRecord) sleepRecordedDays++;
      if (hasCaffeineRecord || hasSleepRecord) recordedDays++;
      
      const dayName = ['일','월','화','수','목','금','토'][new Date(date).getDay()];
      
      // overCaffeineDays: 0mg 기록 포함 (기록된 날 전체 - AI가 0mg 구별 가능하도록)
      if (hasCaffeineRecord) overCaffeineDays.push({date: date, mg: caffeine});
      
      // 일별 상세 텍스트: 0mg 기록 vs 미기록 명확히 구별
      let caffeineStr;
      if (!hasCaffeineRecord) {
        caffeineStr = '카페인 미기록';
      } else if (caffeine === 0) {
        caffeineStr = '카페인 0mg (카페인 섭취 안 함 기록 ✓)';
      } else {
        caffeineStr = `카페인 ${caffeine}mg ✓`;
      }
      
      const sleepStr = hasSleepRecord ? `수면 ${sleep}h ✓` : '수면 미기록';
      const detailLine = `${date.substr(5)}(${dayName}): ${caffeineStr}, ${sleepStr}`;
      details += detailLine + '\n';
      
      Logger.log(`   ${detailLine} (카페인 ${caffeineMatchCount}건, 수면 ${sleepMatchCount}건)`);
    });
    
    Logger.log(`\n========================================`);
    Logger.log(`📈 최종 결과:`);
    Logger.log(`   - 전체 기록: ${recordedDays}/7일`);
    Logger.log(`   - ☕ 카페인 기록: ${caffeineRecordedDays}/7일`);
    Logger.log(`   - 😴 수면 기록: ${sleepRecordedDays}/7일`);
    Logger.log(`========================================\n`);
    
    return {
      details: details,
      recordedDays: recordedDays,
      caffeineRecordedDays: caffeineRecordedDays,
      sleepRecordedDays: sleepRecordedDays,
      totalDays: 7,
      overCaffeineDays: overCaffeineDays
    };
  } catch (error) {
    Logger.log('❌ 주간 데이터 수집 오류: ' + error);
    Logger.log('스택 추적: ' + error.stack);
    return {
      details: "",
      recordedDays: 0,
      caffeineRecordedDays: 0,
      sleepRecordedDays: 0,
      totalDays: 7
    };
  }
}


// ============================================
// AI 건강 리포트 생성 (카페인/수면 개별 체크)
// ============================================

function generateAIHealthReport(studentId, name, weekCaffeineTotal, avgCaffeine, avgSleep, weight, limit) {
  Logger.log('\n\n========================================');
  Logger.log('=== AI 건강 리포트 생성 시작 ===');
  Logger.log('========================================');
  Logger.log(`👤 학생 정보:`);
  Logger.log(`   - 이름: ${name}`);
  Logger.log(`   - 학번: ${studentId} (타입: ${typeof studentId})`);
  Logger.log(`\n📊 프론트엔드에서 전달받은 통계 (참고용):`);
  Logger.log(`   - 주간 카페인 총량: ${weekCaffeineTotal}mg`);
  Logger.log(`   - 일평균 카페인: ${avgCaffeine}mg`);
  Logger.log(`   - 평균 수면: ${avgSleep}시간`);
  Logger.log(`   - 체중: ${weight}kg`);
  Logger.log(`   - 일일 권장량: ${limit}mg`);

  // API 호출 여부와 무관하게 실제 기록일을 보존해 규칙 기반 분석에 사용한다.
  let caffeineRecordedDays = 0;
  let sleepRecordedDays = 0;
  let overCaffeineDays = [];
  let recordedDays = 0;
  
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    const hasApiKey = !!apiKey;

    if (hasApiKey) {
      Logger.log(`\n✓ API 키 확인 완료`);
    } else {
      Logger.log("ℹ️ API 키 없음 → 규칙 기반 분석으로 진행");
    }
    Logger.log(`\n🔍 스프레드시트에서 학번 ${studentId}의 실제 데이터 조회 중...`);
    
    // 주간 데이터 수집
    const weeklyData = getWeeklyDetailedData(studentId);
    const weeklyDetails = weeklyData.details;
    recordedDays = weeklyData.recordedDays;
    caffeineRecordedDays = weeklyData.caffeineRecordedDays;
    sleepRecordedDays = weeklyData.sleepRecordedDays;
    overCaffeineDays = weeklyData.overCaffeineDays || [];
    
    Logger.log('✓ 주간 데이터 수집 완료');
    Logger.log(`⭐⭐⭐ 카페인: ${caffeineRecordedDays}일, 수면: ${sleepRecordedDays}일`);
    
    // ⭐⭐⭐ 서버에서 직접 통계 재계산 ⭐⭐⭐
    Logger.log(`\n🔄 서버에서 실제 통계 재계산 중...`);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const caffeineSheet = ss.getSheetByName("caffeine");
    const sleepSheet = ss.getSheetByName("sleep");
    
    // 최근 7일 날짜 범위
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 6);
    
    let realWeekCaffeineTotal = 0;
    let realWeekSleepTotal = 0;
    let realSleepDays = 0;
    
    // 카페인 데이터 수집
    if (caffeineSheet) {
      const caffeineData = caffeineSheet.getDataRange().getValues();
      for (let i = 1; i < caffeineData.length; i++) {
        if (normalizeId(caffeineData[i][4]) === normalizeId(studentId)) {
          const intakeTime = caffeineData[i][8];
          if (intakeTime instanceof Date) {
            const intakeDate = new Date(intakeTime);
            if (intakeDate >= sevenDaysAgo && intakeDate <= today) {
              const amount = parseFloat(caffeineData[i][7]) || 0;
              realWeekCaffeineTotal += amount;
            }
          }
        }
      }
    }
    
    // 수면 데이터 수집
    if (sleepSheet) {
      const sleepData = sleepSheet.getDataRange().getValues();
      for (let i = 1; i < sleepData.length; i++) {
        if (normalizeId(sleepData[i][4]) === normalizeId(studentId)) {
          const sleepDate = sleepData[i][6];
          if (sleepDate instanceof Date) {
            const dateObj = new Date(sleepDate);
            if (dateObj >= sevenDaysAgo && dateObj <= today) {
              const hours = parseFloat(sleepData[i][10]) || 0;
              realWeekSleepTotal += hours;
              realSleepDays++;
            }
          }
        }
      }
    }
    
    const realAvgSleep = realSleepDays > 0 ? (realWeekSleepTotal / realSleepDays) : 0;
    const realAvgCaffeine = realWeekCaffeineTotal / 7;
    
    Logger.log(`\n📊 서버에서 계산한 실제 통계:`);
    Logger.log(`   - 카페인 총량: ${realWeekCaffeineTotal}mg`);
    Logger.log(`   - 카페인 평균: ${realAvgCaffeine.toFixed(0)}mg/일`);
    Logger.log(`   - 수면 총량: ${realWeekSleepTotal.toFixed(1)}시간`);
    Logger.log(`   - 수면 평균: ${realAvgSleep.toFixed(1)}시간 (${realSleepDays}일)`);
    
    // ⭐⭐⭐ 실제 계산된 값으로 변수 교체 ⭐⭐⭐
    weekCaffeineTotal = realWeekCaffeineTotal;
    avgCaffeine = realAvgCaffeine;
    avgSleep = realAvgSleep;
    
    Logger.log(`\n✅ 통계 재계산 완료 - 실제 값으로 업데이트됨`);
    
    // 개별 체크: 카페인·수면 둘 다 3일 미만일 때만 분석 불가 (하나라도 3일 이상이면 진행)
    if (caffeineRecordedDays < 3 && sleepRecordedDays < 3) {
      Logger.log(`⚠️⚠️⚠️ 데이터 부족 → AI 분석 건너뛰기`);
      Logger.log(`  카페인: ${caffeineRecordedDays}/3일 ${caffeineRecordedDays >= 3 ? '✅' : '❌'}`);
      Logger.log(`  수면: ${sleepRecordedDays}/3일 ${sleepRecordedDays >= 3 ? '✅' : '❌'}`);
      
      return {
        success: true,
        analysis: getInsufficientDataMessage(
          recordedDays, 
          weeklyData.totalDays, 
          avgCaffeine, 
          avgSleep, 
          caffeineRecordedDays, 
          sleepRecordedDays
        ),
        source: 'InsufficientData',
        recordedDays: recordedDays
      };
    }

    if (!hasApiKey) {
      Logger.log('📗 규칙 기반 분석 반환 (카페인 ' + caffeineRecordedDays + '일 / 수면 ' + sleepRecordedDays + '일)');
      return {
        success: true,
        analysis: getStructuredFallbackAnalysis(
          avgCaffeine, avgSleep, limit, weekCaffeineTotal,
          caffeineRecordedDays, sleepRecordedDays, 7, overCaffeineDays
        ),
        source: 'Rule',
        recordedDays: recordedDays
      };
    }
    
Logger.log('✅✅✅ 데이터 충분 → AI 분석 진행');

const modelName = "gemini-2.0-flash";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

const todayStr = Utilities.formatDate(new Date(), "Asia/Seoul", "MM/dd");
const overDaysText = overCaffeineDays && overCaffeineDays.length > 0
  ? overCaffeineDays.map(d => d.date.substr(5) + ': ' + d.mg + 'mg' + (d.mg > limit ? ' [!초과]' : '')).join('\n')
  : '없음';

const prompt = `너는 친근한 건강 코치야. 아래 데이터를 보고 학생에게 짧고 핵심만 담아 한국어로 말해줘.

[데이터]
이름: ${name} | 기준일: ${todayStr}
카페인 평균: ${Math.round(avgCaffeine)}mg/일 (권장량 ${limit}mg) | 기록: ${caffeineRecordedDays}/7일
수면 평균: ${avgSleep.toFixed(1)}h | 기록: ${sleepRecordedDays}/7일
권장량 초과일: ${overDaysText}
일별: ${weeklyDetails}

[출력 형식 — 반드시 이 구조 그대로]
${name}님 건강 한줄평 (${todayStr})
[칭찬 또는 격려 한 문장. 이모지 1개]

☕ 카페인
[1~2문장. 평균 ${Math.round(avgCaffeine)}mg과 권장량 ${limit}mg 비교. 초과일 있으면 날짜·수치 언급. 없으면 칭찬.]

😴 수면
[1~2문장. 평균 ${avgSleep.toFixed(1)}h와 권장 8~10h 비교.${sleepRecordedDays < 3 ? ` 수면 기록이 ${sleepRecordedDays}일뿐임을 언급하고 더 기록 권장.` : ''}]

💡 오늘부터 해봐요
1. [구체적 실천 팁 — 예: "오후 2시 이후 카페인 금지"]
2. [구체적 실천 팁]

[규칙] 문장 끝 ~요/~세요/~네요. 숫자는 데이터와 정확히 일치. 총 10줄 이내. 추가 설명 금지.`;

const payload = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 600,   // 간결한 학생용 분석
    candidateCount: 1,
    stopSequences: []
  },
  safetySettings: [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
  ]
};

const options = {
  method: "post",
  contentType: "application/json",
  payload: JSON.stringify(payload),
  muteHttpExceptions: true
};

Logger.log('🚀 Gemini API 호출 중...');

try {
  const fetchResult   = fetchWithRetry(apiUrl, options, 3);
  const fetchResponse = fetchResult.response;
  const fetchErrCode  = fetchResult.errorCode;

  if (!fetchResponse || fetchResponse.getResponseCode() !== 200) {
    const errInfo = getApiErrorInfo(fetchErrCode || 'UNKNOWN_ERROR');
    Logger.log('❌ API 호출 실패: ' + (fetchErrCode || 'UNKNOWN_ERROR'));
    throw new Error('[' + (fetchErrCode || 'UNKNOWN_ERROR') + '] ' + errInfo.desc);
  }

  const responseCode = fetchResponse.getResponseCode();
  const responseText = fetchResponse.getContentText();

  if (responseCode === 200) {
    const result = JSON.parse(responseText);
    const candidate = result.candidates[0];
    const finishReason = candidate.finishReason;
    
    Logger.log(`📊 생성 완료 이유: ${finishReason}`);
    
    const analysis = candidate.content.parts[0].text.trim();
    
    // ⭐⭐⭐ 문장 완성도 체크 ⭐⭐⭐
    const lastChar = analysis.slice(-1);
    const completeEndings = ['.', '!', '?', '요', '다', '까', '죠', '네', '세요', '니다', '습니다'];
    const isComplete = completeEndings.some(ending => analysis.endsWith(ending));
    
    // ⭐⭐⭐ 토큰 제한 또는 미완성 문장 체크 ⭐⭐⭐
    if (finishReason === "MAX_TOKENS" || !isComplete || analysis.length < 100) {
      Logger.log('⚠️⚠️⚠️ AI 분석이 완성되지 않음 → 대체 분석으로 전환');
      Logger.log(`사유: ${finishReason}, 완성도: ${isComplete}, 길이: ${analysis.length}자`);
      
      // ⭐ 자동으로 대체 분석으로 전환
      return {
        success:   true,
        analysis:  getStructuredFallbackAnalysis(
          avgCaffeine, avgSleep, limit, weekCaffeineTotal,
          caffeineRecordedDays, sleepRecordedDays, 7, overCaffeineDays
        ),
        source:    'Fallback (AI 미완성)',
        errorCode: 'INCOMPLETE',
        recordedDays: recordedDays
      };
    }

    Logger.log(`✅ AI 분석 성공! (${analysis.length}자)`);
    Logger.log(analysis);

    return {
      success:     true,
      analysis:    analysis,
      source:      'AI',
      recordedDays: recordedDays
    };

  }

} catch (error) {
  Logger.log('❌ AI 분석 실패: ' + error.message);
  Logger.log('→ 대체 분석으로 자동 전환');

  // 오류 메시지에서 errorCode 추출 ([CODE] 형식)
  const ecMatch = error.message.match(/^\[([A-Z_]+)\]/);
  const ec      = ecMatch ? ecMatch[1] : 'UNKNOWN_ERROR';

  return {
    success:   true,
    analysis:  getStructuredFallbackAnalysis(
      avgCaffeine, avgSleep, limit, weekCaffeineTotal,
      caffeineRecordedDays, sleepRecordedDays, 7, overCaffeineDays
    ),
    source:    'Fallback (API 오류)',
    errorCode: ec,
    error:     error.message
  };
}

  } catch (error) {
    Logger.log('❌ AI 분석 실패: ' + error.message);
    const ecMatch = error.message.match(/^\[([A-Z_]+)\]/);
    const ec      = ecMatch ? ecMatch[1] : 'UNKNOWN_ERROR';
    return {
      success:   true,
      analysis:  getStructuredFallbackAnalysis(
        avgCaffeine, avgSleep, limit, weekCaffeineTotal,
        caffeineRecordedDays, sleepRecordedDays, 7, overCaffeineDays
      ),
      source:    'Fallback',
      errorCode: ec,
      error:     error.message
    };
  }
}

// ============================================
// 데이터 부족 메시지 (카페인/수면 개별 표시)
// ============================================

// ============================================
// 데이터 부족 메시지 (깔끔한 최종 버전)
// ============================================

function getInsufficientDataMessage(recordedDays, totalDays, avgCaffeine, avgSleep, caffeineCount, sleepCount) {
  Logger.log('⚠️ 데이터 부족 메시지 생성');
  Logger.log(`카페인: ${caffeineCount}일, 수면: ${sleepCount}일`);

  // 프론트엔드 카드 렌더러가 파싱할 수 있는 구조화된 마커 형식으로 반환
  const cafNeed = Math.max(0, 3 - caffeineCount);
  const slpNeed = Math.max(0, 3 - sleepCount);

  let message = `__INSUFFICIENT__\n`;
  message += `☕:${caffeineCount}:${cafNeed}\n`;
  message += `😴:${sleepCount}:${slpNeed}\n`;
  if (caffeineCount > 0) message += `__CAF_AVG__:${Math.round(avgCaffeine)}\n`;
  if (sleepCount > 0)    message += `__SLP_AVG__:${avgSleep.toFixed(1)}\n`;

  return message;
}

// ============================================
// 대체 분석 메시지 (예시 구조 기반 - ☕ 😴 💪 섹션 형식)
// ============================================

function getStructuredFallbackAnalysis(avgCaffeine, avgSleep, limit, weekTotal, caffeineCount, sleepCount, totalDays, overCaffeineDays) {
  Logger.log('대체 분석 사용 중');
  
  avgCaffeine   = parseFloat(avgCaffeine)  || 0;
  avgSleep      = parseFloat(avgSleep)     || 0;
  limit         = parseFloat(limit)        || 100;
  caffeineCount = parseInt(caffeineCount)  || 0;
  sleepCount    = parseInt(sleepCount)     || 0;
  totalDays     = parseInt(totalDays)      || 7;
  overCaffeineDays = overCaffeineDays      || [];

  // 데이터 부족 시 조기 종료 — 둘 다 3일 미만일 때만 차단
  if (caffeineCount < 3 && sleepCount < 3) {
    return getInsufficientDataMessage(0, 7, avgCaffeine, avgSleep, caffeineCount, sleepCount);
  }

  const todayStr = Utilities.formatDate(new Date(), "Asia/Seoul", "MM/dd");
  let t = "";

  // ── 총평 (기록 성실도 기준 + 격려형) ────────────
  const both7   = caffeineCount === 7 && sleepCount === 7;
  const both5up = caffeineCount >= 5 && sleepCount >= 5;
  const cafLow  = caffeineCount < sleepCount;

  let summary = "";
  if (both7) {
    if (avgCaffeine <= limit && avgSleep >= 8) {
      summary = "이번 주 카페인과 수면을 빠짐없이 기록했네요! 스스로 건강을 잘 관리하고 있는 모습이 정말 멋져요! 🏆";
    } else {
      summary = "이번 주 카페인과 수면을 빠짐없이 기록했네요! 작은 조정만 해도 훨씬 더 좋아질 수 있는 한 주였어요. 💪";
    }
  } else if (both5up) {
    if (avgCaffeine > limit || avgSleep < 8) {
      summary = "이번 주 기록을 꾸준히 남겨줬네요! 작은 조정만 해도 훨씬 더 좋아질 수 있어요. 💪";
    } else {
      summary = "이번 주 기록을 꾸준히 남겨줬네요! 건강 관리도 잘 되고 있어요! 💪";
    }
  } else if (cafLow) {
    summary = "수면 기록을 꾸준히 남겨준 점이 정말 좋아요! 카페인도 함께 기록하면 더 정확한 분석을 받을 수 있어요. 🌿";
  } else if (caffeineCount >= sleepCount) {
    summary = "카페인 기록을 열심히 남겨줬네요! 수면도 함께 기록하면 훨씬 풍부한 분석이 가능해져요. 🌱";
  } else {
    summary = "기록을 시작한 것 자체가 정말 좋은 출발이에요! 앞으로 꾸준히 쌓이면 더 정확한 변화를 볼 수 있어요. 🌱";
  }
  t += summary + "\n\n";

  // ── ☕ 카페인 분석 (격려형) ───────────────────────
  // ⭐ 제목 바로 다음 줄에 일평균 (빈 줄 없이)
  t += "☕ 카페인 분석\n";

  let cafStatus = "";
  if (avgCaffeine === 0 && caffeineCount > 0) cafStatus = "이내 👍";
  else if (avgCaffeine > limit)               cafStatus = "초과 ⚠️";
  else if (avgCaffeine > limit * 0.7)         cafStatus = "근접 💛";
  else                                          cafStatus = "이내 👍";

  // 1번째 줄: 일평균 (제목 바로 다음, 빈 줄 없음)
  t += `- 일평균 ${Math.round(avgCaffeine)}mg / 권장량 ${Math.round(limit)}mg (${cafStatus})\n`;

  // 0mg 기록일 수 계산 (overCaffeineDays는 기록된 모든 날 포함)
  const zeroDays = overCaffeineDays.filter(d => d.mg === 0).length;

  // 실제 권장량 초과일 목록
  const overDays = overCaffeineDays.filter(d => d.mg > limit);

  // ⭐ 2번째 줄: 초과일 경고 (초과일이 1일 이상이면 반드시 표시)
  if (overDays.length > 0) {
    t += `- 이번 주 ${overDays.length}일 권장량을 초과했어요, 카페인 섭취에 주의가 필요해요 ⚠️\n`;
    // 3번째 줄: 최고치 날짜
    const topDay = overDays.reduce((a, b) => a.mg > b.mg ? a : b);
    const dayNames = ['일','월','화','수','목','금','토'];
    const dn = dayNames[new Date(topDay.date).getDay()];
    t += `- ${topDay.date.substr(5)}(${dn}) ${topDay.mg}mg으로 이번 주 가장 높았어요\n`;
  }

  // 격려 한 문장 (0mg 기록일 별도 칭찬)
  if (zeroDays > 0 && avgCaffeine === 0) {
    t += `- 이번 주 ${zeroDays}일은 카페인 없이 보냈어요, 몸을 쉬게 해주는 좋은 선택이었어요! 👏\n`;
  } else if (zeroDays > 0) {
    t += `- ${zeroDays}일은 카페인 없이 보낸 점이 정말 좋아요! 👏\n`;
  } else if (avgCaffeine > limit * 1.5) {
    t += "- 조금씩 줄여가는 과정만으로도 충분히 의미가 있어요!\n";
  } else if (avgCaffeine > limit) {
    t += "- 조금만 줄여도 몸이 훨씬 가벼워질 수 있어요!\n";
  } else if (avgCaffeine > limit * 0.7) {
    t += "- 이 페이스로 조금만 더 조절해가면 완벽해질 거예요!\n";
  } else {
    t += "- 기록된 날 기준으로 안정적인 수준이에요, 이 페이스 그대로 유지해봐요!\n";
  }

  t += "\n";

  // ── 😴 수면 분석 (격려형) ───────────────────────
  t += "😴 수면 분석\n";

  // 수면 기준 설정 로드 (연령대 반영)
  const _slpCfg = getSleepSettings();
  const _slpS = (_slpCfg && _slpCfg.settings) ? _slpCfg.settings : {};
  const slpSevere = _slpS.sleepSevere || 7;
  const slpWarn   = _slpS.sleepWarn   || 8;
  const slpGood   = _slpS.sleepGood   || 10;
  const slpMax    = _slpS.sleepMax    || 11;
  const ageLabel  = _slpS.ageGroup === 'adult' ? '성인' : '청소년';

  // 수면 5단계 판정
  let sleepStatus = "";
  if      (avgSleep >= slpMax)    sleepStatus = "수면 과다 🟣";
  else if (avgSleep > slpGood)    sleepStatus = "적당한 수면 🟡";
  else if (avgSleep >= slpWarn)   sleepStatus = "권장 수면 🟢";
  else if (avgSleep >= slpSevere) sleepStatus = "적당한 수면 🟠";
  else if (avgSleep > 0)          sleepStatus = "수면 부족 🔴";
  else                            sleepStatus = "기록 부족";

  t += `- 평균 ${avgSleep.toFixed(1)}h / 권장 ${slpWarn}~${slpGood}시간 (${sleepStatus})\n`;

  if (avgSleep >= slpMax) {
    t += `- 권장 상한(${slpGood}시간)을 크게 넘는 ${avgSleep.toFixed(1)}시간으로 수면 과다 상태예요 🟣\n`;
    t += "- 일정한 기상 시각을 정해 알람을 맞추고, 낮잠은 20분 이내로 줄여봐요!\n";
  } else if (avgSleep > slpGood) {
    t += `- 권장 수면(${slpGood}시간)보다 조금 더 자고 있지만, 개인차 범위일 수 있어요 🟡\n`;
    t += "- 일정한 기상 시각을 유지하고, 낮잠은 20분 이내로 줄여봐요!\n";
  } else if (avgSleep >= slpWarn) {
    t += "- 권장 수면 시간을 잘 지키고 있어요 🟢\n";
    t += "- 주말에도 현재 리듬을 크게 벗어나지 않으면 더 좋아요!\n";
  } else if (avgSleep >= slpSevere) {
    t += `- 권장 수면 ${slpWarn}시간보다 ${(slpWarn - avgSleep).toFixed(1)}시간 적지만, 개인차 범위일 수 있어요 🟠\n`;
    t += "- 잠을 30분만 더 늘려도 피로가 많이 줄어들 수 있어요!\n";
  } else if (avgSleep > 0) {
    t += `- 평균 ${avgSleep.toFixed(1)}시간으로 수면이 꽤 부족한 편이에요 🔴\n`;
    t += "- 취침 시간을 조금만 앞당겨보면 몸이 한결 가벼워질 거예요!\n";
  } else {
    t += "- 수면 기록을 매일 남기면 더 정확한 분석이 가능해요\n";
    t += "- 잠자리에 들기 전에 오늘 수면 기록 남기는 습관을 들여봐요!\n";
  }

  t += "\n";

  // ── 💪 실천 조언 ──────────────────────────────
  t += "💪 실천 조언\n";

  const overDaysList = overCaffeineDays ? overCaffeineDays.filter(d => d.mg > limit) : [];
  if (overDaysList.length > 0 && avgSleep < slpWarn) {
    t += "1. 취침 시간을 30분만 앞당겨보기\n";
    t += "2. 오후 2시 이후엔 카페인 음료를 무카페인으로 바꿔보기\n";
    t += "3. 음료 고를 때 카페인 함량 라벨 한 번씩 확인해보기";
  } else if (overDaysList.length > 0) {
    t += "1. 오후 2시 이후엔 카페인 음료 대신 물이나 보리차 마시기\n";
    t += "2. 음료 선택 시 카페인 함량 라벨 확인하는 습관 들이기\n";
    t += "3. 취침 1시간 전 스마트폰 사용 줄이기";
  } else if (avgCaffeine > limit * 1.5) {
    t += "1. 하루 카페인 음료를 한 잔 줄여보는 것부터 시작해보기\n";
    t += "2. 오후 시간에는 물이나 우유로 바꿔보기\n";
    t += "3. 취침 시간을 20~30분만 앞당겨보기";
  } else if (avgCaffeine > limit) {
    t += "1. 오후 2시 이후엔 카페인 음료 대신 물이나 보리차 마시기\n";
    t += "2. 음료 선택 시 카페인 함량 한 번씩 확인해보기\n";
    t += "3. 취침 1시간 전 스마트폰 사용 줄이기";
  } else if (avgSleep > 10) {
    t += "1. 매일 같은 시각에 일어나는 것부터 시작해보기 (알람 활용!)\n";
    t += "2. 낮잠은 20분 이내로 줄여서 밤 수면의 질 높이기\n";
    t += "3. 지금의 좋은 카페인 습관은 그대로 유지하기";
  } else if (avgSleep < 7) {
    t += "1. 취침 시간을 20~30분만 앞당겨보기\n";
    t += "2. 주중과 주말 취침 시간을 1시간 이내로 맞춰보기\n";
    t += "3. 잠들기 전 10분 스트레칭 해보기";
  } else if (avgSleep < 8) {
    t += "1. 취침 시간을 30분만 앞당겨보기\n";
    t += "2. 주말에도 현재 리듬을 크게 벗어나지 않기\n";
    t += "3. 취침 1시간 전 스마트폰 사용 줄이기";
  } else {
    t += "1. 지금의 좋은 카페인·수면 습관을 계속 이어가보기\n";
    t += "2. 주말에도 현재 리듬을 크게 벗어나지 않기\n";
    t += "3. 물을 하루 1.5L 이상 마시며 수분 균형도 챙겨보기";
  }

  return t;
}

// API 키 설정 함수
// ✅ 사용법: Apps Script 편집기 → 프로젝트 설정 → 스크립트 속성에서
//           속성 이름: GEMINI_API_KEY, 값: 본인의 Gemini API 키를 직접 입력하세요.
//           이 함수는 키 저장 여부를 확인하는 용도로만 사용합니다.
function setGeminiAPIKey() {
  // ⚠️ 보안상 API 키를 코드에 직접 입력하지 마세요.
  // Apps Script 편집기 → 프로젝트 설정(⚙️) → 스크립트 속성 탭에서
  // 속성: GEMINI_API_KEY / 값: 발급받은 Gemini API 키 를 직접 등록하세요.
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!apiKey) {
    Logger.log("❌ API 키가 스크립트 속성에 설정되지 않았습니다.");
    Logger.log("   Apps Script → 프로젝트 설정 → 스크립트 속성에서 GEMINI_API_KEY를 추가하세요.");
    return;
  }
  Logger.log("✅ API 키 확인 완료: " + apiKey.substring(0, 15) + "...");
  Logger.log("✅ 모델: Gemini 2.5 Flash");
}

// API 키 확인 함수
function checkGeminiAPIKey() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");

  if (apiKey) {
    Logger.log("✅ API 키가 설정되어 있습니다");
    Logger.log("키: " + apiKey.substring(0, 15) + "...");
    Logger.log("길이: " + apiKey.length + " 문자");
  } else {
    Logger.log("❌ API 키가 설정되지 않았습니다!");
    Logger.log("setGeminiAPIKey() 함수를 먼저 실행하세요");
  }
}

// ============================================
// 뱃지 연속 기록 기준 설정
// ============================================
function getBadgeThresholds() {
  try {
    const props = PropertiesService.getScriptProperties();
    return {
      success: true,
      habitStart:     parseInt(props.getProperty('BADGE_HABIT_DAYS')   || '3'),
      streak:         parseInt(props.getProperty('BADGE_STREAK_DAYS')  || '7'),
      monthly:        parseInt(props.getProperty('BADGE_MONTHLY_DAYS') || '10'),
      habitStartName: props.getProperty('BADGE_HABIT_NAME')   || '습관의 시작',
      streakName:     props.getProperty('BADGE_STREAK_NAME')  || '꾸준한 습관',
      monthlyName:    props.getProperty('BADGE_MONTHLY_NAME') || '챌린지 달성'
    };
  } catch(e) {
    return {
      success: false, error: e.message,
      habitStart: 3, streak: 7, monthly: 10,
      habitStartName: '습관의 시작', streakName: '꾸준한 습관', monthlyName: '챌린지 달성'
    };
  }
}

function saveBadgeThresholds(habitStart, streak, monthly, habitStartName, streakName, monthlyName) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BADGE_HABIT_DAYS',   String(parseInt(habitStart) || 3));
    props.setProperty('BADGE_STREAK_DAYS',  String(parseInt(streak)     || 7));
    props.setProperty('BADGE_MONTHLY_DAYS', String(parseInt(monthly)    || 10));
    if (habitStartName !== undefined) props.setProperty('BADGE_HABIT_NAME',   String(habitStartName).trim() || '습관의 시작');
    if (streakName     !== undefined) props.setProperty('BADGE_STREAK_NAME',  String(streakName).trim()     || '꾸준한 습관');
    if (monthlyName    !== undefined) props.setProperty('BADGE_MONTHLY_NAME', String(monthlyName).trim()    || '챌린지 달성');
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// 수면 기준 설정 (연령대별: 청소년/성인)
// ============================================

function getSleepSettings() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('SLEEP_SETTINGS');
    if (raw) return { success: true, settings: JSON.parse(raw) };
    return { success: true, settings: { ageGroup: 'teen', sleepSevere: 7, sleepWarn: 8, sleepGood: 10, sleepMax: 11 } };
  } catch(e) {
    return { success: false, error: e.message, settings: { ageGroup: 'teen', sleepSevere: 7, sleepWarn: 8, sleepGood: 10, sleepMax: 11 } };
  }
}

function saveSleepSettings(settings) {
  try {
    PropertiesService.getScriptProperties().setProperty('SLEEP_SETTINGS', JSON.stringify(settings));
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Teacher message attachments / PDF delivery
// Later declarations intentionally replace the earlier message functions.
// ---------------------------------------------------------------------------
function ensureTeacherMessageSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('teacher_messages');
  const headers = [
    'timestamp', 'studentId', 'studentName', 'title', 'content',
    'readStatus', 'readTime', 'studentReply', 'studentReplyTime', 'studentReplyRead',
    'attachmentName', 'attachmentUrl', 'attachmentType'
  ];
  if (!sheet) {
    sheet = ss.insertSheet('teacher_messages');
    sheet.appendRow(headers);
    return sheet;
  }
  const width = sheet.getLastColumn();
  if (width < headers.length) {
    sheet.getRange(1, width + 1, 1, headers.length - width).setValues([headers.slice(width)]);
  }
  return sheet;
}

function formatTeacherMsgDate_(value) {
  if (!value) return '';
  return value instanceof Date
    ? Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
    : String(value);
}

function readTeacherMessageRow_(row, rowIndex, includeStudent) {
  const item = {
    rowIndex: rowIndex,
    timestamp: formatTeacherMsgDate_(row[0]),
    title: String(row[3] || ''),
    content: String(row[4] || ''),
    readStatus: String(row[5] || '미읽음'),
    readTime: formatTeacherMsgDate_(row[6]),
    studentReply: String(row[7] || ''),
    studentReplyTime: formatTeacherMsgDate_(row[8]),
    studentReplyRead: String(row[9] || ''),
    attachmentName: String(row[10] || ''),
    attachmentUrl: String(row[11] || ''),
    attachmentType: String(row[12] || '')
  };
  if (includeStudent) {
    item.studentId = String(row[1] || '');
    item.studentName = String(row[2] || '');
  }
  return item;
}

function sendTeacherMessage(data) {
  try {
    const sheet = ensureTeacherMessageSheet_();
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      ts,
      String(data.studentId),
      String(data.studentName),
      String(data.title),
      String(data.content),
      '미읽음',
      '',
      '',
      '',
      '',
      String(data.attachmentName || ''),
      String(data.attachmentUrl || ''),
      String(data.attachmentType || '')
    ]);
    return { success: true };
  } catch (err) {
    Logger.log('sendTeacherMessage error: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Teacher message attachments / PDF delivery
// Final declarations override the earlier message functions above.
// ---------------------------------------------------------------------------
function ensureTeacherMessageSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('teacher_messages');
  const headers = [
    'timestamp', 'studentId', 'studentName', 'title', 'content',
    'readStatus', 'readTime', 'studentReply', 'studentReplyTime', 'studentReplyRead',
    'attachmentName', 'attachmentUrl', 'attachmentType'
  ];
  if (!sheet) {
    sheet = ss.insertSheet('teacher_messages');
    sheet.appendRow(headers);
    return sheet;
  }
  const width = sheet.getLastColumn();
  if (width < headers.length) {
    sheet.getRange(1, width + 1, 1, headers.length - width).setValues([headers.slice(width)]);
  }
  return sheet;
}

function formatTeacherMsgDate_(value) {
  if (!value) return '';
  return value instanceof Date
    ? Utilities.formatDate(value, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss')
    : String(value);
}

function readTeacherMessageRow_(row, rowIndex, includeStudent) {
  const item = {
    rowIndex: rowIndex,
    timestamp: formatTeacherMsgDate_(row[0]),
    title: String(row[3] || ''),
    content: String(row[4] || ''),
    readStatus: String(row[5] || '미읽음'),
    readTime: formatTeacherMsgDate_(row[6]),
    studentReply: String(row[7] || ''),
    studentReplyTime: formatTeacherMsgDate_(row[8]),
    studentReplyRead: String(row[9] || ''),
    attachmentName: String(row[10] || ''),
    attachmentUrl: String(row[11] || ''),
    attachmentType: String(row[12] || '')
  };
  if (includeStudent) {
    item.studentId = String(row[1] || '');
    item.studentName = String(row[2] || '');
  }
  return item;
}

function sendTeacherMessage(data) {
  try {
    const sheet = ensureTeacherMessageSheet_();
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      ts,
      String(data.studentId),
      String(data.studentName),
      String(data.title),
      String(data.content),
      '미읽음',
      '',
      '',
      '',
      '',
      String(data.attachmentName || ''),
      String(data.attachmentUrl || ''),
      String(data.attachmentType || '')
    ]);
    return { success: true };
  } catch (err) {
    Logger.log('sendTeacherMessage error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function getSentTeacherMessages() {
  try {
    const sheet = ensureTeacherMessageSheet_();
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      result.push(readTeacherMessageRow_(rows[i], i + 1, true));
    }
    result.reverse();
    return { success: true, data: result };
  } catch (err) {
    Logger.log('getSentTeacherMessages error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function getTeacherMessages(studentId) {
  try {
    const sheet = ensureTeacherMessageSheet_();
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      if (normalizeId(rows[i][1]) === normalizeId(studentId)) {
        result.push(readTeacherMessageRow_(rows[i], i + 1, false));
      }
    }
    result.reverse();
    return { success: true, data: result };
  } catch (err) {
    Logger.log('getTeacherMessages error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function saveTeacherPdfAndSendMessage(data) {
  try {
    if (!data || !data.studentId || !data.studentName || !data.html) {
      throw new Error('PDF 전송 정보가 부족합니다.');
    }
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
    const fileName = String(data.fileName || ('health-report-' + data.studentId + '-' + ts + '.pdf')).replace(/[\\/:*?"<>|]/g, '_');
    const htmlBlob = Utilities.newBlob(String(data.html), 'text/html', fileName.replace(/\.pdf$/i, '.html'));
    const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(fileName);
    const file = DriveApp.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const sheet = ensureTeacherMessageSheet_();
    const msgTs = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      msgTs,
      String(data.studentId),
      String(data.studentName),
      String(data.title || '건강 기록 PDF'),
      String(data.content || '건강 기록 PDF를 확인해 주세요.') + '\n\nPDF 링크: ' + file.getUrl(),
      '미읽음',
      '',
      '',
      '',
      '',
      file.getName(),
      file.getUrl(),
      'pdf'
    ]);
    return { success: true, fileName: file.getName(), fileUrl: file.getUrl(), fileId: file.getId() };

    const msgResult_unused = sendTeacherMessage({
      studentId: data.studentId,
      studentName: data.studentName,
      title: data.title || '건강 기록 PDF',
      content: data.content || '건강 기록 PDF를 확인해 주세요.',
      attachmentName: file.getName(),
      attachmentUrl: file.getUrl(),
      attachmentType: 'pdf'
    });
    if (!msgResult || !msgResult.success) {
      throw new Error((msgResult && msgResult.error) || '메시지 전송에 실패했습니다.');
    }
    return { success: true, fileName: file.getName(), fileUrl: file.getUrl(), fileId: file.getId() };
  } catch (err) {
    Logger.log('saveTeacherPdfAndSendMessage error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function getSentTeacherMessages() {
  try {
    const sheet = ensureTeacherMessageSheet_();
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      result.push(readTeacherMessageRow_(rows[i], i + 1, true));
    }
    result.reverse();
    return { success: true, data: result };
  } catch (err) {
    Logger.log('getSentTeacherMessages error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function getTeacherMessages(studentId) {
  try {
    const sheet = ensureTeacherMessageSheet_();
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      if (normalizeId(rows[i][1]) === normalizeId(studentId)) {
        result.push(readTeacherMessageRow_(rows[i], i + 1, false));
      }
    }
    result.reverse();
    return { success: true, data: result };
  } catch (err) {
    Logger.log('getTeacherMessages error: ' + err.message);
    return { success: false, error: err.message };
  }
}

function saveTeacherPdfAndSendMessage(data) {
  try {
    if (!data || !data.studentId || !data.studentName || !data.html) {
      throw new Error('PDF 전송 정보가 부족합니다.');
    }
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd_HHmmss');
    const fileName = String(data.fileName || ('health-report-' + data.studentId + '-' + ts + '.pdf')).replace(/[\\/:*?"<>|]/g, '_');
    const htmlBlob = Utilities.newBlob(String(data.html), 'text/html', fileName.replace(/\.pdf$/i, '.html'));
    const pdfBlob = htmlBlob.getAs(MimeType.PDF).setName(fileName);
    const file = DriveApp.createFile(pdfBlob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const sheet = ensureTeacherMessageSheet_();
    const msgTs = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      msgTs,
      String(data.studentId),
      String(data.studentName),
      String(data.title || '건강 기록 PDF'),
      String(data.content || '건강 기록 PDF를 확인해 주세요.') + '\n\nPDF 링크: ' + file.getUrl(),
      '미읽음',
      '',
      '',
      '',
      '',
      file.getName(),
      file.getUrl(),
      'pdf'
    ]);
    return { success: true, fileName: file.getName(), fileUrl: file.getUrl(), fileId: file.getId() };

    const msgResult = sendTeacherMessage({
      studentId: data.studentId,
      studentName: data.studentName,
      title: data.title || '건강 기록 PDF',
      content: data.content || '건강 기록 PDF를 확인해 주세요.',
      attachmentName: file.getName(),
      attachmentUrl: file.getUrl(),
      attachmentType: 'pdf'
    });
    if (!msgResult || !msgResult.success) {
      throw new Error((msgResult && msgResult.error) || '메시지 전송에 실패했습니다.');
    }
    return { success: true, fileName: file.getName(), fileUrl: file.getUrl(), fileId: file.getId() };
  } catch (err) {
    Logger.log('saveTeacherPdfAndSendMessage error: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ============================================
// 뱃지 설정 v2 — 연속/누적 타입 지원
// ============================================

/**
 * 뱃지 설정 반환
 * config 형식: {
 *   challengeName: string,
 *   badges: [{ id, type('streak'|'count'), days, name, emoji, color, bg }, ...]
 * }
 */
function getBadgeConfig() {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('BADGE_CONFIG_V2');
    if (raw) {
      return { success: true, config: JSON.parse(raw) };
    }
    // 기본 설정 (구버전 설정값 반영)
    const habitDays   = parseInt(props.getProperty('BADGE_HABIT_DAYS')   || '3');
    const streakDays  = parseInt(props.getProperty('BADGE_STREAK_DAYS')  || '7');
    const monthlyDays = parseInt(props.getProperty('BADGE_MONTHLY_DAYS') || '10');
    const habitName   = props.getProperty('BADGE_HABIT_NAME')   || '습관의 시작';
    const streakName  = props.getProperty('BADGE_STREAK_NAME')  || '꾸준한 습관';
    const monthlyName = props.getProperty('BADGE_MONTHLY_NAME') || '챌린지 달성';
    return {
      success: true,
      config: {
        challengeName: '건강 챌린지',
        badges: [
          { id: 'b1', type: 'streak', days: habitDays,   name: habitName,   emoji: '🌱', color: '#059669', bg: '#ecfdf5' },
          { id: 'b2', type: 'streak', days: streakDays,  name: streakName,  emoji: '🏆', color: '#d97706', bg: '#fffbeb' },
          { id: 'b3', type: 'count',  days: monthlyDays, name: monthlyName, emoji: '🌟', color: '#7c3aed', bg: '#f5f3ff' }
        ]
      }
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

/**
 * 뱃지 설정 저장
 * @param {Object} configJson  { challengeName, badges: [...] }
 */
function saveBadgeConfig(configJson) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BADGE_CONFIG_V2', JSON.stringify(configJson));
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================
// 챌린지 뱃지 설정 v3 — 교사 승인 방식 + 카페인/수면/기간 지원
// ============================================

/**
 * 챌린지 뱃지 설정 v3 반환
 * config 형식: {
 *   challengeName: string,
 *   challengeStart: string (YYYY-MM-DD),
 *   challengeEnd: string (YYYY-MM-DD),
 *   badges: [{ id, name, image, bg, color,
 *              type: 'caffeine'|'sleep'|'both',
 *              method: 'consecutive'|'cumulative',
 *              days }, ...]
 * }
 */
function getChallengeBadgeConfig() {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('BADGE_CONFIG_V3');
    if (raw) {
      return { success: true, config: JSON.parse(raw) };
    }
    // v3 없으면 v2에서 변환 (하위 호환)
    const v2Raw = props.getProperty('BADGE_CONFIG_V2');
    if (v2Raw) {
      const v2 = JSON.parse(v2Raw);
      const v3 = {
        challengeName: v2.challengeName || '건강 챌린지',
        challengeStart: '',
        challengeEnd: '',
        badges: (v2.badges || []).map(function(b) {
          return {
            id: b.id,
            name: b.name,
            image: b.emoji || '🏅',
            bg: b.bg || '#f5f3ff',
            color: b.color || '#7c3aed',
            type: 'caffeine',
            method: b.type === 'streak' ? 'consecutive' : 'cumulative',
            days: b.days || 3
          };
        })
      };
      return { success: true, config: v3 };
    }
    // 기본값 (미설정)
    return {
      success: true,
      config: { challengeName: '', challengeStart: '', challengeEnd: '', badges: [] }
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

/**
 * 챌린지 뱃지 설정 v3 저장
 * @param {Object} config  { challengeName, challengeStart, challengeEnd, badges: [...] }
 */
function saveChallengeBadgeConfig(config) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BADGE_CONFIG_V3', JSON.stringify(config));
    Logger.log('✅ saveChallengeBadgeConfig 저장 완료: ' + config.challengeName);
    return { success: true };
  } catch(e) {
    Logger.log('❌ saveChallengeBadgeConfig 오류: ' + e.message);
    return { success: false, error: e.message };
  }
}

// ── 승인 대기 / 기각 / 수여설정 GAS 동기화 ─────────────────
function getPendingBadges() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('PENDING_BADGES');
    return { success: true, data: raw ? JSON.parse(raw) : [] };
  } catch(e) { return { success: false, error: e.message, data: [] }; }
}
function savePendingBadgesData(data) {
  try {
    PropertiesService.getScriptProperties().setProperty('PENDING_BADGES', JSON.stringify(data));
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
}
function getDismissedBadges() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('DISMISSED_BADGES');
    return { success: true, data: raw ? JSON.parse(raw) : [] };
  } catch(e) { return { success: false, error: e.message, data: [] }; }
}
function saveDismissedBadgesData(data) {
  try {
    PropertiesService.getScriptProperties().setProperty('DISMISSED_BADGES', JSON.stringify(data));
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
}
function getAwardSettings() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty('AWARD_SETTINGS');
    return { success: true, data: raw ? JSON.parse(raw) : null };
  } catch(e) { return { success: false, error: e.message, data: null }; }
}
function saveAwardSettingsData(data) {
  try {
    PropertiesService.getScriptProperties().setProperty('AWARD_SETTINGS', JSON.stringify(data));
    return { success: true };
  } catch(e) { return { success: false, error: e.message }; }
}

// ============================================
// AI 분석 결과 저장/불러오기 (교사가 수정한 내용 → 시트에 보관)
// ============================================
// 컬럼 순서: A=이름, B=학번, C=시작일, D=종료일, E=내용, F=저장일시

function stripHtmlForSheet(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function saveAIReport(studentId, startDate, endDate, content, name) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    let sheet   = ss.getSheetByName('ai_reports');
    if (!sheet) {
      sheet = ss.insertSheet('ai_reports');
      sheet.appendRow(['이름', '학번', '시작일', '종료일', '내용', '저장일시']);
      sheet.setFrozenRows(1);
    }
    const now  = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    const sid  = String(studentId);
    const sname = String(name || '');
    const cleanContent = stripHtmlForSheet(String(content || ''));
    // 기존 행 찾아 덮어쓰기 (학번+시작일+종료일 기준)
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][1]) === sid && String(data[i][2]) === startDate && String(data[i][3]) === endDate) {
        // 이름도 최신화, 내용·저장일시 갱신
        sheet.getRange(i + 1, 1, 1, 6).setValues([[sname, sid, startDate, endDate, cleanContent, now]]);
        return { success: true, action: 'updated' };
      }
    }
    // 없으면 새 행 추가
    sheet.appendRow([sname, sid, startDate, endDate, cleanContent, now]);
    return { success: true, action: 'inserted' };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function getAIReport(studentId, startDate, endDate) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('ai_reports');
    if (!sheet) return { success: true, content: null };
    const sid  = String(studentId);
    const data = sheet.getDataRange().getValues();
    // 헤더가 이름/학번 순인지 학번 순인지 자동 감지
    const isNewFormat = data.length > 0 && String(data[0][0]) === '이름';
    for (let i = data.length - 1; i >= 1; i--) {
      if (isNewFormat) {
        // 새 형식: B=학번(1), C=시작일(2), D=종료일(3), E=내용(4), F=저장일시(5)
        if (String(data[i][1]) === sid && String(data[i][2]) === startDate && String(data[i][3]) === endDate) {
          return { success: true, content: String(data[i][4]), savedAt: String(data[i][5]) };
        }
      } else {
        // 구 형식: A=학번(0), B=시작일(1), C=종료일(2), D=내용(3), E=저장일시(4)
        if (String(data[i][0]) === sid && String(data[i][1]) === startDate && String(data[i][2]) === endDate) {
          return { success: true, content: String(data[i][3]), savedAt: String(data[i][4]) };
        }
      }
    }
    return { success: true, content: null };
  } catch(e) {
    return { success: false, error: e.message, content: null };
  }
}

// 테스트 함수
function testAIAnalysis() {
  const result = generateAIHealthReport(
    "1101",
    "홍길동",
    1050,
    150,
    7.5,
    65,
    100
  );
  Logger.log("=== AI 분석 결과 ===");
  Logger.log("성공 여부: " + result.success);
  Logger.log("분석 내용:\n" + result.analysis);
}

// 수면 로그 테스트 함수
function testSleepLogs() {
  const studentId = "0000";
  Logger.log("=== 수면 로그 테스트 시작 ===");
  Logger.log("학번: " + studentId);
  
  const logs = getSleepLogs(studentId);
  
  Logger.log("=== 결과 ===");
  Logger.log("총 로그 개수: " + logs.length);
  
  if (logs.length > 0) {
    Logger.log("첫 번째 로그:");
    Logger.log(JSON.stringify(logs[0], null, 2));
  } else {
    Logger.log("로그가 없습니다!");
  }
}

// 카페인 로그 테스트 함수
function testCaffeineLogs() {
  const studentId = "1101";
  Logger.log("=== 카페인 로그 테스트 시작 ===");
  Logger.log("학번: " + studentId);
  
  const logs = getCaffeineLogs(studentId);
  
  Logger.log("=== 결과 ===");
  Logger.log("총 로그 개수: " + logs.length);
  
  if (logs.length > 0) {
    Logger.log("첫 번째 로그:");
    Logger.log(JSON.stringify(logs[0], null, 2));
  } else {
    Logger.log("로그가 없습니다!");
  }
}

// ============================================
// 학번 자동 생성 관련 함수
// ============================================

// 수동으로 모든 학생의 학번 생성 (한 번만 실행)
function generateAllStudentIds() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("students");
    
    if (!sheet) {
      Logger.log('students 시트를 찾을 수 없습니다');
      return;
    }
    
    const lastRow = sheet.getLastRow();
    let updateCount = 0;
    
    for (let row = 2; row <= lastRow; row++) {
      const grade = sheet.getRange(row, 1).getValue();    // A: 학년
      const classNum = sheet.getRange(row, 2).getValue(); // B: 반
      const number = sheet.getRange(row, 3).getValue();   // C: 번호
      
      if (grade && classNum && number) {
        const studentId = String(grade) + String(classNum) + String(number).padStart(2, '0');
        sheet.getRange(row, 5).setValue(Number(studentId)); // E: 학번 ID
        updateCount++;
        Logger.log(`${row}행: ${grade}학년 ${classNum}반 ${number}번 → 학번 ${studentId}`);
      }
    }
    
    Logger.log(`총 ${updateCount}개의 학번이 생성되었습니다.`);
  } catch (error) {
    Logger.log('학번 생성 오류: ' + error);
  }
}

// ============================================
// 테스트 함수들
// ============================================

// 연결 테스트
function testConnection() {
  Logger.log('testConnection 호출됨');
  return { 
    success: true, 
    message: 'Google Apps Script 연결 성공!',
    timestamp: new Date().toISOString()
  };
}

// 간단한 객체 저장 테스트
function testSaveSimple(data) {
  Logger.log('=== testSaveSimple 시작 ===');
  Logger.log('받은 데이터 타입: ' + typeof data);
  Logger.log('받은 데이터: ' + JSON.stringify(data));
  
  if (!data) {
    Logger.log('❌ data가 undefined입니다');
    throw new Error('데이터가 전달되지 않았습니다');
  }
  
  if (!data.studentId) {
    Logger.log('❌ data.studentId가 없습니다');
    throw new Error('studentId가 없습니다');
  }
  
  Logger.log('✅ 데이터 검증 성공');
  
  return {
    success: true,
    receivedData: data,
    message: '데이터를 성공적으로 받았습니다'
  };
}

// saveSleepData 디버깅 버전
function saveSleepDataDebug(payload) {
  Logger.log('=== saveSleepDataDebug 시작 ===');
  Logger.log('Arguments 개수: ' + arguments.length);
  Logger.log('payload 타입: ' + typeof payload);
  Logger.log('payload 값: ' + JSON.stringify(payload));
  
  // 각 필드 개별 확인
  const fields = ['studentId', 'name', 'date', 'sleepTime', 'wakeTime', 'hours', 'condition', 'memo', 'id'];
  const report = {};
  
  if (payload) {
    fields.forEach(field => {
      report[field] = {
        exists: payload.hasOwnProperty(field),
        type: typeof payload[field],
        value: payload[field]
      };
    });
  } else {
    report.error = 'payload is null or undefined';
  }
  
  Logger.log('필드 분석: ' + JSON.stringify(report, null, 2));
  
  return {
    success: true,
    analysis: report,
    rawPayload: payload
  };
}

// 수면 저장 단순화 버전 (디버깅용)
function saveSleepDataSimple(studentId, name, date, sleepTime, wakeTime, hours, condition, memo, id) {
  Logger.log('=== saveSleepDataSimple (개별 파라미터) ===');
  Logger.log(`studentId: ${studentId}`);
  Logger.log(`name: ${name}`);
  Logger.log(`date: ${date}`);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("sleep");
  
  if (!sheet) {
    throw new Error("수면 시트를 찾을 수 없습니다.");
  }
  
  const kstTimestamp = getKSTTimestamp();
  const p = parseStudentId(studentId);
  
  sheet.appendRow([
    kstTimestamp,
    p.grade,
    p.class,
    p.number,
    studentId,
    name,
    date,
    sleepTime,
    wakeTime,
    hours,
    condition,
    memo || '',
    id || Date.now()
  ]);
  
  return { success: true, message: '저장 완료' };
}

// ============================================
// 중복 데이터 테스트 함수
// ============================================

// 특정 학번의 수면 데이터 확인
function checkSleepDataForStudent() {
  const testStudentId = "1101";  // 테스트할 학번
  const testDate = "2026-02-14";  // 테스트할 날짜
  
  Logger.log(`=== 수면 데이터 확인: 학번=${testStudentId}, 날짜=${testDate} ===`);
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("sleep");
  
  if (!sheet) {
    Logger.log("❌ sleep 시트 없음");
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  Logger.log(`총 데이터 행 수: ${data.length - 1}`);
  
  let foundCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const rowStudentId = normalizeId(data[i][4]);
    const rowDateRaw = data[i][6];
    
    let rowDate = '';
    if (rowDateRaw instanceof Date) {
      rowDate = Utilities.formatDate(rowDateRaw, "Asia/Seoul", "yyyy-MM-dd");
    } else {
      rowDate = String(rowDateRaw).trim();
    }
    
    if (rowStudentId === testStudentId) {
      Logger.log(`\nRow ${i + 1}:`);
      Logger.log(`  날짜: ${rowDate}`);
      Logger.log(`  취침: ${data[i][7]}`);
      Logger.log(`  기상: ${data[i][8]}`);
      Logger.log(`  시간: ${data[i][9]}시간`);
      Logger.log(`  컨디션: ${data[i][10]}`);
      Logger.log(`  메모: ${data[i][11]}`);
      
      if (rowDate === testDate) {
        Logger.log(`  ⭐ 대상 날짜와 일치!`);
        foundCount++;
      }
    }
  }
  
  Logger.log(`\n${testDate} 날짜의 데이터: ${foundCount}개`);
  if (foundCount > 1) {
    Logger.log(`⚠️ 중복 데이터 발견! ${foundCount}개가 있습니다.`);
  }
}

// 중복 제거 실행
function removeDuplicateSleepData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("sleep");
  
  if (!sheet) {
    Logger.log("❌ sleep 시트 없음");
    return;
  }
  
  Logger.log("=== 중복 데이터 제거 시작 ===");
  
  const data = sheet.getDataRange().getValues();
  const seen = new Set();
  const rowsToDelete = [];
  
  for (let i = data.length - 1; i >= 1; i--) {
    const studentId = normalizeId(data[i][4]);
    const dateRaw = data[i][6];
    
    let date = '';
    if (dateRaw instanceof Date) {
      date = Utilities.formatDate(dateRaw, "Asia/Seoul", "yyyy-MM-dd");
    } else {
      date = String(dateRaw).trim();
    }
    
    const key = `${studentId}-${date}`;
    
    if (seen.has(key)) {
      Logger.log(`중복 발견: Row ${i + 1} - ${key}`);
      rowsToDelete.push(i + 1);
    } else {
      seen.add(key);
    }
  }
  
  Logger.log(`\n삭제할 행 수: ${rowsToDelete.length}`);
  
  // 뒤에서부터 삭제 (인덱스 변화 방지)
  rowsToDelete.forEach(rowIndex => {
    Logger.log(`Row ${rowIndex} 삭제`);
    sheet.deleteRow(rowIndex);
  });
  
  Logger.log("✅ 중복 제거 완료");
}

// ============================================
// AI 이미지 분석 기능 (Gemini Vision API)
// ============================================

// ============================================================
// 공공데이터 포털 식약처 카페인 DB API
// ============================================================

/**
 * 공공데이터 포털 카페인 DB API 키 저장 (최초 1회 실행)
 * Apps Script 편집기에서 직접 실행하세요.
 */
function setCaffeinePublicAPIKey() {
  // ⚠️ 보안상 API 키를 코드에 직접 입력하지 마세요.
  // Apps Script 편집기 → 프로젝트 설정(⚙️) → 스크립트 속성 탭에서
  // 속성: CAFFEINE_PUBLIC_API_KEY / 값: 공공데이터 포털 API 키 를 직접 등록하세요.
  const apiKey = PropertiesService.getScriptProperties().getProperty("CAFFEINE_PUBLIC_API_KEY");
  if (!apiKey) {
    Logger.log("❌ API 키가 스크립트 속성에 설정되지 않았습니다.");
    Logger.log("   Apps Script → 프로젝트 설정 → 스크립트 속성에서 CAFFEINE_PUBLIC_API_KEY를 추가하세요.");
    return;
  }
  Logger.log("✅ 공공데이터 포털 카페인 DB API 키 확인 완료");
}

/**
 * 식품의약품안전처 카페인 함량 DB API 내부 호출
 * @param {string} foodName - 검색할 식품/음료명
 * @param {number} numOfRows - 결과 개수 (기본 10)
 * @returns {Object} { success, data: [{foodName, caffeineAmount, caffeinePerServing, servingSize, maker, category}] }
 */
function searchCaffeineDBAPI(foodName, numOfRows) {
  try {
    numOfRows = numOfRows || 10;
    const apiKey = PropertiesService.getScriptProperties().getProperty("CAFFEINE_PUBLIC_API_KEY");
    if (!apiKey) {
      Logger.log("❌ 공공데이터 API 키 없음 → setCaffeinePublicAPIKey() 실행 필요");
      return { success: false, error: "API 키 미설정", data: [] };
    }

    // 한글 키워드 인코딩
    const encodedName = encodeURIComponent(foodName);
    const url = "https://apis.data.go.kr/B553748/CaffeineInfo/getCaffeineInfo"
      + "?serviceKey=" + apiKey
      + "&type=json"
      + "&pageNo=1"
      + "&numOfRows=" + numOfRows
      + "&food_Nm=" + encodedName;

    Logger.log("📡 공공DB 호출: " + foodName);

    const response = UrlFetchApp.fetch(url, { method: "get", muteHttpExceptions: true });
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log("공공DB 응답코드: " + responseCode);

    if (responseCode !== 200) {
      Logger.log("❌ 공공DB 오류: " + responseText.substring(0, 200));
      return { success: false, error: "API 오류 " + responseCode, data: [] };
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      Logger.log("공공DB JSON 파싱 실패: " + responseText.substring(0, 300));
      return { success: false, error: "응답 파싱 실패", data: [] };
    }

    // 응답 구조: { response: { body: { items: { item: [...] }, totalCount } } }
    const body = parsed && parsed.response && parsed.response.body;
    if (!body) return { success: false, error: "응답 구조 오류", data: [] };

    const totalCount = parseInt(body.totalCount) || 0;
    if (totalCount === 0) {
      Logger.log("공공DB 결과 없음: " + foodName);
      return { success: true, data: [], totalCount: 0 };
    }

    let items = body.items && body.items.item;
    if (!items) return { success: true, data: [], totalCount: 0 };
    if (!Array.isArray(items)) items = [items]; // 1건이면 객체로 옴

    const results = items.map(function(item) {
      const caffeineBase    = parseFloat(item.caffein_Amount         || 0); // 100ml/g 기준 mg
      const caffeineServing = parseFloat(item.caffein_AmountPerServ  || 0); // 1회분 mg
      return {
        foodName:          String(item.food_Nm  || "").trim(),
        caffeineAmount:    caffeineBase,
        caffeinePerServing: caffeineServing,
        servingSize:       String(item.serv_Wt  || "").trim(), // 1회 제공량
        maker:             String(item.comp_Nm  || "").trim(), // 제조사
        category:          String(item.food_Cls || "").trim(), // 식품분류
        reportYear:        String(item.rpt_Yr   || "").trim()  // 보고연도
      };
    });

    Logger.log("✅ 공공DB " + results.length + "건 (전체 " + totalCount + "건)");
    return { success: true, data: results, totalCount: totalCount };

  } catch (error) {
    Logger.log("❌ searchCaffeineDBAPI 오류: " + error);
    return { success: false, error: error.toString(), data: [] };
  }
}

/**
 * 음료명 검색 - Gemini AI 1차 + 식약처 공공DB 2차 병합
 * AI가 폭넓게 먼저 검색, 공공DB 결과가 있으면 앞에 추가
 * @param {string} keyword
 * @returns {Object} { success, results: [{name, caffeine, maker, serving, category, source}] }
 */
function searchDrinkCaffeine(keyword) {
  try {
    if (!keyword || keyword.trim().length < 1) {
      return { success: true, results: [] };
    }
    keyword = keyword.trim();
    Logger.log("검색 키워드: [" + keyword + "]");

    // 1차: Gemini AI 검색 (항상 실행 - 가장 빠르고 넓은 커버리지)
    var aiResults = [];
    try {
      aiResults = searchDrinkCaffeineWithAI(keyword) || [];
      Logger.log("AI 결과: " + aiResults.length + "건");
    } catch (aiErr) {
      Logger.log("AI 검색 오류(무시): " + aiErr);
    }

    // 2차: 식약처 공공DB 검색 (성공하면 앞에 추가)
    var dbResults = [];
    try {
      var dbResult = searchCaffeineDBAPI(keyword, 5);
      if (dbResult && dbResult.success && dbResult.data && dbResult.data.length > 0) {
        Logger.log("공공DB 결과: " + dbResult.data.length + "건");
        dbResults = dbResult.data.map(function(item) {
          var caffeine = item.caffeinePerServing > 0
            ? Math.round(item.caffeinePerServing)
            : Math.round(item.caffeineAmount);
          return {
            name:     item.foodName,
            caffeine: caffeine,
            maker:    item.maker,
            serving:  item.servingSize,
            category: item.category,
            source:   "db"
          };
        });
      }
    } catch (dbErr) {
      Logger.log("공공DB 오류(무시): " + dbErr);
    }

    // DB 결과 먼저, AI 결과 뒤에 (중복 이름 제거)
    var seen = {};
    var merged = [];
    dbResults.forEach(function(item) {
      var key = (item.name || "").replace(/\s/g, "").toLowerCase();
      if (key && !seen[key]) { seen[key] = true; merged.push(item); }
    });
    aiResults.forEach(function(item) {
      var key = (item.name || "").replace(/\s/g, "").toLowerCase();
      if (key && !seen[key]) { seen[key] = true; merged.push(item); }
    });

    Logger.log("최종: " + merged.length + "건 (DB:" + dbResults.length + " AI:" + aiResults.length + ")");
    return { success: true, results: merged, fromDB: dbResults.length > 0 };

  } catch (error) {
    Logger.log("searchDrinkCaffeine 오류: " + error);
    return { success: false, error: error.toString(), results: [] };
  }
}

/**
 * Gemini AI 텍스트 검색 - 한국 시중 음료 카페인 정보 반환
 * @param {string} keyword
 * @returns {Array}
 */
function searchDrinkCaffeineWithAI(keyword) {
  try {
    var apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) {
      Logger.log("Gemini API 키 없음");
      return [];
    }

    var modelName = "gemini-2.0-flash";
    var apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/"
      + modelName + ":generateContent?key=" + apiKey;

    var prompt =
      "당신은 한국 시중 음료의 카페인 함량 전문가입니다.\n"
      + "검색어: \"" + keyword + "\"\n\n"
      + "이 검색어와 관련된 한국 시중 음료 제품을 최대 6개 찾아주세요.\n"
      + "편의점·카페에서 구매 가능한 제품 위주, 브랜드별/용량별 변형도 포함하세요.\n\n"
      + "반드시 아래 JSON 배열 형식만 응답하세요 (설명 없이, 마크다운 없이):\n"
      + "[\n"
      + "  {\n"
      + "    \"name\": \"제품 전체명 (예: 스타벅스 아메리카노 톨 355ml)\",\n"
      + "    \"caffeine\": 카페인mg숫자(1회제공량기준),\n"
      + "    \"maker\": \"브랜드명\",\n"
      + "    \"serving\": \"1회제공량(예: 355ml)\",\n"
      + "    \"category\": \"음료종류(예: 커피음료)\"\n"
      + "  }\n"
      + "]\n\n"
      + "caffeine은 반드시 1회 제공량 기준 mg값. 관련 음료 없으면 [] 반환.";

    var payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 10,
        topP: 0.8,
        maxOutputTokens: 1000
      }
    };

    Logger.log("Gemini 검색 API 호출 (재시도 포함)...");
    var srchFetchResult   = fetchWithRetry(apiUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }, 3);

    var srchFetchResponse = srchFetchResult.response;
    if (!srchFetchResponse || srchFetchResponse.getResponseCode() !== 200) {
      Logger.log("Gemini 검색 실패: " + (srchFetchResult.errorCode || 'UNKNOWN'));
      return [];
    }

    var responseCode = srchFetchResponse.getResponseCode();
    var responseText = srchFetchResponse.getContentText();
    Logger.log("Gemini 응답코드: " + responseCode);

    var result = JSON.parse(responseText);
    if (!result.candidates || result.candidates.length === 0) {
      Logger.log("Gemini 후보 없음");
      return [];
    }

    var aiText = result.candidates[0].content.parts[0].text.trim();
    Logger.log("Gemini 응답 원문: " + aiText.substring(0, 500));

    // 코드블록 마크다운 제거
    aiText = aiText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    var aiData;
    try {
      aiData = JSON.parse(aiText);
    } catch (e) {
      // JSON 배열만 추출 시도
      var match = aiText.match(/\[[\s\S]*\]/);
      if (match) {
        try { aiData = JSON.parse(match[0]); }
        catch (e2) { Logger.log("배열 추출 실패"); return []; }
      } else {
        Logger.log("JSON 파싱 실패: " + aiText.substring(0, 100));
        return [];
      }
    }

    if (!Array.isArray(aiData)) {
      Logger.log("결과가 배열이 아님");
      return [];
    }

    var cleaned = [];
    for (var i = 0; i < aiData.length; i++) {
      var item = aiData[i];
      var name = String(item.name || "").trim();
      if (!name) continue;
      cleaned.push({
        name:     name,
        caffeine: Math.round(Math.max(0, parseFloat(item.caffeine) || 0)),
        maker:    String(item.maker    || "").trim(),
        serving:  String(item.serving  || "").trim(),
        category: String(item.category || "").trim(),
        source:   "ai"
      });
    }

    Logger.log("AI 파싱 완료: " + cleaned.length + "건");
    for (var j = 0; j < cleaned.length; j++) {
      Logger.log("  [" + j + "] " + cleaned[j].name + " | " + cleaned[j].caffeine + "mg");
    }
    return cleaned;

  } catch (error) {
    Logger.log("searchDrinkCaffeineWithAI 오류: " + error);
    Logger.log(error.stack || "");
    return [];
  }
}


/**
 * AI 이미지 분석 + 공공DB 교차검증 (개선버전)
 * Gemini로 제품명/카페인 추출 → 공공DB에서 정확한 값 조회
 */
function analyzeDrinkImageWithAI(base64Image) {
  try {
    Logger.log('=== AI 이미지 분석 시작 (공공DB 교차검증 포함) ===');

    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) {
      Logger.log("❌ Gemini API 키 없음");
      return { success: false, error: "API 키가 설정되지 않았습니다" };
    }

    const modelName = "gemini-2.0-flash";
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + modelName + ":generateContent?key=" + apiKey;

    // Step 1: Gemini 이미지 분석 - 음료/의약품 모두 카페인 성분 직독
    const prompt = "You are an expert at reading Korean product labels, nutrition facts tables, and pharmaceutical ingredient lists.\n\n"
      + "TARGET: Extract caffeine content from ANY product — beverages (음료), energy drinks, coffee, medicine/pharmaceuticals (의약품), supplements.\n\n"
      + "ANALYSIS PRIORITY (in order):\n"
      + "1. PHARMACEUTICAL INGREDIENT LIST (성분/유효성분표): look for '카페인무수물', '카페인(KP)', '카페인수화물', 'Caffeine anhydrous'\n"
      + "   e.g. '카페인무수물(KP) 50mg' → caffeine=50. Read the mg number directly. -> confidence=high, source=label\n"
      + "2. FRONT LABEL caffeine declaration on beverages: '고카페인함유 (NNNmg/캔)', '카페인 NNNmg', 'caffeine NNNmg'\n"
      + "   -> confidence=high, source=label\n"
      + "3. Nutrition facts table (영양성분표 / Nutrition Facts) - read caffeine row directly\n"
      + "   -> confidence=high, source=label\n"
      + "4. If no caffeine number found but product is identified, use product name for DB search\n"
      + "   -> confidence=medium, source=estimate\n"
      + "5. If nothing identifiable, return caffeine=null\n"
      + "   -> confidence=low, source=estimate\n\n"
      + "KNOWN HINTS: Monster Energy 355ml=100mg, Red Bull 250ml=80mg, Starbucks Doubleshot 200ml=108mg\n"
      + "Common OTC caffeine pills (박카스, 타이레놀이엑스 등) contain 30~50mg caffeine per tablet.\n\n"
      + "Respond ONLY with a valid JSON object, no other text:\n"
      + "{\n"
      + "  \"drinkName\": \"Full product name in Korean (e.g. 몬스터에너지 355ml / 타이레놀이엑스 1정)\",\n"
      + "  \"caffeine\": <total caffeine in mg as a number, or null if not found>,\n"
      + "  \"volume\": \"serving size string e.g. 355ml or 1정, or null\",\n"
      + "  \"confidence\": \"high|medium|low\",\n"
      + "  \"source\": \"label|estimate\",\n"
      + "  \"searchKeyword\": \"short 2-3 word Korean keyword (e.g. 몬스터에너지, 타이레놀이엑스)\"\n"
      + "}\n\n"
      + "confidence: high=caffeine mg read directly from label/ingredient list, medium=product identified, low=unknown\n"
      + "source: label=read from text on product, estimate=inferred\n"
      + "IMPORTANT: If caffeine is listed per tablet/capsule in ingredient list, report that value as caffeine.";

    const geminiPayload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: base64Image } }  // ⭐ 프론트에서 항상 JPEG로 압축 변환됨
        ]
      }],
      generationConfig: { temperature: 0.1, topK: 10, topP: 0.8, maxOutputTokens: 400 }
    };

    Logger.log('🔍 Gemini API 호출 (재시도 포함)...');
    const imgFetchResult   = fetchWithRetry(apiUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(geminiPayload),
      muteHttpExceptions: true
    }, 3);

    const imgFetchResponse = imgFetchResult.response;
    const imgErrCode       = imgFetchResult.errorCode;

    if (!imgFetchResponse || imgFetchResponse.getResponseCode() !== 200) {
      const errInfo = getApiErrorInfo(imgErrCode || 'UNKNOWN_ERROR');
      // ⭐ 실제 응답 본문을 로그에 기록 → 400/UNKNOWN_ERROR 원인 파악용
      const errBody = imgFetchResponse ? imgFetchResponse.getContentText().substring(0, 300) : '(응답 없음)';
      Logger.log("❌ 이미지 분석 API 실패: HTTP " + (imgFetchResponse ? imgFetchResponse.getResponseCode() : 'null')
                 + ", errorCode=" + (imgErrCode || 'UNKNOWN_ERROR')
                 + ", body=" + errBody);
      return {
        success:   false,
        error:     errInfo.title + ' — ' + errInfo.desc,
        errorCode: imgErrCode || 'UNKNOWN_ERROR'
      };
    }

    const responseCode = imgFetchResponse.getResponseCode();
    const responseText = imgFetchResponse.getContentText();
    Logger.log("Gemini 응답코드: " + responseCode);

    let geminiResult;
    try {
      geminiResult = JSON.parse(responseText);
    } catch (parseErr) {
      Logger.log("❌ 응답 JSON 파싱 실패: " + responseText.substring(0, 200));
      return { success: false, error: "AI 응답을 해석할 수 없습니다. 다시 시도해주세요.", errorCode: "PARSE_ERROR" };
    }

    // candidates 없는 경우: 이미지 품질 불량, 안전 필터, 할당량 초과 등
    if (!geminiResult.candidates || geminiResult.candidates.length === 0) {
      // promptFeedback 확인 (안전 필터 등)
      const feedback = geminiResult.promptFeedback;
      const blockReason = feedback && feedback.blockReason ? feedback.blockReason : null;
      Logger.log("⚠️ candidates 없음. blockReason=" + blockReason + ", 원문=" + responseText.substring(0, 300));

      if (blockReason === "SAFETY") {
        return { success: false, error: "이미지를 분석할 수 없습니다 (안전 정책).\n음료 라벨/영양성분표 사진을 다시 촬영해주세요.", errorCode: "SAFETY_BLOCK" };
      }
      return { success: false, error: "AI가 이미지를 인식하지 못했습니다.\n📸 사진이 흐리거나 너무 어두우면 다시 촬영해주세요.", errorCode: "NO_CANDIDATES" };
    }

    // finishReason 확인 (MAX_TOKENS, SAFETY 등)
    const finishReason = geminiResult.candidates[0].finishReason;
    if (finishReason === "SAFETY") {
      return { success: false, error: "이미지 분석이 차단되었습니다 (안전 정책).\n음료 라벨 사진을 다시 촬영해주세요.", errorCode: "SAFETY_BLOCK" };
    }
    if (!geminiResult.candidates[0].content || !geminiResult.candidates[0].content.parts) {
      return { success: false, error: "📸 사진이 너무 어둡거나 흐릿합니다. 밝은 곳에서 가까이 다시 촬영해주세요.", errorCode: "EMPTY_CONTENT" };
    }

    let aiText = geminiResult.candidates[0].content.parts[0].text.trim();
    if (aiText.includes("```")) {
      aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    let aiData;
    try {
      aiData = JSON.parse(aiText);
    } catch (e) {
      Logger.log("AI JSON 파싱 실패. aiText=" + aiText.substring(0, 300));
      // AI가 자연어로 답변한 경우 (이미지 품질 불량 등)
      if (aiText.length > 0) {
        const lower = aiText.toLowerCase();
        if (lower.includes("unclear") || lower.includes("blur") || lower.includes("흐") || lower.includes("불분명") || lower.includes("인식")) {
          return { success: false, error: "📸 사진이 흐릿하거나 너무 어둡습니다.\n밝은 곳에서 성분표에 가까이 대고 다시 촬영해주세요.", errorCode: "BLUR_IMAGE" };
        }
      }
      return { success: false, error: "📸 성분표/영양성분표가 잘 보이도록 다시 촬영해주세요.\n(너무 어둡거나 흔들린 경우 재촬영 필요)", errorCode: "PARSE_FAIL" };
    }

    Logger.log("AI 추출: " + JSON.stringify(aiData));

    // ⭐ null 문자열 정규화: AI가 "null" 문자열을 반환하는 경우 빈 문자열로 치환
    function sanitizeNull(v) {
      if (v === null || v === undefined || v === "null" || v === "undefined") return "";
      return String(v).trim();
    }

    const aiDrinkName = sanitizeNull(aiData.drinkName);
    const aiVolume    = sanitizeNull(aiData.volume);

    // ⭐ 음료/식품 아닌 이미지 감지: drinkName이 비어있고 confidence=low → 잘못된 사진
    if (!aiDrinkName && (aiData.confidence === "low" || !aiData.confidence)) {
      Logger.log("⚠️ 제품 인식 실패 (drinkName 없음, confidence=low) → 재촬영 안내");
      return {
        success:   false,
        error:     "음료나 식품 라벨이 인식되지 않았습니다.\n📸 음료의 영양성분표나 성분표가 잘 보이도록 촬영해주세요.",
        errorCode: "NOT_A_DRINK"
      };
    }

    // Step 2: 영양성분표 직독 (high/label) → 공공DB로 제조사 등 부가 정보만 보강
    if (aiData.confidence === "high" && aiData.source === "label" && aiData.caffeine !== null) {
      Logger.log("✅ 영양성분표 직독 완료 - 공공DB 부가정보 조회");
      let makerInfo = "", servingInfo = "";
      if (aiData.searchKeyword) {
        const dbCheck = searchCaffeineDBAPI(aiData.searchKeyword, 3);
        if (dbCheck.success && dbCheck.data.length > 0) {
          const m = dbCheck.data[0];
          if (m.maker) makerInfo = m.maker;
          if (m.servingSize) servingInfo = m.servingSize;
        }
      }
      const caffeine  = parseInt(aiData.caffeine);
      const volumeStr = aiVolume || servingInfo || "";
      return {
        success:    true,
        drinkName:  aiDrinkName || "제품",
        caffeine:   caffeine,
        volume:     volumeStr,
        maker:      makerInfo,
        confidence: "high",
        source:     "label",
        dbVerified: false,
        analysis:   (aiDrinkName || "제품") + " · " + caffeine + "mg"
                    + (volumeStr ? " · " + volumeStr : "")
                    + " (성분표/영양성분표 직접 확인 ✅)"
      };
    }

    // Step 3: 제품명 기반 추정 → 공공DB 교차검증
    const searchTerm = sanitizeNull(aiData.searchKeyword) || aiDrinkName || "";
    if (searchTerm) {
      Logger.log("📡 공공DB 교차검증: " + searchTerm);
      const dbResult = searchCaffeineDBAPI(searchTerm, 5);

      if (dbResult.success && dbResult.data.length > 0) {
        const best      = dbResult.data[0];
        const caffeine  = best.caffeinePerServing > 0
          ? Math.round(best.caffeinePerServing)
          : Math.round(best.caffeineAmount);
        const volumeStr = best.servingSize || aiVolume || "";

        Logger.log("✅ 공공DB 매칭: " + best.foodName + " " + caffeine + "mg");
        return {
          success:    true,
          drinkName:  best.foodName,
          caffeine:   caffeine,
          volume:     volumeStr,
          maker:      best.maker,
          confidence: "high",
          source:     "database",
          dbVerified: true,
          dbInfo:     { maker: best.maker, serving: best.servingSize, category: best.category },
          analysis:   best.foodName + " · " + caffeine + "mg"
                      + (volumeStr ? " · " + volumeStr : "")
                      + (best.maker ? " · " + best.maker : "")
                      + " (식약처 공공DB 확인 ✅)"
        };
      }
      Logger.log("공공DB 결과 없음 → AI 추정값 사용");
    }

    // Step 4: DB도 없음 → AI 추정값 반환 (낮은 신뢰도 안내 포함)
    const aiCaffeine = (aiData.caffeine !== null && aiData.caffeine !== undefined)
      ? parseInt(aiData.caffeine) : 0;
    let warningMsg = (aiData.confidence === "low")
      ? " ⚠️ 추정치 — 성분표가 잘 보이도록 다시 촬영해주세요"
      : " (AI 추정 — 오차 가능)";

    return {
      success:    true,
      drinkName:  aiDrinkName || "알 수 없는 제품",
      caffeine:   aiCaffeine,
      volume:     aiVolume || "",
      maker:      "",
      confidence: aiData.confidence || "low",
      source:     "estimate",
      dbVerified: false,
      analysis:   (aiDrinkName || "알 수 없는 제품") + " · 약 " + aiCaffeine + "mg"
                  + (aiVolume ? " · " + aiVolume : "")
                  + warningMsg
    };

  } catch (error) {
    Logger.log('❌ analyzeDrinkImageWithAI 오류: ' + error);
    Logger.log('스택: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

// ── 공공DB API 연결 테스트 ─────────────────────────────────────
function testCaffeineDBSearch() {
  Logger.log("=== 공공DB 검색 테스트 ===");
  ["아메리카노", "레드불", "몬스터", "콜라"].forEach(function(kw) {
    Logger.log("\n🔍 " + kw);
    const r = searchDrinkCaffeine(kw);
    if (r.success && r.results.length > 0) {
      r.results.forEach(function(item) {
        Logger.log("  ✅ " + item.name + " - " + item.caffeine + "mg" + (item.maker ? " (" + item.maker + ")" : "") + (item.serving ? " / " + item.serving : ""));
      });
    } else {
      Logger.log("  결과 없음: " + JSON.stringify(r));
    }
  });
}

// testImageAnalysis → testCaffeineDBSearch 로 통합됨 (위의 새 함수 참조)

// ============================================
// Gemini API 키 설정 함수
// ============================================

/**
 * Gemini API 키 설정
 * ✅ 사용법: Apps Script 편집기 → 프로젝트 설정(⚙️) → 스크립트 속성 탭에서
 *           속성 이름: GEMINI_API_KEY, 값: 발급받은 Gemini API 키를 직접 입력하세요.
 *           이 함수는 키 등록 여부를 확인하는 용도로 사용합니다.
 */
function setGeminiAPIKey() {
  // ⚠️ 보안상 API 키를 코드에 직접 입력하지 마세요.
  // Apps Script → 프로젝트 설정 → 스크립트 속성에서 GEMINI_API_KEY를 등록하세요.
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty("GEMINI_API_KEY");

  if (!apiKey) {
    Logger.log("❌ API 키가 스크립트 속성에 설정되지 않았습니다!");
    Logger.log("   Apps Script → 프로젝트 설정 → 스크립트 속성에서 GEMINI_API_KEY를 추가하세요.");
    return;
  }
  Logger.log("✅ Gemini API 키가 설정되어 있습니다!");
  Logger.log("확인된 키: " + apiKey.substring(0, 10) + "...");
  Logger.log("모델: Gemini 2.5 Flash");
}

/**
 * 현재 설정된 API 키 확인
 */
function checkGeminiAPIKey() {
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty("GEMINI_API_KEY");
  
  if (apiKey) {
    Logger.log("✅ API 키가 설정되어 있습니다");
    Logger.log("키 앞부분: " + apiKey.substring(0, 15) + "...");
    Logger.log("키 길이: " + apiKey.length + " 문자");
  } else {
    Logger.log("❌ API 키가 설정되지 않았습니다");
    Logger.log("setGeminiAPIKey() 함수를 먼저 실행하세요");
  }
}

/**
 * API 키 삭제 (필요시)
 */
function deleteGeminiAPIKey() {
  PropertiesService.getScriptProperties()
    .deleteProperty("GEMINI_API_KEY");
  
  Logger.log("🗑️ API 키가 삭제되었습니다");
}

function testWithRealStudentId() {
  Logger.log('=== 실제 학번으로 테스트 ===');
  
  // 여기에 실제 사용 중인 학번 입력
  const realStudentId = '0'; // 또는 본인의 실제 학번
  
  const result = getWeeklyDetailedData(realStudentId);
  
  Logger.log('학번: ' + realStudentId);
  Logger.log('반환 타입: ' + typeof result);
  Logger.log('recordedDays: ' + result.recordedDays);
  Logger.log('totalDays: ' + result.totalDays);
  
  if (result.recordedDays > 0) {
    Logger.log('✅✅✅ 데이터 있음! 정상 작동!');
  } else {
    Logger.log('⚠️ 이 학번에는 데이터가 없습니다');
    Logger.log('스프레드시트에서 데이터가 있는 학번을 확인하세요');
  }
}
// ============================================================
// 교사용 모니터링 대시보드 추가 함수
// 기존 Code.gs 파일 맨 아래에 붙여넣으세요.
// ============================================================

/**
 * GitHub Pages에서 오는 fetch() 요청을 받아 처리하는 API 게이트웨이
 * 요청 형식: POST { action: "함수명", params: [...인자배열] }
 */
function doPost(e) {
  try {
    // ── 요청 파싱 ────────────────────────────────────────────
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("요청 데이터가 없습니다.");
    }

    const body = JSON.parse(e.postData.contents);
    const action = body.action;   // 호출할 GAS 함수명
    const params = body.params || [];  // 인자 배열

    Logger.log('=== doPost API 요청 ===');
    Logger.log('action: ' + action);
    Logger.log('params: ' + JSON.stringify(params));

    // ── 허용된 함수 화이트리스트 ────────────────────────────
    // 외부에서 호출 가능한 함수만 명시적으로 허용 (보안)
    const ALLOWED_ACTIONS = {
      // 인증
      'checkLogin': checkLogin,

      // 카페인 데이터
      'saveCaffeineData': saveCaffeineData,
      'getCaffeineLogs': getCaffeineLogs,
      'deleteCaffeineData': deleteCaffeineData,
      'updateCaffeineData': updateCaffeineData,

      // 수면 데이터
      'saveSleepData': saveSleepData,
      'getSleepLogs': getSleepLogs,
      'deleteSleepData': deleteSleepData,
      'updateSleepData': updateSleepData,

      // 체중 / 초기설정
      'saveWeightData': saveWeightData,
      'getWeightData': getWeightData,
      'saveInitialSetup': saveInitialSetup,

      // 통계
      'getStats': getStats,

      // 뱃지 (교사→학생)
      'getTeacherAwardsForStudent': getTeacherAwardsForStudent,

      // 문의
      'submitInquiry': submitInquiry,
      'getMyInquiries': getMyInquiries,

      // 교사→학생 메시지
      'sendTeacherMessage': sendTeacherMessage,
      'saveTeacherPdfAndSendMessage': saveTeacherPdfAndSendMessage,
      'getSentTeacherMessages': getSentTeacherMessages,
      'getTeacherMessages': getTeacherMessages,
      'markTeacherMessageRead': markTeacherMessageRead,
      'deleteTeacherMessage': deleteTeacherMessage,
      'deleteBulkTeacherMessages': deleteBulkTeacherMessages,
      'replyToTeacherMessage': replyToTeacherMessage,
      'getUnreadStudentReplies': getUnreadStudentReplies,
      'markStudentReplyRead': markStudentReplyRead,
      // AI 수면 메모 단어 분류
      'analyzeSleepMemoWords': analyzeSleepMemoWords,

      // 카페인 DB
      'getCaffeineDB': getCaffeineDB,

      // 교사용 (별도 허용)
      'getTeacherData': getTeacherData,
      'handleAIReportForTeacher': handleAIReportForTeacher,
      'grantTeacherAwards': grantTeacherAwards,
      'revokeTeacherAward': revokeTeacherAward,
      'getInquiries': getInquiries,
      'replyToInquiry': replyToInquiry,
      'deleteInquiry': deleteInquiry,
      'getUnreadInquiries': getUnreadInquiries,
      'markInquiryNotified': markInquiryNotified,
      'exportDataToNewSheet': exportDataToNewSheet,
      // 뱃지 임계값 (구버전 호환)
      'getBadgeThresholds': getBadgeThresholds,
      'saveBadgeThresholds': saveBadgeThresholds,
      // 뱃지 설정 v2 (연속/누적 타입 지원)
      'getBadgeConfig': getBadgeConfig,
      'saveBadgeConfig': saveBadgeConfig,
      // 뱃지 설정 v3 (챌린지 교사 승인 방식)
      'getChallengeBadgeConfig': getChallengeBadgeConfig,
      'saveChallengeBadgeConfig': saveChallengeBadgeConfig,
      // 승인 대기 / 기각 / 수여설정 GAS 동기화
      'getPendingBadges': getPendingBadges,
      'savePendingBadgesData': savePendingBadgesData,
      'getDismissedBadges': getDismissedBadges,
      'saveDismissedBadgesData': saveDismissedBadgesData,
      'getAwardSettings': getAwardSettings,
      'saveAwardSettingsData': saveAwardSettingsData,
      'saveAIReport': saveAIReport,
      'getAIReport': getAIReport,
      // 수면 기준 설정 (연령대)
      'getSleepSettings': getSleepSettings,
      'saveSleepSettings': saveSleepSettings,
    };

    if (!ALLOWED_ACTIONS[action]) {
      throw new Error("허용되지 않은 action: " + action);
    }

    // ── 함수 실행 ────────────────────────────────────────────
    const fn = ALLOWED_ACTIONS[action];
    let result;

    // params 배열의 원소 수에 따라 인자 전달
    if (params.length === 0) {
      result = fn();
    } else if (params.length === 1) {
      result = fn(params[0]);
    } else if (params.length === 2) {
      result = fn(params[0], params[1]);
    } else {
      result = fn(...params);
    }

    Logger.log('doPost 결과: ' + JSON.stringify(result));

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('❌ doPost 오류: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 교사용 전체 데이터 조회
 * students / caffeine / sleep / info 시트 전체 반환
 *
 * 시트 컬럼 구조:
 *   students : A=학년, B=반, C=번호, D=이름, E=학번
 *   caffeine : A=타임스탬프, B=학년, C=반, D=번호, E=전체학번,
 *              F=성명, G=음료명, H=함량, I=섭취시간, J=고유ID
 *   sleep    : A=타임스탬프, B=학년, C=반, D=번호, E=전체학번,
 *              F=성명, G=날짜, H=취침, I=기상, J=시간,
 *              K=수면 후 컨디션, L=메모, M=고유ID
 *   info     : A=타임스탬프, B=학년, C=반, D=번호, E=성명,
 *              F=전체학번, G=몸무게
 */
// 비수치 학번(교직원·교생)의 고유 ID 생성.
// 새 형식("교직원_이름")은 그대로, 구 형식("교직원")은 "_이름" 접미사 추가.
function makeTeacherUniqueId(rawId, name) {
  if (/^\d+$/.test(rawId)) return rawId;           // 숫자 학번은 그대로
  const suffix = '_' + String(name || '').trim();
  return rawId.endsWith(suffix) ? rawId : rawId + suffix;
}

function getTeacherData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── students ─────────────────────────────────────
    const studSheet = ss.getSheetByName('students');
    if (!studSheet) throw new Error('students 시트를 찾을 수 없습니다');
    const studRaw = studSheet.getDataRange().getValues();
    const students = [];

    for (let i = 1; i < studRaw.length; i++) {
      const r = studRaw[i];
      const rawId = String(r[4]).trim();
      if (!rawId || rawId === 'undefined') continue;
      // ※ 테스트 계정(학번=0) 제외하려면 아래 주석 해제
      // if (rawId === '0') continue;
      const studName = String(r[3] || '');
      // 교직원·교생 등 비수치 학번은 "학번_이름" 복합키로 고유화
      const id = makeTeacherUniqueId(rawId, studName);
      students.push({
        학번: id,
        이름: studName,
        학년: String(parseInt(r[0]) || ''),
        반:   String(parseInt(r[1]) || ''),
        번호: String(parseInt(r[2]) || '')
      });
    }

    // ── caffeine ─────────────────────────────────────
    const cafSheet = ss.getSheetByName('caffeine');
    if (!cafSheet) throw new Error('caffeine 시트를 찾을 수 없습니다');
    const cafLastRow = cafSheet.getLastRow();
    const caffeine = [];

    if (cafLastRow > 1) {
      const cafRaw = cafSheet.getRange(2, 1, cafLastRow - 1, 12).getValues();
      for (let i = 0; i < cafRaw.length; i++) {
        const r = cafRaw[i];
        const cafRawId = String(r[4]).trim();  // E열: 전체학번
        if (!cafRawId || cafRawId === 'undefined') continue;
        const cafName = String(r[5] || '');    // F열: 성명
        // 교직원·교생 등 비수치 학번은 "학번_이름" 복합키
        const id = makeTeacherUniqueId(cafRawId, cafName);

        // I열: 섭취시간 → "yyyy-MM-dd HH:mm:ss" 형식
        const intakeTime = r[8];
        let timeStr = '';
        if (intakeTime instanceof Date) {
          timeStr = Utilities.formatDate(intakeTime, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
        } else {
          timeStr = String(intakeTime || '');
        }

        caffeine.push({
          학번:   id,
          음료명:  String(r[6] || ''),   // G열
          함량:   parseFloat(r[7]) || 0, // H열
          섭취시간: timeStr,
          이유:   String(r[10] || ''),   // K열
          부작용: String(r[11] || '')    // L열
        });
      }
    }

    // ── sleep ─────────────────────────────────────────
    const sleepSheet = ss.getSheetByName('sleep');
    if (!sleepSheet) throw new Error('sleep 시트를 찾을 수 없습니다');
    const sleepLastRow = sleepSheet.getLastRow();
    const sleep = [];

    if (sleepLastRow > 1) {
      const sleepRaw = sleepSheet.getRange(2, 1, sleepLastRow - 1, 19).getValues();
      for (let i = 0; i < sleepRaw.length; i++) {
        const r = sleepRaw[i];
        const sleepRawId = String(r[4]).trim();  // E열: 전체학번
        if (!sleepRawId || sleepRawId === 'undefined') continue;
        const sleepName = String(r[5] || '');    // F열: 성명
        // 교직원·교생 등 비수치 학번은 "학번_이름" 복합키
        const id = makeTeacherUniqueId(sleepRawId, sleepName);

        // G열: 날짜 → "yyyy-MM-dd"
        const dateVal = r[6];
        const wakeDateVal = r[8];
        let dateStr = '';
        let wakeDateStr = '';
        if (dateVal instanceof Date) {
          dateStr = Utilities.formatDate(dateVal, 'Asia/Seoul', 'yyyy-MM-dd');
        } else {
          dateStr = String(dateVal || '').substring(0, 10);
        }
        if (wakeDateVal instanceof Date) {
          wakeDateStr = Utilities.formatDate(wakeDateVal, 'Asia/Seoul', 'yyyy-MM-dd');
        } else {
          wakeDateStr = String(wakeDateVal || '').substring(0, 10);
        }

        // H열: 취침, I열: 기상 → "HH:mm" 형식
        function toHHMM(val) {
          if (!val) return '';
          if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Seoul', 'HH:mm');
          const m = String(val).match(/^(\d{1,2}):(\d{2})/);
          return m ? m[1].padStart(2, '0') + ':' + m[2] : String(val);
        }

        sleep.push({
          학번:           id,
          날짜:           dateStr,
          wakeDate:       wakeDateStr,
          취침:           toHHMM(r[7]),          // H열
          기상:           toHHMM(r[9]),          // I열
          시간:           parseFloat(r[10]) || 0, // J열
          '수면 후 컨디션': String(r[11] || ''),  // K열
          메모:           String(r[12] || ''),   // L열
          스마트폰:        String(r[14] || ''),   // N열
          활동:           String(r[15] || ''),   // O열
          잠들기:          String(r[16] || ''),   // P열
          각성:           String(r[17] || ''),   // Q열
          낮졸림:          String(r[18] || '')    // R열
        });
      }
    }

    // ── info (몸무게) ─────────────────────────────────
    const infoSheet = ss.getSheetByName('info');
    if (!infoSheet) throw new Error('info 시트를 찾을 수 없습니다');
    const infoRaw = infoSheet.getDataRange().getValues();
    const info = [];
    const seenInfo = new Set();
    function toInfoHHMM(val) {
      if (!val) return '';
      if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Seoul', 'HH:mm');
      const m = String(val).match(/^(\d{1,2}):(\d{2})/);
      return m ? m[1].padStart(2, '0') + ':' + m[2] : String(val);
    }

    for (let i = 1; i < infoRaw.length; i++) {
      const r = infoRaw[i];
      const id = String(r[5]).trim();  // F열: 전체학번
      if (!id || id === '' || id === 'undefined') continue;
      if (seenInfo.has(id)) continue;  // 중복 제거 (최초 기록 사용)
      seenInfo.add(id);
      info.push({
        학번: id,
        몸무게: parseFloat(r[6]) || 60,        // G열: 몸무게
        목표카페인: parseFloat(r[7]) || null,  // H열: 목표 카페인
        목표취침: toInfoHHMM(r[8]),           // I열: 목표 취침
        목표기상: toInfoHHMM(r[9])            // J열: 목표 기상
      });
    }

    Logger.log(`✅ getTeacherData 완료: 학생 ${students.length}명, 카페인 ${caffeine.length}건, 수면 ${sleep.length}건, 체중 ${info.length}건`);

    // ── teacher_awards (교사 수여 뱃지) ─────────────────
    // 교사 앱 localStorage를 GAS 시트 기준으로 동기화하기 위해 함께 반환
    const manualAwards = {}; // { [studentId]: [ awardObj, ... ] }
    try {
      const awardSheet = ss.getSheetByName('teacher_awards');
      if (awardSheet && awardSheet.getLastRow() > 1) {
        const awardData  = awardSheet.getDataRange().getValues();
        // ⭐ 헤더 컬럼 수로 신규/구버전 판단 (학번 길이에 무관 → 학번 0도 정상 처리)
        const totalCols2 = awardData[0] ? awardData[0].length : 0;
        // ⭐ 포맷 판단: 컬럼 수가 아닌 B열(index1) 헤더값으로 구분
        // 신규(12+열): B열='학년' → E열(index4)=학번, G열(index6)=awardId
        // 구버전( 9열): B열='studentid' → B열(index1)=학번, C열(index2)=awardId
        const hdr1_2 = String(awardData[0][1] || '').toLowerCase();
        const isNew2 = (totalCols2 >= 12) && (hdr1_2 === '학년' || hdr1_2 === 'grade');
        Logger.log('getTeacherData - 뱃지 포맷: ' + (isNew2 ? '신규(12+열)' : '구버전') + ', 컬럼=' + totalCols2 + ', B헤더="' + hdr1_2 + '"');

        for (let i = 1; i < awardData.length; i++) {
          const row = awardData[i];
          const ts  = _tsToStr_(row[0]);
          const sid = isNew2 ? normalizeId(row[4]) : normalizeId(row[1]);
          if (!sid) continue; // 학번 없는 행 스킵

          if (!manualAwards[sid]) manualAwards[sid] = [];
          manualAwards[sid].push({
            grantedAt : ts,
            awardId   : isNew2 ? String(row[6]  || '') : String(row[2] || ''),
            name      : isNew2 ? String(row[7]  || '') : String(row[3] || ''),
            image     : isNew2 ? String(row[8]  || '🏅') : String(row[4] || '🏅'),
            bg        : isNew2 ? String(row[9]  || '#f5f3ff') : String(row[5] || '#f5f3ff'),
            color     : isNew2 ? String(row[10] || '#7c3aed') : String(row[6] || '#7c3aed'),
            message   : isNew2 ? String(row[11] || '') : String(row[7] || ''),
            grantedBy : isNew2 ? String(row[12] || '') : String(row[8] || '')
          });
        }
        Logger.log('getTeacherData - 뱃지 로드 완료: ' + Object.keys(manualAwards).length + '명');
      }
    } catch (awardErr) {
      Logger.log('⚠️ teacher_awards 로드 실패 (계속 진행): ' + awardErr);
    }

    return {
      success      : true,
      students     : students,
      caffeine     : caffeine,
      sleep        : sleep,
      info         : info,
      manualAwards : manualAwards  // ⭐ 교사 앱 localStorage 동기화용
    };

  } catch (err) {
    Logger.log('❌ getTeacherData 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용 AI 건강분석 요청 처리
 * ⭐ 학생용과 별도로 생활기록부 소견 스타일 전용 프롬프트 사용
 */
function handleAIReportForTeacher(payload) {
  try {
    const studentId  = payload.studentId;
    const name       = payload.name;
    const weight     = payload.weight || 60;
    const limit      = payload.limit  || 150;
    const cafData    = payload.caffeineData || {};
    const sleepDataP = payload.sleepData    || {};

    // ⭐ 생활 패턴 추가 데이터 (teacher_21 이후 프론트에서 전달)
    const topReasons   = cafData.topReasons   || '데이터 없음';
    const topSymptoms  = cafData.topSymptoms  || '없음';
    const symptomRate  = cafData.symptomRate  != null ? cafData.symptomRate  : null;
    const topPhone     = sleepDataP.topPhone   || '데이터 없음';
    const topActivity  = sleepDataP.topActivity|| '데이터 없음';
    const topLatency   = sleepDataP.topLatency || '데이터 없음';
    const topWake      = sleepDataP.topWake    || '데이터 없음';
    const topDrowsy    = sleepDataP.topDrowsy  || '데이터 없음';

    // ⭐ 교사가 선택한 조회 기간 수신 (없으면 오늘 기준 7일)
    const startDate   = payload.startDate || null;
    const endDate     = payload.endDate   || null;
    const periodLabel = (startDate && endDate)
      ? `${startDate} ~ ${endDate}`
      : '최근 7일';

    Logger.log(`=== handleAIReportForTeacher (교사용 전용 프롬프트) ===`);
    Logger.log(`학생: ${name}(${studentId}), 조회기간: ${periodLabel}`);
    Logger.log(`평균카페인: ${cafData.avgPerDay}mg, 평균수면: ${sleepDataP.avgHours}h`);

    // ── API 키 확인 ──────────────────────────────────
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
    if (!apiKey) {
      Logger.log("❌ API 키 없음 → 교사용 대체 분석");
      // API 키 없음 단계에서는 weeklyData가 아직 수집되지 않아 overDays=[] 로 처리
      return {
        success:   true,
        analysis:  getTeacherFallbackAnalysis(
          cafData.avgPerDay    || 0,
          sleepDataP.avgHours  || 0,
          limit,
          cafData.totalDays    || 0,
          sleepDataP.totalDays || 0,
          periodLabel,
          [],          // overDays: 아직 미수집
          periodLabel, // periodForHeader
          lifeAdvice
        ),
        source:    'Fallback (API 키 없음)',
        errorCode: 'NO_API_KEY'
      };
    }

    // ── ⭐ 교사 지정 기간 기준으로 실데이터 수집 ──────────
    const weeklyData           = getWeeklyDetailedData(studentId, startDate, endDate);
    const weeklyDetails        = weeklyData.details;
    const caffeineRecordedDays = weeklyData.caffeineRecordedDays;
    const sleepRecordedDays    = weeklyData.sleepRecordedDays;
    const overCaffeineDays     = weeklyData.overCaffeineDays || [];
    const recordedDays         = weeklyData.recordedDays;
    const totalDays            = weeklyData.totalDays || 7;  // 실제 조회 일수

    Logger.log(`⭐ 카페인: ${caffeineRecordedDays}/${totalDays}일, 수면: ${sleepRecordedDays}/${totalDays}일`);

    // 데이터 부족 시 조기 반환 (교사용 메시지) — 둘 다 부족할 때만 차단
    if (caffeineRecordedDays < 3 && sleepRecordedDays < 3) {
      Logger.log(`⚠️ 데이터 부족 → 교사용 부족 메시지`);
      return {
        success:  true,
        analysis: getTeacherInsufficientMessage(caffeineRecordedDays, sleepRecordedDays, totalDays, periodLabel),
        source:   'InsufficientData',
        recordedDays: recordedDays
      };
    }

    // ── ⭐ 서버 통계 재계산 (교사 지정 기간 기준) ─────────
    const ss            = SpreadsheetApp.getActiveSpreadsheet();
    const caffeineSheet = ss.getSheetByName("caffeine");
    const sleepSheet    = ss.getSheetByName("sleep");

    // 기간 경계값 계산
    const rangeStart = startDate
      ? new Date(startDate + 'T00:00:00+09:00')
      : (() => { const d = new Date(); d.setDate(d.getDate() - 6); d.setHours(0,0,0,0); return d; })();
    const rangeEnd = endDate
      ? new Date(endDate + 'T23:59:59+09:00')
      : new Date();

    let realCafTotal   = 0;
    let realSleepTotal = 0;
    let realSleepDays  = 0;

    if (caffeineSheet) {
      const cafData2 = caffeineSheet.getDataRange().getValues();
      for (let i = 1; i < cafData2.length; i++) {
        if (normalizeId(cafData2[i][4]) === normalizeId(studentId)) {
          const t = cafData2[i][8]; // I열: 섭취시간
          if (t instanceof Date && t >= rangeStart && t <= rangeEnd) {
            realCafTotal += parseFloat(cafData2[i][7]) || 0;
          }
        }
      }
    }
    if (sleepSheet) {
      const sData = sleepSheet.getDataRange().getValues();
      for (let i = 1; i < sData.length; i++) {
        if (normalizeId(sData[i][4]) === normalizeId(studentId)) {
          const d = sData[i][6]; // G열: 날짜
          let dateStr = '';
          if (d instanceof Date) {
            dateStr = Utilities.formatDate(d, "Asia/Seoul", "yyyy-MM-dd");
          } else {
            dateStr = String(d).trim().split(' ')[0];
          }
          const sStart = startDate || '0000-01-01';
          const sEnd   = endDate   || '9999-12-31';
          if (dateStr >= sStart && dateStr <= sEnd) {
            realSleepTotal += parseFloat(sData[i][10]) || 0;
            realSleepDays++;
          }
        }
      }
    }

    const realAvgCaffeine = totalDays > 0 ? realCafTotal / totalDays : 0;
    const realAvgSleep    = realSleepDays > 0 ? realSleepTotal / realSleepDays : 0;

    Logger.log(`📊 통계 재계산: 카페인 총량=${realCafTotal}mg, 일평균=${Math.round(realAvgCaffeine)}mg`);
    Logger.log(`📊 수면: 총량=${realSleepTotal.toFixed(1)}h, 평균=${realAvgSleep.toFixed(1)}h (${realSleepDays}일)`);

    // ── 교사용 전용 Gemini 프롬프트 ─────────────────────
    const modelName = "gemini-2.0-flash";
    const apiUrl    = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // ⭐ 소견 헤더에 실제 조회 기간 표시
    const periodForHeader = (startDate && endDate)
      ? `${startDate} ~ ${endDate}`
      : Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd") + ' 기준 최근 7일';

    const overDays      = overCaffeineDays.filter(d => d.mg > limit);
    const overDaysCount = overDays.length;

    // ── 프롬프트에 삽입할 섹션을 JS에서 미리 완성 ──────────────
    // 카페인 경고 블록
    const cafOverList = overDays
      .map(d => '  - ' + d.date.substr(5) + ': ' + d.mg + 'mg (초과량 ' + (d.mg - limit) + 'mg)')
      .join('\n');

    let cafSection;
    if (overDaysCount > 0) {
      const maxOverDay = overDays.reduce((a, b) => a.mg > b.mg ? a : b);
      const overRate = Math.round(overDaysCount / Math.max(caffeineRecordedDays, 1) * 100);
      cafSection = '일평균 ' + Math.round(realAvgCaffeine) + 'mg으로 권장량(' + limit + 'mg) 이내이나, '
        + '카페인 기록 ' + caffeineRecordedDays + '일 중 ' + overDaysCount + '일(' + overRate + '%)에 권장량을 초과하는 섭취가 확인되었습니다. '
        + '최고 섭취량은 ' + maxOverDay.date.substr(5) + '의 ' + maxOverDay.mg + 'mg(권장량 초과 ' + (maxOverDay.mg - limit) + 'mg)이며, '
        + '일시적 과다 섭취도 두통·불안·수면 방해 등을 유발할 수 있으므로 지속적인 주의가 요구됩니다.\n초과 기록:\n' + cafOverList;
    } else if (realAvgCaffeine > limit) {
      const overAmt = Math.round(realAvgCaffeine - limit);
      cafSection = '일평균 ' + Math.round(realAvgCaffeine) + 'mg으로 권장량(' + limit + 'mg)을 평균 ' + overAmt + 'mg 초과하고 있습니다. '
        + '카페인 과다 섭취는 심박수 증가, 불안감, 수면 장애 등을 유발할 수 있으므로 즉각적인 섭취량 감소 지도가 필요합니다.';
    } else {
      const pct = Math.round(realAvgCaffeine / limit * 100);
      cafSection = '일평균 ' + Math.round(realAvgCaffeine) + 'mg으로 권장량(' + limit + 'mg)의 ' + pct + '% 수준이며, '
        + '전 기간 권장 기준 이내로 양호하게 관리되고 있습니다.';
    }

    // 수면 기준 설정 로드 (연령대 반영)
    const _tSlpCfg = getSleepSettings();
    const _tSlpS   = (_tSlpCfg && _tSlpCfg.settings) ? _tSlpCfg.settings : {};
    const tSlpSevere  = _tSlpS.sleepSevere || 7;
    const tSlpWarn    = _tSlpS.sleepWarn   || 8;
    const tSlpGood    = _tSlpS.sleepGood   || 10;
    const tSlpMax     = _tSlpS.sleepMax    || 11;
    const tAgeLabel   = _tSlpS.ageGroup === 'adult' ? '성인' : '청소년';
    const tRecRange   = tSlpWarn + '~' + tSlpGood + '시간';

    // 수면 판정 블록: 5단계 (수면 부족 🔴 / 적당한 수면 🟠 / 권장 수면 🟢 / 적당한 수면 🟡 / 수면 과다 🟣)
    let sleepJudge;
    const sleepShort = parseFloat((tSlpWarn - realAvgSleep).toFixed(1));
    const sleepOver  = parseFloat((realAvgSleep - tSlpGood).toFixed(1));
    if (realAvgSleep < tSlpSevere) {
      sleepJudge = '수면 부족 🔴 (평균 ' + realAvgSleep.toFixed(1) + '시간 — ' + tAgeLabel + ' 권장 ' + tSlpWarn + '시간 대비 ' + (tSlpWarn - realAvgSleep).toFixed(1) + '시간 부족). '
        + tSlpSevere + '시간 미만의 만성 수면 부족은 인지 기능 저하, 면역력 급감, 정서 불안정 및 우울감 증가 등 고위험 건강 문제를 유발합니다. 즉각적인 수면 환경 개선 및 보호자 연계 지도가 강력히 요구됩니다.';
    } else if (realAvgSleep < tSlpWarn) {
      sleepJudge = '적당한 수면 🟠 - 개인차 범위, 부족 방향 (평균 ' + realAvgSleep.toFixed(1) + '시간 — ' + tAgeLabel + ' 권장 ' + tSlpWarn + '시간 대비 ' + sleepShort + '시간 적음). '
        + '개인차 범위이나 수면 부족으로 이어지지 않도록 취침 시각을 조금 앞당기는 등 수면 시간 확보를 위한 환경 조성이 권장됩니다.';
    } else if (realAvgSleep <= tSlpGood) {
      sleepJudge = '권장 수면 🟢 (평균 ' + realAvgSleep.toFixed(1) + '시간 — ' + tAgeLabel + ' 권장 ' + tRecRange + ' 범위 유지). '
        + '현재 수면 패턴을 지속하고 취침 전 스마트폰 사용 제한 등 수면 위생을 꾸준히 유지하도록 권장합니다.';
    } else if (realAvgSleep < tSlpMax) {
      sleepJudge = '적당한 수면 🟡 - 개인차 범위, 과다 방향 (평균 ' + realAvgSleep.toFixed(1) + '시간 — 권장 상한 ' + tSlpGood + '시간 초과 ' + sleepOver + '시간). '
        + '개인차 범위이나 일정한 기상 시각 유지 및 낮잠 시간 20분 이내 제한으로 수면 리듬을 안정적으로 관리하도록 권장합니다.';
    } else {
      sleepJudge = '수면 과다 🟣 (평균 ' + realAvgSleep.toFixed(1) + '시간 — 권장 상한 ' + tSlpGood + '시간 초과 ' + sleepOver + '시간). '
        + '수면 과다는 무기력 및 생체리듬 불균형으로 이어질 수 있으므로, 일정한 기상 시각 유지 및 낮잠 시간 20분 이내 제한이 요구됩니다. 지속 시 기저 건강 문제 가능성도 배제할 수 없으므로 전문의 상담을 권고합니다.';
    }

    // 개선 방법 1 — 카페인
    let improveCaf;
    if (overDaysCount > 0) {
      improveCaf = '권장량 초과일(' + overDaysCount + '일) 재발 방지를 위해 음료 선택 전 카페인 함량 라벨을 반드시 확인하고, 오후 2시 이후에는 무카페인 음료로 대체하는 습관을 형성하도록 권장합니다.';
    } else if (realAvgCaffeine > limit) {
      improveCaf = '카페인 과다 섭취 개선을 위해 하루 섭취 음료 수를 1잔 줄이고, 카페인 음료를 물·보리차 등으로 단계적으로 대체하도록 지도합니다.';
    } else {
      improveCaf = '현재 카페인 섭취 수준을 유지하고, 음료 구매 시 카페인 함량 라벨 확인 습관을 지속하도록 권장합니다.';
    }

    // 개선 방법 2 — 수면
    let improveSleep;
    if (realAvgSleep < tSlpSevere) {
      improveSleep = '수면 부족 해소를 위해 즉시 취침 시각을 최소 1시간 이상 앞당기고, 취침 2시간 전부터 스마트폰·게임 등 자극적 활동을 전면 중단하며, 주말에도 동일한 수면 루틴을 유지하도록 강력히 권장합니다.';
    } else if (realAvgSleep < tSlpWarn) {
      improveSleep = '취침 시각을 20~30분 앞당기고 매일 동일한 취침·기상 시각을 유지하며, 취침 1시간 전 스마트폰 사용을 줄여 수면의 질을 높이도록 권장합니다.';
    } else if (realAvgSleep >= tSlpMax) {
      improveSleep = '수면 과다 개선을 위해 알람을 활용하여 일정한 기상 시각을 유지하고, 낮잠은 20분 이내로 제한하도록 권장합니다. 피로감이 지속된다면 보건 교사 또는 전문의와 상담하도록 안내합니다.';
    } else if (realAvgSleep > tSlpGood) {
      improveSleep = '일정한 기상 시각을 유지하고 낮잠을 20분 이내로 제한하여 야간 수면의 질을 높이도록 권장합니다.';
    } else {
      improveSleep = '현재 수면 패턴을 유지하고, 취침 전 스마트폰 사용 제한 등 수면 위생을 지속하도록 권장합니다.';
    }

    // 개선 방법 3 — 우선 실천 목표
    let priorityAction;
    if (overDaysCount > 0 && realAvgSleep < tSlpWarn) {
      priorityAction = '카페인 초과 섭취(' + overDaysCount + '일)와 수면 부족이 동시에 관찰되므로, 오후 2시 이후 카페인 음료를 무카페인으로 대체하고 매일 취침 시각을 30분 앞당기는 두 가지 목표를 동시에 실천하도록 권고합니다.';
    } else if (overDaysCount > 0) {
      priorityAction = '카페인 음료 구매 전 반드시 라벨의 카페인 함량을 확인하는 습관을 최우선 실천 목표로 삼고, 특히 오후 시간대 고카페인 음료 섭취를 자제하도록 권고합니다.';
    } else if (realAvgSleep < tSlpSevere) {
      priorityAction = '수면이 매우 부족한 위험 수준이므로, 오늘부터 취침 시각을 1시간 앞당기는 것을 최우선 실천 목표로 삼고 수면 일지를 작성하여 생활 패턴을 점검하도록 강력히 권고합니다.';
    } else if (realAvgSleep < tSlpWarn) {
      priorityAction = '평소 취침 시각보다 20~30분 일찍 잠자리에 드는 것을 첫 번째 실천 목표로 삼고, 취침 전 전자기기 사용 시간을 단계적으로 줄여나가도록 권고합니다.';
    } else if (realAvgSleep >= tSlpMax) {
      priorityAction = '목표 기상 시각을 정하여 알람을 설정하고, 일정한 시각에 기상하는 것을 첫 번째 실천 목표로 삼으며, 낮잠을 줄여 야간 수면의 질을 높이도록 권고합니다.';
    } else if (realAvgSleep > tSlpGood) {
      priorityAction = '일정한 기상 시각 유지와 낮잠 20분 이내 제한을 첫 번째 실천 목표로 삼아 수면 리듬을 안정적으로 관리하도록 권고합니다.';
    } else {
      priorityAction = '현재 카페인·수면 관리를 꾸준히 유지하고, 기록을 지속하여 건강 패턴 변화를 스스로 모니터링하도록 권고합니다.';
    }

    // 종합 소견 힌트 (Gemini에게 전달)
    const cafStatusHint = overDaysCount > 0
      ? '카페인 초과 ' + overDaysCount + '일 발생'
      : (realAvgCaffeine > limit ? '카페인 평균 초과' : '카페인 양호');
    const sleepStatusHint = realAvgSleep < tSlpSevere ? '심각한 수면 부족'
      : realAvgSleep < tSlpWarn  ? '수면 부족'
      : realAvgSleep > 12        ? '과도한 수면'
      : realAvgSleep > tSlpGood  ? '수면 과다'
      : '수면 정상';

    // ⭐ 생활 패턴 추가 데이터 힌트 문자열 조합
    const symptomRateStr = symptomRate != null
      ? `(부작용 경험 비율: 전체 기록의 ${symptomRate}%)`
      : '';
    const lifestyleSection = `- 카페인 섭취 주요 이유: ${topReasons}
- 부작용 경험: ${topSymptoms} ${symptomRateStr}
- 취침 전 스마트폰 사용 시간(최빈값): ${topPhone}
- 신체활동 시간(최빈값): ${topActivity}
- 잠드는 데 걸린 시간(최빈값): ${topLatency}
- 수면 중 깬 횟수(최빈값): ${topWake}
- 낮에 졸린 정도(최빈값): ${topDrowsy}`;

    // 부작용/스마트폰 기반 추가 지도 포인트 생성
    let lifeAdvice = '';
    if (topSymptoms !== '없음' && topSymptoms !== '데이터 없음') {
      lifeAdvice += `학생이 카페인 섭취 후 ${topSymptoms} 등의 부작용을 경험한 것으로 기록되어 있어 신체 반응에 민감하게 대응할 필요가 있습니다. `;
    }
    if (topPhone !== '데이터 없음' && topPhone !== '없음' && topPhone !== '15분 이내') {
      lifeAdvice += `취침 전 스마트폰 사용 시간이 ${topPhone}로 기록되어 수면 유도를 방해하는 요인이 될 수 있으므로 사용 시간 단축을 권고합니다. `;
    }
    if (topLatency !== '데이터 없음' && topLatency !== '15분 이내') {
      lifeAdvice += `잠드는 데 걸리는 시간이 평균적으로 ${topLatency}로 수면 잠복기가 길어 수면의 질 개선이 필요합니다. `;
    }
    if (topDrowsy !== '데이터 없음' && topDrowsy !== '없음') {
      lifeAdvice += `낮에 ${topDrowsy} 정도의 졸음을 경험하는 것으로 나타나 야간 수면의 질과 충분한 수면 시간 확보가 중요합니다. `;
    }
    if (!lifeAdvice) lifeAdvice = '기록된 생활 패턴 데이터는 전반적으로 양호한 수준입니다.';

    // ⭐⭐⭐ 생활기록부 소견 스타일 전용 프롬프트 ⭐⭐⭐
    const teacherPrompt = `너는 학교 보건교사야. 아래 데이터를 바탕으로 학교생활기록부 건강 관찰 소견을 작성해.
반드시 아래 [작성 지시]의 내용을 그대로 사용해서 채워 넣어.

[학생 정보]
- 이름: ${name}
- 조회 기간: ${periodForHeader} (총 ${totalDays}일)
- 체중: ${weight}kg / 일일 카페인 권장량: ${limit}mg
- 카페인 기록: ${caffeineRecordedDays}/${totalDays}일 / 수면 기록: ${sleepRecordedDays}/${totalDays}일
- 현재 상태: ${cafStatusHint} / ${sleepStatusHint}

[생활 패턴 데이터]
${lifestyleSection}

[일별 기록]
${weeklyDetails}

[작성 지시 — 아래 내용을 그대로 각 항목에 삽입할 것]
◎ 카페인 섭취 현황에 쓸 내용:
${cafSection}

◎ 카페인 섭취 이유 및 부작용에 쓸 내용:
주요 섭취 이유는 ${topReasons}으로 나타났습니다. ${topSymptoms !== '없음' && topSymptoms !== '데이터 없음' ? `${topSymptoms} 등의 부작용이 기록되었으므로${symptomRateStr} 카페인 섭취와의 연관성을 지도 시 함께 설명할 필요가 있습니다.` : '부작용 기록은 없거나 미미한 수준입니다.'}

◎ 수면 패턴 분석에 쓸 내용:
${sleepJudge}

◎ 수면 질 및 생활 습관에 쓸 내용:
${lifeAdvice}

◎ 개선 방법 1번에 쓸 내용:
${improveCaf}

◎ 개선 방법 2번에 쓸 내용:
${improveSleep}

◎ 개선 방법 3번에 쓸 내용:
${priorityAction}

[출력 형식 — 아래 구조를 정확히 따를 것]

[건강 관찰 소견 / ${periodForHeader}]

◎ 종합 소견
(카페인 상태: ${cafStatusHint}, 수면 상태: ${sleepStatusHint}, 생활 패턴(스마트폰·잠들기·낮졸음)을 포함하여 2~3문장으로 서술. 격식체 ~습니다 사용)

◎ 카페인 섭취 현황
(위 [작성 지시]의 카페인 내용을 격식체로 그대로 서술)

◎ 카페인 섭취 이유 및 부작용
(위 [작성 지시]의 이유·부작용 내용을 격식체로 그대로 서술)

◎ 수면 패턴 분석
(위 [작성 지시]의 수면 내용을 격식체로 그대로 서술)

◎ 수면 질 및 생활 습관
(위 [작성 지시]의 생활 습관 내용을 격식체로 그대로 서술)

◎ 개선 방법
1. (위 [작성 지시] 1번 내용을 격식체로 그대로 서술)
2. (위 [작성 지시] 2번 내용을 격식체로 그대로 서술)
3. (위 [작성 지시] 3번 내용을 격식체로 그대로 서술)

주의: 격식체(~습니다/합니다/요구됩니다)만 사용. ~요/~네요/~어요 금지. 형식 외 설명 금지.`;

    const apiPayload = {
      contents: [{ parts: [{ text: teacherPrompt }] }],
      generationConfig: {
        temperature: 0.4,   // 낮은 온도 → 일관된 격식체 유지
        topK: 40,
        topP: 0.9,
        maxOutputTokens: 1800,
        candidateCount: 1,
        stopSequences: []
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",        threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT",  threshold: "BLOCK_NONE" }
      ]
    };

    const options = {
      method:      "post",
      contentType: "application/json",
      payload:     JSON.stringify(apiPayload),
      muteHttpExceptions: true
    };

    Logger.log('🚀 교사용 Gemini API 호출 중...');

    try {
      const fetchResult   = fetchWithRetry(apiUrl, options, 3);
      const fetchResponse = fetchResult.response;
      const fetchErrCode  = fetchResult.errorCode;

      if (!fetchResponse || fetchResponse.getResponseCode() !== 200) {
        const errInfo = getApiErrorInfo(fetchErrCode || 'UNKNOWN_ERROR');
        Logger.log('❌ 교사용 API 호출 실패: ' + (fetchErrCode || 'UNKNOWN_ERROR'));
        throw new Error('[' + (fetchErrCode || 'UNKNOWN_ERROR') + '] ' + errInfo.desc);
      }

      const result    = JSON.parse(fetchResponse.getContentText());
      const candidate = result.candidates[0];
      const finishReason = candidate.finishReason;
      Logger.log(`📊 생성 완료 이유: ${finishReason}`);

      const analysis  = candidate.content.parts[0].text.trim();
      const isComplete = ['습니다', '합니다', '됩니다', '요구됩니다', '바랍니다', '합니다.', '.', '!', '?']
                          .some(e => analysis.endsWith(e));

      if (finishReason === "MAX_TOKENS" || !isComplete || analysis.length < 100) {
        Logger.log('⚠️ 교사용 AI 분석 미완성 → 교사용 대체 분석');
        return {
          success:      true,
          analysis:     getTeacherFallbackAnalysis(realAvgCaffeine, realAvgSleep, limit, caffeineRecordedDays, sleepRecordedDays, periodLabel, overDays, periodForHeader, lifeAdvice),
          source:       'Fallback (AI 미완성)',
          errorCode:    'INCOMPLETE',
          recordedDays: recordedDays
        };
      }

      Logger.log(`✅ 교사용 AI 분석 성공! (${analysis.length}자)`);
      Logger.log(analysis);

      return {
        success:      true,
        analysis:     analysis,
        source:       'AI_Teacher',
        recordedDays: recordedDays
      };

    } catch (apiError) {
      Logger.log('❌ 교사용 API 오류: ' + apiError.message);
      const ecMatch = apiError.message.match(/^\[([A-Z_]+)\]/);
      const ec      = ecMatch ? ecMatch[1] : 'UNKNOWN_ERROR';
      return {
        success:      true,
        analysis:     getTeacherFallbackAnalysis(realAvgCaffeine, realAvgSleep, limit, caffeineRecordedDays, sleepRecordedDays, periodLabel, overDays, periodForHeader),
        source:       'Fallback (API 오류)',
        errorCode:    ec,
        error:        apiError.message,
        recordedDays: recordedDays
      };
    }

  } catch (err) {
    Logger.log('❌ handleAIReportForTeacher 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ============================================

// ============================================
// 교사용 전용 대체 분석 (데이터 충분하나 API 실패 시)
// ============================================
function getTeacherFallbackAnalysis(avgCaffeine, avgSleep, limit, cafDays, sleepDays, periodLabel, overDays, periodForHeader, lifeAdvice) {
  avgCaffeine   = parseFloat(avgCaffeine) || 0;
  avgSleep      = parseFloat(avgSleep)    || 0;
  limit         = parseFloat(limit)       || 150;
  cafDays       = parseInt(cafDays)       || 0;
  sleepDays     = parseInt(sleepDays)     || 0;
  overDays      = overDays || [];
  const header  = periodForHeader || periodLabel
                  || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd") + ' 기준 최근 7일';

  const overDaysCount = overDays.length;

  // ── 카페인 섹션 (3단계: 초과일 존재 / 평균 초과 / 정상) ──
  let cafSection;
  if (overDaysCount > 0) {
    const maxOverDay  = overDays.reduce((a, b) => a.mg > b.mg ? a : b);
    const overRate    = Math.round(overDaysCount / Math.max(cafDays, 1) * 100);
    const overList    = overDays.map(d => '  - ' + d.date.substr(5) + ': ' + d.mg + 'mg (초과량 ' + (d.mg - limit) + 'mg)').join('\n');
    cafSection = '일평균 ' + Math.round(avgCaffeine) + 'mg으로 권장량(' + limit + 'mg) 이내이나, '
      + '카페인 기록 ' + cafDays + '일 중 ' + overDaysCount + '일(' + overRate + '%)에 권장량을 초과하는 섭취가 확인되었습니다. '
      + '최고 섭취량은 ' + maxOverDay.date.substr(5) + '의 ' + maxOverDay.mg + 'mg(권장량 초과 ' + (maxOverDay.mg - limit) + 'mg)이며, '
      + '일시적 과다 섭취도 두통·불안·수면 방해 등을 유발할 수 있으므로 지속적인 주의가 요구됩니다.\n초과 기록:\n' + overList;
  } else if (avgCaffeine > limit) {
    const overAmt = Math.round(avgCaffeine - limit);
    cafSection = '일평균 ' + Math.round(avgCaffeine) + 'mg으로 권장량(' + limit + 'mg)을 평균 ' + overAmt + 'mg 초과하고 있습니다. '
      + '카페인 과다 섭취는 심박수 증가, 불안감, 수면 장애 등을 유발할 수 있으므로 즉각적인 섭취량 감소 지도가 필요합니다.';
  } else {
    const pct = Math.round(avgCaffeine / limit * 100);
    cafSection = '일평균 ' + Math.round(avgCaffeine) + 'mg으로 권장량(' + limit + 'mg)의 ' + pct + '% 수준이며, '
      + '전 기간 권장 기준 이내로 양호하게 관리되고 있습니다.';
  }

  // 수면 기준 설정 로드 (연령대 반영)
  const _fbSlpCfg = getSleepSettings();
  const _fbSlpS   = (_fbSlpCfg && _fbSlpCfg.settings) ? _fbSlpCfg.settings : {};
  const fbSlpSevere = _fbSlpS.sleepSevere || 7;
  const fbSlpWarn   = _fbSlpS.sleepWarn   || 8;
  const fbSlpGood   = _fbSlpS.sleepGood   || 10;
  const fbSlpMax    = _fbSlpS.sleepMax    || 11;
  const fbAgeLabel  = _fbSlpS.ageGroup === 'adult' ? '성인' : '청소년';
  const fbRecRange  = fbSlpWarn + '~' + fbSlpGood + '시간';

  // ── 수면 섹션 (5단계: 수면 부족 🔴 / 적당한 수면 🟠 / 권장 수면 🟢 / 적당한 수면 🟡 / 수면 과다 🟣)
  let sleepSection;
  if (avgSleep < fbSlpSevere) {
    sleepSection = '평균 ' + avgSleep.toFixed(1) + '시간으로 수면 부족 🔴 상태입니다(' + fbAgeLabel + ' 권장 최소 ' + fbSlpWarn + '시간 대비 ' + (fbSlpWarn - avgSleep).toFixed(1) + '시간 부족). '
      + fbSlpSevere + '시간 미만의 만성 수면 부족은 인지 기능 저하, 면역력 급감, 정서 불안정 및 우울감 증가 등 고위험 건강 문제를 유발하므로 즉각적인 수면 환경 개선 및 보호자 연계 지도가 강력히 요구됩니다.';
  } else if (avgSleep < fbSlpWarn) {
    const shortH = (fbSlpWarn - avgSleep).toFixed(1);
    sleepSection = '평균 ' + avgSleep.toFixed(1) + '시간으로 적당한 수면 🟠 (개인차 범위, 부족 방향) 상태입니다. '
      + fbAgeLabel + ' 권장 수면시간(' + fbRecRange + ')에 ' + shortH + '시간 미달하나 개인차 범위이며, 취침 시각을 20~30분 앞당겨 수면 시간을 확보하도록 권장합니다.';
  } else if (avgSleep <= fbSlpGood) {
    sleepSection = '평균 ' + avgSleep.toFixed(1) + '시간으로 권장 수면 🟢 범위 내에서 양호하게 관리되고 있습니다(' + fbAgeLabel + ' 권장 ' + fbRecRange + '). '
      + '현재 수면 패턴을 지속하고 취침 전 스마트폰 사용 제한 등 수면 위생을 꾸준히 유지하도록 권장합니다.';
  } else if (avgSleep < fbSlpMax) {
    const overH = (avgSleep - fbSlpGood).toFixed(1);
    sleepSection = '평균 ' + avgSleep.toFixed(1) + '시간으로 적당한 수면 🟡 (개인차 범위, 과다 방향) 상태입니다. '
      + fbAgeLabel + ' 권장 수면시간(' + fbRecRange + ')을 ' + overH + '시간 초과하나 개인차 범위이며, 일정한 기상 시각 유지 및 낮잠 20분 이내 제한으로 수면 리듬 관리를 권장합니다.';
  } else {
    const overH = (avgSleep - fbSlpGood).toFixed(1);
    sleepSection = '평균 ' + avgSleep.toFixed(1) + '시간으로 수면 과다 🟣 상태입니다(' + fbAgeLabel + ' 권장 상한 ' + fbSlpGood + '시간 초과 ' + overH + '시간). '
      + '수면 과다는 무기력 및 생체리듬 불균형으로 이어질 수 있으므로, 일정한 기상 시각 유지 및 낮잠 시간 20분 이내 제한이 요구됩니다. 지속 시 전문의 상담을 권고합니다.';
  }

  // ── 개선 방법 ───────────────────────────────────────────
  let improve1;
  if (overDaysCount > 0) {
    improve1 = '권장량 초과일(' + overDaysCount + '일) 재발 방지를 위해 음료 선택 전 카페인 함량 라벨을 반드시 확인하고, 오후 2시 이후에는 무카페인 음료로 대체하는 습관을 형성하도록 권장합니다.';
  } else if (avgCaffeine > limit) {
    improve1 = '카페인 과다 섭취 개선을 위해 하루 섭취 음료 수를 1잔 줄이고, 카페인 음료를 물·보리차 등으로 단계적으로 대체하도록 지도합니다.';
  } else {
    improve1 = '현재 카페인 섭취 수준을 유지하고, 음료 구매 시 카페인 함량 라벨 확인 습관을 지속하도록 권장합니다.';
  }

  let improve2;
  if (avgSleep < fbSlpSevere) {
    improve2 = '수면 부족 해소를 위해 즉시 취침 시각을 최소 1시간 이상 앞당기고, 취침 2시간 전부터 스마트폰·게임 등 자극적 활동을 전면 중단하며, 주말에도 동일한 수면 루틴을 유지하도록 강력히 권장합니다.';
  } else if (avgSleep < fbSlpWarn) {
    improve2 = '취침 시각을 20~30분 앞당기고 매일 동일한 취침·기상 시각을 유지하며, 취침 1시간 전 스마트폰 사용을 줄여 수면의 질을 높이도록 권장합니다.';
  } else if (avgSleep >= fbSlpMax) {
    improve2 = '수면 과다 개선을 위해 알람을 활용하여 일정한 기상 시각을 유지하고, 낮잠은 20분 이내로 제한하도록 권장합니다. 피로감이 지속된다면 전문의와 상담하도록 안내합니다.';
  } else if (avgSleep > fbSlpGood) {
    improve2 = '일정한 기상 시각을 유지하고 낮잠을 20분 이내로 제한하여 야간 수면의 질을 높이도록 권장합니다.';
  } else {
    improve2 = '현재 수면 패턴을 유지하고, 취침 전 스마트폰 사용 제한 등 수면 위생을 지속하도록 권장합니다.';
  }

  let improve3;
  if (overDaysCount > 0 && avgSleep < fbSlpWarn) {
    improve3 = '카페인 초과 섭취(' + overDaysCount + '일)와 수면 부족이 동시에 관찰되므로, 오후 2시 이후 카페인 음료를 무카페인으로 대체하고 매일 취침 시각을 30분 앞당기는 두 가지 목표를 동시에 실천하도록 권고합니다.';
  } else if (overDaysCount > 0) {
    improve3 = '카페인 음료 구매 전 반드시 라벨의 카페인 함량을 확인하는 습관을 최우선 실천 목표로 삼고, 특히 오후 시간대 고카페인 음료 섭취를 자제하도록 권고합니다.';
  } else if (avgSleep < fbSlpSevere) {
    improve3 = '수면이 매우 부족한 위험 수준이므로, 오늘부터 취침 시각을 1시간 앞당기는 것을 최우선 실천 목표로 삼고 수면 일지를 작성하여 생활 패턴을 점검하도록 강력히 권고합니다.';
  } else if (avgSleep < fbSlpWarn) {
    improve3 = '평소 취침 시각보다 20~30분 일찍 잠자리에 드는 것을 첫 번째 실천 목표로 삼고, 취침 전 전자기기 사용 시간을 단계적으로 줄여나가도록 권고합니다.';
  } else if (avgSleep >= fbSlpMax) {
    improve3 = '목표 기상 시각을 정하여 알람을 설정하고 일정한 시각에 기상하는 것을 첫 번째 실천 목표로 삼으며, 낮잠을 줄여 야간 수면의 질을 높이도록 권고합니다.';
  } else if (avgSleep > fbSlpGood) {
    improve3 = '일정한 기상 시각 유지와 낮잠 20분 이내 제한을 첫 번째 실천 목표로 삼아 수면 리듬을 안정적으로 관리하도록 권고합니다.';
  } else {
    improve3 = '현재 카페인·수면 관리를 꾸준히 유지하고, 기록을 지속하여 건강 패턴 변화를 스스로 모니터링하도록 권고합니다.';
  }

  // ── 종합 소견 (상태별 맞춤 메시지) ─────────────────────
  let summary = '조회 기간(' + header + ') 동안 카페인 ' + cafDays + '일, 수면 ' + sleepDays + '일의 건강 데이터가 기록되었습니다. ';

  const cafBad   = overDaysCount > 0 || avgCaffeine > limit;
  const sleepBad = avgSleep < fbSlpWarn || avgSleep > fbSlpGood;

  if (cafBad && sleepBad) {
    const cafDesc = overDaysCount > 0
      ? '카페인 권장량 초과가 ' + overDaysCount + '일 관찰'
      : '카페인 일평균이 권장량(' + limit + 'mg) 초과';
    const sleepDesc = avgSleep < fbSlpSevere ? '심각한 수면 부족(평균 ' + avgSleep.toFixed(1) + '시간)'
      : avgSleep < fbSlpWarn ? '수면 부족(평균 ' + avgSleep.toFixed(1) + '시간)'
      : avgSleep > 12        ? '과도한 수면(평균 ' + avgSleep.toFixed(1) + '시간)'
      : '수면 과다(평균 ' + avgSleep.toFixed(1) + '시간)';
    summary += cafDesc + ' 및 ' + sleepDesc + '가 동시에 확인되어 복합적인 건강 관리 지도가 필요합니다.';
  } else if (cafBad) {
    if (overDaysCount > 0) {
      summary += '카페인 일평균은 권장 기준 이내이나, ' + overDaysCount + '일에 걸쳐 일일 권장량(' + limit + 'mg)을 초과하는 섭취가 관찰되었으므로 지속적인 주의 및 관리가 요구됩니다.';
    } else {
      summary += '카페인 일평균이 권장량(' + limit + 'mg)을 초과하여 섭취량 조절 지도가 필요합니다. 수면은 권장 범위 내에서 유지되고 있습니다.';
    }
  } else if (sleepBad) {
    const sleepDesc = avgSleep < fbSlpSevere ? '심각한 수면 부족(평균 ' + avgSleep.toFixed(1) + '시간, ' + fbAgeLabel + ' 권장 최소 ' + fbSlpWarn + '시간 대비 ' + (fbSlpWarn-avgSleep).toFixed(1) + '시간 부족)'
      : avgSleep < fbSlpWarn ? '수면 부족(평균 ' + avgSleep.toFixed(1) + '시간, 권장 ' + fbSlpWarn + '시간 미달)'
      : avgSleep > 12        ? '과도한 수면(평균 ' + avgSleep.toFixed(1) + '시간, 권장 상한 ' + fbSlpGood + '시간 초과)'
      : '수면 과다(평균 ' + avgSleep.toFixed(1) + '시간, 권장 ' + fbSlpGood + '시간 초과)';
    summary += sleepDesc + '가 확인됩니다. 카페인 섭취는 권장 기준 이내로 양호하게 유지되고 있으나 수면 패턴 개선이 필요합니다.';
  } else {
    const cafPct = Math.round(avgCaffeine / limit * 100);
    summary += '카페인 일평균 ' + Math.round(avgCaffeine) + 'mg(권장량의 ' + cafPct + '%)과 수면 평균 ' + avgSleep.toFixed(1) + '시간이 모두 ' + fbAgeLabel + ' 권장 기준 내에서 양호하게 유지되고 있습니다.';
  }

  const lifeStr = lifeAdvice || '생활 패턴 데이터가 충분히 기록되지 않아 상세 분석이 어렵습니다.';

  return '[건강 관찰 소견 / ' + header + ']\n\n'
    + '◎ 종합 소견\n' + summary + '\n\n'
    + '◎ 카페인 섭취 현황\n' + cafSection + '\n\n'
    + '◎ 수면 패턴 분석\n' + sleepSection + '\n\n'
    + '◎ 수면 질 및 생활 습관\n' + lifeStr + '\n\n'
    + '◎ 개선 방법\n'
    + '1. ' + improve1 + '\n'
    + '2. ' + improve2 + '\n'
    + '3. ' + improve3;
}

// ============================================
// 교사용 전용 데이터 부족 메시지
// ============================================
function getTeacherInsufficientMessage(cafDays, sleepDays, totalDays, periodLabel) {
  totalDays   = totalDays   || 7;
  periodLabel = periodLabel || Utilities.formatDate(new Date(), "Asia/Seoul", "yyyy-MM-dd") + ' 기준 최근 7일';
  return `[건강 관찰 소견 / ${periodLabel}]

◎ 분석 불가 안내
현재 수집된 데이터가 분석 최소 기준(카페인·수면 각 3일 이상)에 미달하여 AI 건강 소견 작성이 불가합니다.

◎ 현재 기록 현황
- 카페인 기록: ${cafDays}/${totalDays}일 ${cafDays >= 3 ? '(충족)' : '(미충족 — ' + (3 - cafDays) + '일 추가 필요)'}
- 수면 기록:   ${sleepDays}/${totalDays}일 ${sleepDays >= 3 ? '(충족)' : '(미충족 — ' + (3 - sleepDays) + '일 추가 필요)'}

◎ 지도 방향
해당 학생이 카페인 및 수면 데이터를 꾸준히 입력할 수 있도록 독려하시기 바랍니다. 각 항목 3일 이상 기록 시 AI 건강 소견이 자동 생성됩니다.`;
}

// ============================================
// 문의하기 기능
// ============================================

/**
 * 학생이 문의 제출
 */
function submitInquiry(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("inquiries");
    
    // inquiries 시트가 없으면 생성 (새 헤더 구조)
    if (!sheet) {
      sheet = ss.insertSheet("inquiries");
      sheet.getRange(1, 1, 1, 11).setValues([[
        "타임스탬프", "학년", "반", "번호", "학번", "이름", "제목", "내용", "상태", "응답내용", "응답시간"
      ]]);
      sheet.setFrozenRows(1);
    }
    
    const timestamp = getKSTTimestamp();
    const p = parseStudentId(data.studentId);
    
    sheet.appendRow([
      timestamp,               // A: 타임스탬프
      p.grade,                 // B: 학년
      p.class,                 // C: 반
      p.number,                // D: 번호
      String(data.studentId),  // E: 학번
      String(data.name),       // F: 이름
      String(data.title || ''),// G: 제목
      String(data.content || ''),// H: 내용
      "미응답",                // I: 상태
      "",                      // J: 응답내용
      ""                       // K: 응답시간
    ]);
    
    Logger.log(`✅ 문의 저장 완료: ${data.studentId} - ${data.title}`);
    return { success: true };
  } catch (error) {
    Logger.log('❌ 문의 저장 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 교사용: 전체 문의 목록 조회 (새 헤더: A타임스탬프, B학년, C반, D번호, E학번, F이름, G제목, H내용, I상태, J응답내용, K응답시간)
 */
function getInquiries() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("inquiries");
    
    if (!sheet) return { success: true, data: [] };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };
    
    const inquiries = [];
    for (let i = 1; i < data.length; i++) {
      inquiries.push({
        rowIndex:  i + 1,
        timestamp: data[i][0] ? String(data[i][0]) : '',
        grade:     String(data[i][1] || ''),
        classNum:  String(data[i][2] || ''),
        number:    String(data[i][3] || ''),
        studentId: String(data[i][4] || ''),
        name:      String(data[i][5] || ''),
        title:     String(data[i][6] || ''),
        content:   String(data[i][7] || ''),
        status:    String(data[i][8] || '미응답'),
        reply:     String(data[i][9] || ''),
        replyTime: data[i][10] ? String(data[i][10]) : ''
      });
    }
    
    inquiries.reverse();
    return { success: true, data: inquiries };
  } catch (error) {
    Logger.log('❌ 문의 조회 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 교사용: 문의에 응답 (상태: I=9, 응답내용: J=10, 응답시간: K=11)
 */
function replyToInquiry(rowIndex, replyContent) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("inquiries");
    
    if (!sheet) return { success: false, error: "inquiries 시트 없음" };
    
    const replyTime = getKSTTimestamp();
    sheet.getRange(rowIndex, 9).setValue("응답완료");   // I열
    sheet.getRange(rowIndex, 10).setValue(replyContent); // J열
    sheet.getRange(rowIndex, 11).setValue(replyTime);    // K열
    
    Logger.log(`✅ 문의 응답 완료: 행 ${rowIndex}`);
    return { success: true };
  } catch (error) {
    Logger.log('❌ 문의 응답 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 교사용: 문의 행 삭제
 * @param {number} rowIndex - 삭제할 시트 행 번호 (1-based)
 */
function deleteInquiry(rowIndex) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('inquiries');
    if (!sheet) return { success: false, error: 'inquiries 시트 없음' };
    if (rowIndex < 2 || rowIndex > sheet.getLastRow()) {
      return { success: false, error: '유효하지 않은 행 번호: ' + rowIndex };
    }
    sheet.deleteRow(rowIndex);
    Logger.log('✅ 문의 삭제 완료: 행 ' + rowIndex);
    return { success: true };
  } catch (err) {
    Logger.log('❌ deleteInquiry 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용: 교사가 아직 확인하지 않은 새 문의 목록 조회
 * L열(12번): 교사확인 — 빈 값이면 미확인
 */
function getUnreadInquiries() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('inquiries');
    if (!sheet) return { success: true, data: [] };
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < data.length; i++) {
      const notified = String(data[i][11] || '');
      if (notified === '확인') continue;
      result.push({
        rowIndex:  i + 1,
        timestamp: data[i][0] ? String(data[i][0]) : '',
        studentId: String(data[i][4] || ''),
        name:      String(data[i][5] || ''),
        title:     String(data[i][6] || ''),
        content:   String(data[i][7] || ''),
        status:    String(data[i][8] || '미응답')
      });
    }
    return { success: true, data: result };
  } catch (err) {
    Logger.log('❌ getUnreadInquiries 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용: 문의 팝업 확인 처리 (L열 = '확인')
 */
function markInquiryNotified(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('inquiries');
    if (!sheet) return { success: false, error: '시트 없음' };
    sheet.getRange(rowIndex, 12).setValue('확인');
    return { success: true };
  } catch (err) {
    Logger.log('❌ markInquiryNotified 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 학생용: 자신의 문의 목록 및 응답 확인 (E열=학번[4])
 */
function getMyInquiries(studentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("inquiries");
    
    if (!sheet) return { success: true, data: [] };
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, data: [] };
    
    const inquiries = [];
    for (let i = 1; i < data.length; i++) {
      if (normalizeId(data[i][4]) === normalizeId(studentId)) { // E열: 학번
        inquiries.push({
          timestamp: data[i][0] ? String(data[i][0]) : '',
          title:     String(data[i][6] || ''),  // G열
          content:   String(data[i][7] || ''),  // H열
          status:    String(data[i][8] || '미응답'), // I열
          reply:     String(data[i][9] || ''),  // J열
          replyTime: data[i][10] ? String(data[i][10]) : '' // K열
        });
      }
    }
    
    inquiries.reverse();
    return { success: true, data: inquiries };
  } catch (error) {
    Logger.log('❌ 내 문의 조회 오류: ' + error.message);
    return { success: false, error: error.message };
  }
}
/**
 * caffeine_db 시트 전체를 읽어 카페인 DB 배열 반환
 * 컬럼: A=식품명, B=업체명, C=기준량, D=카페인(mg), E=출처
 * @returns {{ success: boolean, data: Array }}
 */
function getCaffeineDB() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ws = ss.getSheetByName('caffeine_db');
    if (!ws) {
      Logger.log('getCaffeineDB: caffeine_db 시트 없음');
      return { success: false, data: [], error: 'caffeine_db 시트를 찾을 수 없습니다.' };
    }

    var lastRow = ws.getLastRow();
    if (lastRow < 2) {
      return { success: true, data: [] };
    }

    // A~D열만 읽기 (E열 출처는 불필요)
    // 헤더(1행) 제외, 2행부터
    var rawData = ws.getRange(2, 1, lastRow - 1, 4).getValues();
    // 컬럼 인덱스 (0-based):
    //   0: A열 = 식품명(f)
    //   1: B열 = 업체명(c)
    //   2: C열 = 기준량(s) — '100g', '100ml', '355㎖' 등
    //   3: D열 = 카페인(mg) — 숫자 또는 '39㎎' 문자열

    var result = [];
    for (var i = 0; i < rawData.length; i++) {
      var row = rawData[i];
      var foodName  = row[0] ? String(row[0]).trim() : '';
      var company   = row[1] ? String(row[1]).trim() : '';
      var stdStr    = row[2] ? String(row[2]).trim() : '100g';
      var mgRaw     = row[3];

      // 빈 행 건너뜀
      if (!foodName) continue;

      // 기준량 정규화: ㎖ → ml, ㎎ → mg (특수 단위 문자 처리)
      var stdNorm = stdStr
        .replace(/㎖/g, 'ml')
        .replace(/㎎/g, 'mg')
        .replace(/㎏/g, 'kg')
        .replace(/，/g, ',');

      // 카페인(mg) 파싱: 숫자 또는 '39㎎' 같은 문자열
      var mgVal = 0;
      if (typeof mgRaw === 'number') {
        mgVal = mgRaw;
      } else if (mgRaw) {
        var mgStr = String(mgRaw).replace(/㎎/g, '').replace(/mg/gi, '').trim();
        mgVal = parseFloat(mgStr) || 0;
      }
      mgVal = Math.round(mgVal * 100) / 100; // 소수점 2자리

      // w(식품중량) 필드: 비표준 기준량이면 그 값 자체가 1회 제공량
      // 예: '355ml' → w='355ml' (용량 입력창 기본값으로 사용)
      var stdNumMatch = stdNorm.replace(',','').match(/[\d.]+/);
      var stdNum = stdNumMatch ? parseFloat(stdNumMatch[0]) : 100;
      var wVal = stdNum === 100 ? '' : stdNorm; // 100g/100ml이면 w 비워둠

      result.push({
        f:  foodName,  // 식품명 (카테고리_음료명 형식)
        c:  company,   // 업체명
        s:  stdNorm,   // 기준량 (정규화)
        w:  wVal,      // 식품중량 (비표준 기준량이면 해당 값, 100g/100ml이면 '')
        mg: mgVal      // 기준량당 카페인 mg
      });
    }

    Logger.log('getCaffeineDB: ' + result.length + '건 반환');
    return { success: true, data: result };

  } catch (error) {
    Logger.log('getCaffeineDB 오류: ' + error);
    return { success: false, data: [], error: error.toString() };
  }
}
// ============================================================
// ★ fetchWithRetry & getApiErrorInfo — 오류 코드별 재시도 유틸리티
// ============================================================

/**
 * Gemini API를 지수 백오프로 안전하게 호출
 * @param {string} apiUrl
 * @param {Object} options  - UrlFetchApp.fetch 옵션 (muteHttpExceptions: true 필수)
 * @param {number} maxRetry - 최대 재시도 횟수 (기본 3)
 * @returns {{ response: HTTPResponse|null, errorCode: string|null }}
 */
function fetchWithRetry(apiUrl, options, maxRetry) {
  maxRetry = maxRetry || 3;

  var RETRYABLE = {
    500: 'SERVER_ERROR',
    502: 'SERVER_ERROR',
    503: 'SERVER_ERROR',
    504: 'SERVER_ERROR'
  };

  var lastResponse = null;
  var lastCode     = null;

  for (var attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      var response = UrlFetchApp.fetch(apiUrl, options);
      var code     = response.getResponseCode();
      Logger.log('[fetchWithRetry] 시도 ' + attempt + '/' + maxRetry + ' → HTTP ' + code);

      if (code === 200) {
        return { response: response, errorCode: null }; // ✅ 성공
      }

      lastResponse = response;
      lastCode     = code;

      if (RETRYABLE[code] && attempt < maxRetry) {
        var waitMs = Math.min(Math.pow(2, attempt) * 1000, 20000);

        // 429 Retry-After 헤더 우선 적용
        if (code === 429) {
          try {
            var headers = response.getHeaders();
            if (headers && headers['Retry-After']) {
              waitMs = Math.max(waitMs, Math.min(parseInt(headers['Retry-After']) * 1000, 30000));
            }
          } catch (e) { /* 헤더 없을 수 있음 */ }
        }

        Logger.log('[fetchWithRetry] HTTP ' + code + ' → ' + (waitMs / 1000) + 's 대기 후 재시도...');
        Utilities.sleep(waitMs);
        continue;
      }

      break; // 재시도 불필요한 오류 (401, 403, 400 등)

    } catch (networkErr) {
      Logger.log('[fetchWithRetry] 네트워크 오류 (시도 ' + attempt + '): ' + networkErr);
      if (attempt < maxRetry) {
        Utilities.sleep(Math.min(Math.pow(2, attempt) * 1000, 20000));
      } else {
        return { response: null, errorCode: 'NETWORK_ERROR' };
      }
    }
  }

  // errorCode 결정
  var errorCode = 'UNKNOWN_ERROR';
  if (lastCode) {
    if (RETRYABLE[lastCode])                           errorCode = RETRYABLE[lastCode];
    else if (lastCode === 401 || lastCode === 403)     errorCode = 'AUTH_ERROR';
  }

  Logger.log('[fetchWithRetry] 최종 실패. code=' + lastCode + ', errorCode=' + errorCode);
  return { response: lastResponse, errorCode: errorCode };
}

/**
 * errorCode → 사용자 안내 메시지 (한국어)
 * @param {string} errorCode
 * @returns {{ title: string, desc: string }}
 */
function getApiErrorInfo(errorCode) {
  var map = {
    'RATE_LIMIT':    { title: '요청 한도 초과 (429)',   desc: 'Gemini API 일일 요청 한도에 도달했습니다. 잠시 후 또는 내일 다시 시도해 주세요.' },
    'SERVER_ERROR':  { title: 'AI 서버 오류 (5xx)',     desc: 'Gemini 서버가 일시적으로 응답하지 않습니다. 1~2분 후 다시 시도해 주세요.' },
    'AUTH_ERROR':    { title: 'API 키 오류 (401/403)',  desc: 'API 키가 유효하지 않거나 권한이 없습니다. 관리자에게 문의해 주세요.' },
    'NO_API_KEY':    { title: 'API 키 미설정',           desc: 'Gemini API 키가 설정되지 않았습니다. 관리자에게 문의해 주세요.' },
    'NETWORK_ERROR': { title: '네트워크 오류',            desc: '서버와의 통신 중 연결이 끊겼습니다. 인터넷 상태를 확인 후 다시 시도해 주세요.' },
    'INCOMPLETE':    { title: 'AI 응답 미완성',           desc: 'AI 응답이 완성되지 않아 기본 분석으로 대체했습니다.' },
    'UNKNOWN_ERROR': { title: '알 수 없는 오류',          desc: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }
  };
  return map[errorCode] || map['UNKNOWN_ERROR'];
}

// ═══════════════════════════════════════════════════════════════════
// 🏅 교사 수여 뱃지 시스템 — Code.gs 추가 함수
// 시트명: "teacher_awards"
// 컬럼 구조 (A~L열):
//   A: grantedAt    수여 일시 (예: 2026-02-26 14:30)
//   B: grade        학년
//   C: class        반
//   D: number       번호
//   E: studentId    학번
//   F: studentName  학생 이름
//   G: awardId      뱃지 ID (예: manual_1234567890)
//   H: awardName    뱃지 이름
//   I: image        이모지 또는 이미지 URL
//   J: bg           배경색 (#f5f3ff)
//   K: color        글자색 (#7c3aed)
//   L: message      수여 메시지 (선택)
//   M: grantedBy    수여 교사 (선택)
// ═══════════════════════════════════════════════════════════════════

/**
 * 특정 학생에게 부여된 교사 수여 뱃지 목록 반환
 * 학생 앱(index.html)의 checkTeacherAwards()에서 호출
 *
 * @param {string} studentId  학번
 * @returns {{ success: boolean, awards: Array }}
 */
function getTeacherAwardsForStudent(studentId) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _getOrCreateAwardSheet_(ss);

    const data = sheet.getDataRange().getValues();
    Logger.log('=== getTeacherAwardsForStudent ===');
    Logger.log('요청 학번(원본): "' + studentId + '"');
    Logger.log('시트 전체 행 수: ' + data.length + ' (헤더 포함)');

    if (data.length <= 1) {
      Logger.log('⚠️ 데이터 없음 (헤더만 존재)');
      return { success: true, awards: [] };
    }

    const totalCols = data[0] ? data[0].length : 0;
    const targetId  = normalizeId(studentId);
    Logger.log('헤더 컬럼 수: ' + totalCols);
    Logger.log('헤더: ' + JSON.stringify(data[0]));
    Logger.log('정규화된 학번: "' + targetId + '"');

    // ──────────────────────────────────────────────────────
    // 컬럼 레이아웃 자동 감지
    // 신규(12~13열): A=수여일시, B=학년, C=반, D=번호, E=학번, F=학생이름,
    //                G=awardId,  H=뱃지이름, I=이미지, J=배경색, K=글자색,
    //                L=코멘트,   M=수여교사(13열만 존재)
    // 구버전(~9열): A=수여일시, B=학번, C=awardId, D=뱃지이름 ...
    // ──────────────────────────────────────────────────────
    // ⭐ 헤더 2번째 값(index1)으로 포맷 구분
    //    신규: '학년' / 구버전: 'studentid' 또는 학번 직접
    const hdr1 = String(data[0][1] || '').toLowerCase();
    const isNewFormat = (totalCols >= 12) && (hdr1 === '학년' || hdr1 === 'grade');

    Logger.log('포맷: ' + (isNewFormat ? '신규(12+열, B=학년)' : '구버전(B=학번)'));

    // 데이터 샘플 로그 (최대 3행)
    for (var si = 1; si < Math.min(4, data.length); si++) {
      var sRow = data[si];
      var sId  = isNewFormat ? normalizeId(sRow[4]) : normalizeId(sRow[1]);
      Logger.log('  ' + si + '행 학번="' + sId + '" | 원본E="' + sRow[4] + '" | A열ts="' + sRow[0] + '"');
    }

    const awards = [];
    for (let i = 1; i < data.length; i++) {
      const row    = data[i];
      const rowSid = isNewFormat ? normalizeId(row[4]) : normalizeId(row[1]);

      if (rowSid !== targetId) continue;

      Logger.log('✅ 매칭 행 ' + (i+1) + ': 학번=' + rowSid + ', 뱃지=' + (isNewFormat ? row[7] : row[3]));

      if (isNewFormat) {
        awards.push({
          grantedAt   : _tsToStr_(row[0]),
          grade       : String(row[1]  || ''),
          classNum    : String(row[2]  || ''),
          number      : String(row[3]  || ''),
          studentId   : String(row[4]  || ''),
          studentName : String(row[5]  || ''),
          awardId     : String(row[6]  || ''),
          name        : String(row[7]  || ''),
          image       : String(row[8]  || '🏅'),
          bg          : String(row[9]  || '#f5f3ff'),
          color       : String(row[10] || '#7c3aed'),
          message     : String(row[11] || ''),
          grantedBy   : String(row[12] || '')  // 13열 없으면 빈 문자열
        });
      } else {
        // 구버전: B=학번, C=awardId, D=뱃지이름, E=이미지, F=배경색, G=글자색, H=메시지, I=교사
        awards.push({
          grantedAt : _tsToStr_(row[0]),
          studentId : String(row[1] || ''),
          awardId   : String(row[2] || ''),
          name      : String(row[3] || ''),
          image     : String(row[4] || '🏅'),
          bg        : String(row[5] || '#f5f3ff'),
          color     : String(row[6] || '#7c3aed'),
          message   : String(row[7] || ''),
          grantedBy : String(row[8] || '')
        });
      }
    }

    Logger.log('결과: ' + awards.length + '개 뱃지 반환');
    awards.sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
    return { success: true, awards: awards };

  } catch (err) {
    Logger.log('❌ getTeacherAwardsForStudent 오류: ' + err.message);
    return { success: false, awards: [], error: err.message };
  }
}

/**
 * 교사 앱(teacher_v3.html)에서 뱃지 수여 시 호출
 * 단일 또는 일괄 수여 모두 처리
 *
 * @param {Object} params
 *   params.studentIds  {string[]}  수여 대상 학번 배열
 *   params.awards      {Object[]}  수여할 뱃지 배열 (name, image, bg, color)
 *   params.message     {string}    수여 메시지 (공통)
 *   params.grantedBy   {string}    수여 교사명 (선택)
 * @returns {{ success: boolean, count: number }}
 */
function grantTeacherAwards(params) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _getOrCreateAwardSheet_(ss);

    const studentIds = params.studentIds || [];
    const awards     = params.awards     || [];
    const message    = params.message    || '';
    const grantedBy  = params.grantedBy  || '';
    // ⭐ JS에서 전달된 grantedAt 사용 (없으면 서버 시간 폴백)
    // → localStorage와 시트의 grantedAt이 동일해야 삭제 시 매칭 성공
    const grantedAt  = (params.grantedAt && String(params.grantedAt).length >= 10)
                       ? String(params.grantedAt)
                       : _nowKST_();

    if (!studentIds.length || !awards.length) {
      return { success: false, error: '수여 대상 또는 뱃지가 없습니다.' };
    }

    // students 시트에서 학생 정보 조회 (학번 → 학년/반/번호/이름)
    const studentMap = {};
    try {
      const studSheet = ss.getSheetByName('students');
      if (studSheet) {
        const studData = studSheet.getDataRange().getValues();
        for (let i = 1; i < studData.length; i++) {
          const sid = normalizeId(studData[i][4]); // E열: 학번
          if (sid) {
            studentMap[sid] = {
              grade  : String(studData[i][0] || ''), // A: 학년
              cls    : String(studData[i][1] || ''), // B: 반
              number : String(studData[i][2] || ''), // C: 번호
              name   : String(studData[i][3] || '')  // D: 이름
            };
          }
        }
      }
    } catch (mapErr) {
      Logger.log('⚠️ 학생 정보 조회 실패 (계속 진행): ' + mapErr);
    }

    // 중복 수여 방지: 시트에서 기존 수여 내역 읽기 (학번+뱃지ID 조합)
    const existingSet = new Set();
    try {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const existing = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
        existing.forEach(r => {
          const sid = normalizeId(r[4]);
          const aid = String(r[6] || '');
          if (sid && aid) existingSet.add(sid + '|' + aid);
        });
      }
    } catch(e) { Logger.log('⚠️ 중복 체크 조회 실패 (계속 진행): ' + e); }

    const rows = [];
    studentIds.forEach(sid => {
      const normSid = normalizeId(sid);
      const info = studentMap[normSid] || { grade: '', cls: '', number: '', name: '' };
      awards.forEach(a => {
        const awardId = String(a.awardId || '');
        if (existingSet.has(normSid + '|' + awardId)) {
          Logger.log('⏭️ 중복 수여 건너뜀: ' + normSid + ' / ' + awardId);
          return;
        }
        rows.push([
          grantedAt,                       // A: 수여 일시
          String(info.grade),              // B: 학년
          String(info.cls),                // C: 반
          String(info.number),             // D: 번호
          normSid,                         // E: 학번
          String(info.name),               // F: 학생 이름
          awardId,                         // G: 뱃지 ID
          String(a.name     || ''),        // H: 뱃지 이름
          String(a.image    || '🏅'),      // I: 이모지/URL
          String(a.bg       || '#f5f3ff'), // J: 배경색
          String(a.color    || '#7c3aed'), // K: 글자색
          String(message),                 // L: 메시지
          String(grantedBy)                // M: 교사명
        ]);
      });
    });

    // 시트에 일괄 append
    if (rows.length > 0) {
      const lastRow = Math.max(sheet.getLastRow(), 1);
      const range = sheet.getRange(lastRow + 1, 1, rows.length, 13);
      range.setValues(rows);
      // ⭐ A열(수여일시)을 텍스트 형식으로 강제 지정 → Sheets 자동 Date 변환 차단
      sheet.getRange(lastRow + 1, 1, rows.length, 1)
           .setNumberFormat('@STRING@');
    }

    Logger.log('✅ 뱃지 수여 완료: ' + studentIds.length + '명 × ' + awards.length + '개 = ' + rows.length + '행');
    return { success: true, count: rows.length, grantedAt: grantedAt };

  } catch (err) {
    Logger.log('❌ grantTeacherAwards 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 특정 학생의 특정 뱃지 취소 (교사 앱용)
 *
 * @param {string} studentId
 * @param {string} grantedAt   수여 일시 (A열 값, 고유 식별자로 활용)
 * @param {string} awardId     뱃지 ID (C열 값)
 * @returns {{ success: boolean }}
 */
function revokeTeacherAward(studentId, grantedAt, awardId) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _getOrCreateAwardSheet_(ss);
    const data  = sheet.getDataRange().getValues();

    const targetSid  = normalizeId(studentId);
    const targetTs   = String(grantedAt || '').substring(0, 16); // "YYYY-MM-DD HH:mm"
    const targetDate = String(grantedAt || '').substring(0, 10); // "YYYY-MM-DD"
    const aidTarget  = String(awardId || '').trim();

    // ⭐ 포맷 감지: 헤더 B열(index1) 값으로 신규/구버전 판단
    // 신규(12+열): B=학년 → E열(index4)=학번, G열(index6)=awardId
    // 구버전(~9열): B=학번 → B열(index1)=학번, C열(index2)=awardId
    const totalCols = data[0] ? data[0].length : 0;
    const hdr1 = String(data[0] ? (data[0][1] || '') : '').toLowerCase();
    const isNewFormat = (totalCols >= 12) && (hdr1 === '학년' || hdr1 === 'grade');

    Logger.log('revokeTeacherAward: 학번=' + studentId + ', grantedAt=' + grantedAt + ', awardId=' + awardId);
    Logger.log('포맷: ' + (isNewFormat ? '신규(12+열)' : '구버전') + ', 컬럼수=' + totalCols + ', B헤더="' + hdr1 + '"');

    function getRowSid(row) {
      return isNewFormat ? normalizeId(row[4]) : normalizeId(row[1]);
    }
    function getRowAid(row) {
      return isNewFormat ? String(row[6] || '').trim() : String(row[2] || '').trim();
    }

    // ─── 1단계: 학번 + 시간(16자리) + awardId 완전 매칭 ───────────
    for (let i = data.length - 1; i >= 1; i--) {
      const row   = data[i];
      const rowTs = _tsToStr_(row[0]);
      const rowSid = getRowSid(row);
      const rowAid = getRowAid(row);

      if (rowSid !== targetSid) continue;
      if (rowTs.substring(0, 16) !== targetTs) continue;
      if (aidTarget && rowAid !== aidTarget) continue;

      sheet.deleteRow(i + 1);
      Logger.log('✅ 뱃지 취소(완전매칭): 학번=' + studentId + ', ts=' + rowTs + ', aid=' + aidTarget);
      return { success: true };
    }

    // ─── 2단계: 학번 + 날짜(10자리) + awardId 완화 매칭 ─────────
    for (let i = data.length - 1; i >= 1; i--) {
      const row    = data[i];
      const rowTs  = _tsToStr_(row[0]);
      const rowSid = getRowSid(row);
      const rowAid = getRowAid(row);

      if (rowSid !== targetSid) continue;
      if (rowTs.substring(0, 10) !== targetDate) continue;
      if (aidTarget && rowAid !== aidTarget) continue;

      sheet.deleteRow(i + 1);
      Logger.log('✅ 뱃지 취소(날짜+id 매칭): 학번=' + studentId + ', date=' + targetDate);
      return { success: true };
    }

    // ─── 3단계: 학번 + 날짜만 (awardId 무시, 최후 수단) ──────────
    if (aidTarget) {
      for (let i = data.length - 1; i >= 1; i--) {
        const row    = data[i];
        const rowTs  = _tsToStr_(row[0]);
        const rowSid = getRowSid(row);

        if (rowSid !== targetSid) continue;
        if (rowTs.substring(0, 10) !== targetDate) continue;

        sheet.deleteRow(i + 1);
        Logger.log('⚠️ 뱃지 취소(날짜만 매칭): 학번=' + studentId);
        return { success: true };
      }
    }

    Logger.log('❌ revokeTeacherAward 매칭 실패: 학번=' + studentId + ', grantedAt=' + grantedAt + ', awardId=' + awardId + ', isNewFormat=' + isNewFormat + ', totalCols=' + totalCols);
    return { success: false, error: '해당 뱃지 기록을 찾을 수 없습니다.' };

  } catch (err) {
    Logger.log('❌ revokeTeacherAward 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사 앱 초기화용 — teacher_awards 시트 전체를 읽어서
 * { [studentId]: [ award, ... ] } 형태로 반환
 * → 교사 앱 시작 시 GAS 시트 → manualAwards 동기화에 사용
 *
 * @returns {{ success: boolean, byStudent: Object }}
 */
function getAllTeacherAwards() {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = _getOrCreateAwardSheet_(ss);
    const data  = sheet.getDataRange().getValues();

    Logger.log('=== getAllTeacherAwards === 행 수: ' + data.length);
    if (data.length <= 1) return { success: true, byStudent: {} };

    const totalCols = data[0] ? data[0].length : 0;
    const hdr1      = String(data[0][1] || '').toLowerCase();
    const isNew     = (totalCols >= 12) && (hdr1 === '학년' || hdr1 === 'grade');
    Logger.log('포맷: ' + (isNew ? '신규' : '구버전') + ', 컬럼수=' + totalCols);

    const byStudent = {};
    for (var i = 1; i < data.length; i++) {
      const row = data[i];
      const sid = isNew ? String(normalizeId(row[4])) : String(normalizeId(row[1]));
      if (!sid || sid === '0') continue; // 학번 없는 행 스킵

      const award = isNew ? {
        grantedAt   : _tsToStr_(row[0]),
        grade       : String(row[1]  || ''),
        classNum    : String(row[2]  || ''),
        number      : String(row[3]  || ''),
        studentId   : sid,
        studentName : String(row[5]  || ''),
        awardId     : String(row[6]  || ''),
        name        : String(row[7]  || ''),
        image       : String(row[8]  || '🏅'),
        bg          : String(row[9]  || '#f5f3ff'),
        color       : String(row[10] || '#7c3aed'),
        message     : String(row[11] || ''),
        grantedBy   : String(row[12] || '')
      } : {
        grantedAt   : _tsToStr_(row[0]),
        studentId   : sid,
        awardId     : String(row[2] || ''),
        name        : String(row[3] || ''),
        image       : String(row[4] || '🏅'),
        bg          : String(row[5] || '#f5f3ff'),
        color       : String(row[6] || '#7c3aed'),
        message     : String(row[7] || ''),
        grantedBy   : String(row[8] || '')
      };

      if (!byStudent[sid]) byStudent[sid] = [];
      byStudent[sid].push(award);
    }

    // 학생별 최신순 정렬
    Object.keys(byStudent).forEach(function(sid) {
      byStudent[sid].sort(function(a, b) { return b.grantedAt.localeCompare(a.grantedAt); });
    });

    Logger.log('getAllTeacherAwards 완료: ' + Object.keys(byStudent).length + '명 데이터 반환');
    return { success: true, byStudent: byStudent };

  } catch (err) {
    Logger.log('❌ getAllTeacherAwards 오류: ' + err.message);
    return { success: false, byStudent: {}, error: err.message };
  }
}

// ── 내부 헬퍼 ──────────────────────────────────────────────────────

/**
 * teacher_awards 시트 반환 (없으면 자동 생성 + 헤더 설정)
 */
function _getOrCreateAwardSheet_(ss) {
  let sheet = ss.getSheetByName('teacher_awards');
  if (!sheet) {
    sheet = ss.insertSheet('teacher_awards');
    // 헤더 행 작성 (신규 13컬럼 구조)
    sheet.getRange(1, 1, 1, 13).setValues([[
      '수여일시', '학년', '반', '번호', '학번', '학생이름',
      'awardId', '뱃지이름', '이미지', '배경색', '글자색',
      '코멘트', '수여교사'
    ]]);
    // 헤더 스타일
    const hdr = sheet.getRange(1, 1, 1, 13);
    hdr.setBackground('#7c3aed');
    hdr.setFontColor('#ffffff');
    hdr.setFontWeight('bold');
    sheet.setFrozenRows(1);
    // 열 너비 설정
    sheet.setColumnWidth(1, 140); // 수여일시
    sheet.setColumnWidth(2, 60);  // 학년
    sheet.setColumnWidth(3, 60);  // 반
    sheet.setColumnWidth(4, 60);  // 번호
    sheet.setColumnWidth(5, 90);  // 학번
    sheet.setColumnWidth(6, 100); // 학생이름
    sheet.setColumnWidth(7, 150); // awardId
    sheet.setColumnWidth(8, 100); // 뱃지이름
    sheet.setColumnWidth(9, 60);  // 이미지
    sheet.setColumnWidth(12, 200); // 코멘트
    sheet.setColumnWidth(13, 100); // 수여교사
    Logger.log('✅ teacher_awards 시트 자동 생성 (신규 13컬럼)');
  } else {
    // 기존 시트: 헤더가 구버전(9열)이면 마이그레이션 안내 (데이터는 건드리지 않음)
    const hdrVals = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (hdrVals.length < 10 && String(hdrVals[1]).toLowerCase() === 'studentid') {
      Logger.log('⚠️ teacher_awards 시트가 구버전(9열) 형식입니다. 신규 데이터는 13열로 저장됩니다.');
    }
  }
  return sheet;
}

/**
 * 현재 KST 시각을 "YYYY-MM-DD HH:mm" 형식으로 반환
 */
function _nowKST_() {
  var now = new Date();
  var kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  function pad(n) { return String(n).padStart(2, '0'); }
  return kst.getUTCFullYear() + '-' + pad(kst.getUTCMonth() + 1) + '-' + pad(kst.getUTCDate())
       + ' ' + pad(kst.getUTCHours()) + ':' + pad(kst.getUTCMinutes());
}

/**
 * Google Sheets 셀 값(Date 객체 or 문자열)을 "YYYY-MM-DD HH:mm" 문자열로 정규화
 * → Sheets가 날짜형 문자열을 자동으로 Date 객체로 변환하는 문제 해결
 */
function _tsToStr_(val) {
  if (!val) return '';
  if (val instanceof Date) {
    // Date 객체 → KST 기준 "YYYY-MM-DD HH:mm"
    var kst = new Date(val.getTime() + 9 * 60 * 60 * 1000);
    function pad(n) { return String(n).padStart(2, '0'); }
    return kst.getUTCFullYear() + '-' + pad(kst.getUTCMonth() + 1) + '-' + pad(kst.getUTCDate())
         + ' ' + pad(kst.getUTCHours()) + ':' + pad(kst.getUTCMinutes());
  }
  // 문자열이면 앞 16자리만 반환
  return String(val).substring(0, 16);
}

// ═══════════════════════════════════════════════════════════════════
// 📊 구글 시트 내보내기 — 학생 모니터링 데이터를 현재 스프레드시트에 새 시트로 저장
// ═══════════════════════════════════════════════════════════════════

/**
 * 교사용 학생 목록 데이터를 현재 스프레드시트에 새 시트로 저장
 *
 * @param {Object} params
 *   params.sheetName   {string}   새 시트 이름 (없으면 자동 생성)
 *   params.rows        {Array[]}  헤더 포함 데이터 배열 (2D)
 * @returns {{ success: boolean, sheetName: string, rowCount: number }}
 */
function exportDataToNewSheet(params) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const rows = params.rows || [];
    if (rows.length === 0) {
      return { success: false, error: '내보낼 데이터가 없습니다.' };
    }

    // 시트 이름 결정 (중복 시 자동 suffix)
    let baseName = params.sheetName || ('모니터링_' + _nowKST_().substring(0, 10));
    let sheetName = baseName;
    let suffix = 1;
    while (ss.getSheetByName(sheetName)) {
      sheetName = baseName + '_' + suffix;
      suffix++;
    }

    // 새 시트 생성
    const newSheet = ss.insertSheet(sheetName);

    // 데이터 일괄 기록
    const colCount = rows[0].length;
    newSheet.getRange(1, 1, rows.length, colCount).setValues(rows);

    // 헤더 스타일
    const hdr = newSheet.getRange(1, 1, 1, colCount);
    hdr.setBackground('#1e3a5f');
    hdr.setFontColor('#ffffff');
    hdr.setFontWeight('bold');
    newSheet.setFrozenRows(1);

    // 열 너비 자동 조정
    newSheet.autoResizeColumns(1, colCount);

    // 데이터 행 교대 색상
    for (let r = 2; r <= rows.length; r++) {
      if (r % 2 === 0) {
        newSheet.getRange(r, 1, 1, colCount).setBackground('#f8fafc');
      }
    }

    // ⭐ 드롭다운 다중선택 열 적용
    // params.dropdownCols: [ { colIndex: 1기반, values: ['값1','값2',...] }, ... ]
    var dropdownCols = params.dropdownCols || [];
    if (dropdownCols.length > 0 && rows.length > 1) {
      dropdownCols.forEach(function(dc) {
        if (!dc.colIndex || !dc.values || !dc.values.length) return;
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(dc.values, true)
          .setAllowInvalid(true)
          .build();
        // 데이터 행에만 적용 (헤더 제외, 2행부터)
        var dataRange = newSheet.getRange(2, dc.colIndex, rows.length - 1, 1);
        dataRange.setDataValidation(rule);
      });
    }

    Logger.log('✅ exportDataToNewSheet 완료: ' + sheetName + ' (' + (rows.length - 1) + '행)');
    return {
      success   : true,
      sheetName : sheetName,
      rowCount  : rows.length - 1  // 헤더 제외
    };

  } catch (err) {
    Logger.log('❌ exportDataToNewSheet 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 교사→학생 메시지 기능
// 시트: teacher_messages
// 컬럼: A=타임스탬프, B=학번, C=이름, D=제목, E=내용, F=읽음여부, G=읽은시간
// ──────────────────────────────────────────────────────────────────────────────

/**
 * 교사가 특정 학생에게 메시지 발송
 * data: { studentId, studentName, title, content }
 */
function sendTeacherMessage(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) {
      sheet = ss.insertSheet('teacher_messages');
      sheet.appendRow(['타임스탬프','학번','이름','제목','내용','읽음여부','읽은시간','학생답장','학생답장시간','학생답장읽음']);
    }
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([ts, String(data.studentId), String(data.studentName), String(data.title), String(data.content), '미읽음', '', '', '', '']);
    return { success: true };
  } catch (err) {
    Logger.log('❌ sendTeacherMessage 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용: 발송한 전체 메시지 목록 조회
 */
function getSentTeacherMessages() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: true, data: [] };
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      result.push({
        rowIndex:         i + 1,
        timestamp:        rows[i][0] ? (rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][0])) : '',
        studentId:        String(rows[i][1] || ''),
        studentName:      String(rows[i][2] || ''),
        title:            String(rows[i][3] || ''),
        content:          String(rows[i][4] || ''),
        readStatus:       String(rows[i][5] || '미읽음'),
        readTime:         rows[i][6] ? (rows[i][6] instanceof Date ? Utilities.formatDate(rows[i][6], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][6])) : '',
        studentReply:     String(rows[i][7] || ''),
        studentReplyTime: rows[i][8] ? (rows[i][8] instanceof Date ? Utilities.formatDate(rows[i][8], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][8])) : '',
        studentReplyRead: String(rows[i][9] || '')
      });
    }
    result.reverse();
    return { success: true, data: result };
  } catch (err) {
    Logger.log('❌ getSentTeacherMessages 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 학생용: 자신에게 온 메시지 조회
 * 시트 열: A타임스탬프 B학번 C이름 D제목 E내용 F읽음여부 G읽은시간 H학생답장 I학생답장시간 J학생답장읽음
 */
function getTeacherMessages(studentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: true, data: [] };
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      if (normalizeId(rows[i][1]) === normalizeId(studentId)) {
        result.push({
          rowIndex:         i + 1,
          timestamp:        rows[i][0] ? (rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][0])) : '',
          title:            String(rows[i][3] || ''),
          content:          String(rows[i][4] || ''),
          readStatus:       String(rows[i][5] || '미읽음'),
          readTime:         rows[i][6] ? (rows[i][6] instanceof Date ? Utilities.formatDate(rows[i][6], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][6])) : '',
          studentReply:     String(rows[i][7] || ''),
          studentReplyTime: rows[i][8] ? (rows[i][8] instanceof Date ? Utilities.formatDate(rows[i][8], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][8])) : ''
        });
      }
    }
    result.reverse();
    return { success: true, data: result };
  } catch (err) {
    Logger.log('❌ getTeacherMessages 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 학생용: 메시지 읽음 처리
 */
function markTeacherMessageRead(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: false, error: '시트 없음' };
    const now = new Date();
    const ts = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(rowIndex, 6).setValue('읽음');
    sheet.getRange(rowIndex, 7).setValue(ts);
    return { success: true };
  } catch (err) {
    Logger.log('❌ markTeacherMessageRead 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용: 발송 메시지 삭제
 */
function deleteTeacherMessage(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: false, error: '시트 없음' };
    if (rowIndex < 2 || rowIndex > sheet.getLastRow()) return { success: false, error: '유효하지 않은 행' };
    sheet.deleteRow(rowIndex);
    return { success: true };
  } catch (err) {
    Logger.log('❌ deleteTeacherMessage 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사 발신 메시지 다중 삭제
 * 행 번호가 큰 것부터 삭제해야 인덱스 밀림 방지
 */
function deleteBulkTeacherMessages(rowIndices) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: false, error: '시트 없음' };
    const lastRow = sheet.getLastRow();
    // 내림차순 정렬 후 삭제 (위 행 삭제 시 아래 행 인덱스 밀림 방지)
    const sorted = rowIndices.filter(r => r >= 2 && r <= lastRow).sort((a, b) => b - a);
    sorted.forEach(r => sheet.deleteRow(r));
    return { success: true, deleted: sorted.length };
  } catch (err) {
    Logger.log('❌ deleteBulkTeacherMessages 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 학생용: 교사 메시지에 답장 저장
 * H열: 학생답장, I열: 학생답장시간, J열: 학생답장읽음
 */
function replyToTeacherMessage(rowIndex, replyContent) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: false, error: '시트 없음' };
    if (rowIndex < 2 || rowIndex > sheet.getLastRow()) return { success: false, error: '유효하지 않은 행' };
    const ts = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(rowIndex, 8).setValue(String(replyContent));  // H열: 학생답장
    sheet.getRange(rowIndex, 9).setValue(ts);                    // I열: 학생답장시간
    sheet.getRange(rowIndex, 10).setValue('미확인');              // J열: 교사 확인 여부
    return { success: true };
  } catch (err) {
    Logger.log('❌ replyToTeacherMessage 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용: 미확인 학생 답장 목록 조회
 */
function getUnreadStudentReplies() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: true, data: [] };
    const rows = sheet.getDataRange().getValues();
    if (rows.length <= 1) return { success: true, data: [] };
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const reply = String(rows[i][7] || '');
      const replyRead = String(rows[i][9] || '');
      if (reply && replyRead === '미확인') {
        result.push({
          rowIndex:         i + 1,
          timestamp:        rows[i][0] ? (rows[i][0] instanceof Date ? Utilities.formatDate(rows[i][0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][0])) : '',
          studentId:        String(rows[i][1] || ''),
          studentName:      String(rows[i][2] || ''),
          title:            String(rows[i][3] || ''),
          studentReply:     reply,
          studentReplyTime: rows[i][8] ? (rows[i][8] instanceof Date ? Utilities.formatDate(rows[i][8], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(rows[i][8])) : ''
        });
      }
    }
    return { success: true, data: result };
  } catch (err) {
    Logger.log('❌ getUnreadStudentReplies 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 교사용: 학생 답장 확인 처리
 */
function markStudentReplyRead(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('teacher_messages');
    if (!sheet) return { success: false, error: '시트 없음' };
    sheet.getRange(rowIndex, 10).setValue('확인');
    return { success: true };
  } catch (err) {
    Logger.log('❌ markStudentReplyRead 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 수면 메모 단어를 Gemini AI로 의미별 카테고리로 분류
 * @param {string[]} words - 분류할 단어 배열
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
function analyzeSleepMemoWords(words) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!apiKey) return { success: false, error: 'API 키가 설정되지 않았습니다.' };
    if (!words || words.length === 0) return { success: false, error: '분류할 단어가 없습니다.' };

    const modelName = 'gemini-2.0-flash';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const wordListText = words.join(', ');
    const prompt = `다음은 청소년들이 수면 메모에 적은 단어/표현 목록이야. 의미가 비슷한 것끼리 묶어서 5개 이하의 카테고리로 분류해줘.

단어 목록: ${wordListText}

규칙:
1. 카테고리 이름은 짧고 직관적으로 (예: 피로·졸림, 스트레스, 불안·걱정, 기분 좋음, 신체 증상)
2. 모든 단어는 반드시 하나의 카테고리에 포함
3. 반드시 아래 JSON 형식으로만 답해. 다른 설명 없이 JSON만 출력.
4. 카테고리는 5개 이하로 제한

출력 형식 (JSON만):
{"카테고리명1": ["단어1", "단어2"], "카테고리명2": ["단어3"]}`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
        candidateCount: 1
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(apiUrl, options);
    const json = JSON.parse(response.getContentText());

    if (!json.candidates || !json.candidates[0]) {
      Logger.log('Gemini 응답: ' + JSON.stringify(json));
      return { success: false, error: 'Gemini 응답을 받지 못했습니다.' };
    }

    const text = json.candidates[0].content.parts[0].text.trim();
    Logger.log('Gemini 단어 분류 응답: ' + text);

    // 마크다운 코드블록 안의 JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { success: false, error: 'JSON 형식 파싱 실패' };

    const categories = JSON.parse(jsonMatch[0]);
    return { success: true, data: categories };

  } catch (err) {
    Logger.log('❌ analyzeSleepMemoWords 오류: ' + err.message);
    return { success: false, error: err.message };
  }
}
