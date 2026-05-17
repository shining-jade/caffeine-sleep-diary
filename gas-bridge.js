/**
 * gas-bridge.js
 * google.script.run 호출을 GAS 웹앱 GET 요청으로 투명하게 변환합니다.
 *
 * 사용법:
 *   1. window.GAS_API_URL 에 배포된 GAS 웹앱 URL을 설정한 뒤
 *   2. 이 파일을 index.html 에서 <script src="gas-bridge.js"></script> 로 로드하세요.
 *
 * 원리:
 *   google.script.run.함수명(arg1, arg2)
 *     → GAS URL?action=함수명&params=[arg1,arg2] 로 GET 요청
 *     → 응답 { success, data } 파싱 후 핸들러 호출
 *
 * GAS doGet() 에서 param.action 이 있을 때 handleAPIRequest() 를 호출해야 합니다.
 */

(function () {
  'use strict';

  // ── URL 설정 확인 ──────────────────────────────────────────────
  // window.GAS_API_URL 은 index.html <head> 에서 미리 선언해야 합니다.
  // 예) window.GAS_API_URL = 'https://script.google.com/macros/s/XXXXX/exec';

  // ── 내부 fetch 헬퍼 ───────────────────────────────────────────
  async function callGAS(action, params, successHandler, failureHandler) {
    const url = window.GAS_API_URL;

    if (!url || url === '') {
      const msg = '[gas-bridge] GAS_API_URL이 설정되지 않았습니다.';
      console.error(msg);
      if (typeof failureHandler === 'function') failureHandler(new Error(msg));
      return;
    }

    // params 배열 직렬화
    const paramsStr = JSON.stringify(Array.isArray(params) ? params : [params]);

    // GAS GET 요청 URL 조립
    // GAS는 CORS preflight(OPTIONS)를 지원하지 않으므로 GET 방식으로 통신
    const requestUrl = url + '?action=' + encodeURIComponent(action)
                           + '&params=' + encodeURIComponent(paramsStr);

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        // GAS 응답에 CORS 헤더가 없으므로 no-cors 대신 cors 로 받되
        // GAS 웹앱은 "모든 사용자"로 배포 시 실제 CORS 허용됨
      });

      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ' ' + response.statusText);
      }

      const json = await response.json();

      if (json.success === false) {
        const err = new Error(json.error || 'GAS 처리 오류');
        console.error('[gas-bridge] GAS 오류:', json.error);
        if (typeof failureHandler === 'function') failureHandler(err);
        return;
      }

      // success: data 필드를 핸들러에 전달
      if (typeof successHandler === 'function') {
        successHandler(json.data !== undefined ? json.data : json);
      }

    } catch (err) {
      console.error('[gas-bridge] fetch 오류 (' + action + '):', err);
      if (typeof failureHandler === 'function') failureHandler(err);
    }
  }

  // ── google.script.run 폴리필 ──────────────────────────────────
  // 실제 GAS 환경(iframe)에서는 이미 google.script.run 이 존재하므로 덮어쓰지 않음
  if (typeof google !== 'undefined' && google.script && google.script.run) {
    console.log('[gas-bridge] 실제 GAS 환경 감지 → 폴리필 비활성화');
    return;
  }

  // GAS 환경이 아닌 경우(GitHub Pages 등) → 폴리필 활성화
  console.log('[gas-bridge] GitHub Pages 환경 감지 → GAS fetch 폴리필 활성화');

  // google 네임스페이스 생성
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  /**
   * google.script.run 프록시
   *
   * 사용 패턴:
   *   google.script.run
   *     .withSuccessHandler(fn)
   *     .withFailureHandler(fn)
   *     .함수명(arg1, arg2, ...)
   */
  window.google.script.run = new Proxy({}, {
    get: function (target, action) {
      // .withSuccessHandler() / .withFailureHandler() 빌더 패턴 지원
      if (action === 'withSuccessHandler' || action === 'withFailureHandler') {
        // 빌더 객체를 반환 — 체이닝 가능
        return function (handler) {
          return buildRunner(action === 'withSuccessHandler' ? handler : null,
                             action === 'withFailureHandler' ? handler : null);
        };
      }

      // 핸들러 없이 직접 호출: google.script.run.함수명(args)
      return function (...args) {
        callGAS(action, args, null, function (err) {
          console.warn('[gas-bridge] 핸들러 없는 호출 실패 (' + action + '):', err.message);
        });
      };
    }
  });

  /**
   * 빌더 — withSuccessHandler / withFailureHandler 체이닝
   */
  function buildRunner(successHandler, failureHandler) {
    const runner = new Proxy({}, {
      get: function (target, action) {
        if (action === 'withSuccessHandler') {
          return function (fn) { return buildRunner(fn, failureHandler); };
        }
        if (action === 'withFailureHandler') {
          return function (fn) { return buildRunner(successHandler, fn); };
        }
        // 실제 함수 호출
        return function (...args) {
          callGAS(action, args, successHandler, failureHandler);
        };
      }
    });
    return runner;
  }

  // ── google.script.history / url (혹시 사용되는 경우 빈 stub) ──
  window.google.script.history = window.google.script.history || {
    push: function () {},
    replace: function () {},
  };
  window.google.script.url = window.google.script.url || {
    getLocation: function (cb) { if (typeof cb === 'function') cb({}); },
  };

})();
