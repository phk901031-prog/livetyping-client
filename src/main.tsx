/**
 * main.tsx — 앱의 심장 (진입점)
 *
 * 이 파일은 앱이 처음 실행될 때 딱 한 번만 실행된다.
 * 하는 일:
 * 1. URL 해시(#)를 확인해서 어떤 화면을 보여줄지 결정
 *    - #display?code=123456 → 전광판 모드 (자막 송출용)
 *    - 그 외 → 일반 앱 (속기 모드)
 * 2. HTML에서 id="root"인 <div>를 찾아서 React 앱을 심는다
 *
 * 비유: 자동차 시동 거는 것. 시동 한 번 걸면 엔진(App)이 알아서 돌아간다.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'              // 🧠 뇌 역할을 하는 메인 컴포넌트
import DisplayBoard from './components/DisplayBoard'  // 📺 전광판 컴포넌트
import './App.css'                   // 👕 앱 전체 스타일(옷)

// URL 해시에서 전광판 모드인지 확인
// 예: #display?code=123456 → isDisplay=true, roomCode='123456'
const hash = window.location.hash   // 예: '#display?code=123456'
const isDisplay = hash.startsWith('#display')

// 방 코드 추출 — 여러 URL 형태 지원
// #display?code=123456, #display&code=123456, #display/123456
let displayRoomCode = ''
if (isDisplay) {
  // ?code= 또는 &code= 에서 추출
  const codeMatch = hash.match(/code=(\d{6})/)
  if (codeMatch) {
    displayRoomCode = codeMatch[1]
  } else {
    // #display/123456 형태
    const slashMatch = hash.match(/#display\/(\d{6})/)
    if (slashMatch) displayRoomCode = slashMatch[1]
  }
}

// 디버깅용 콘솔 (문제 발생 시 확인용)
if (isDisplay) {
  console.log('[DisplayBoard] hash:', hash, '→ roomCode:', displayRoomCode)
}

// HTML의 <div id="root">를 찾아서 React 앱을 그 안에 렌더링(그려넣기)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isDisplay
      ? <DisplayBoard roomCode={displayRoomCode} />
      : <App />
    }
  </React.StrictMode>
)
