/**
 * main.tsx — 앱의 심장 (진입점)
 *
 * 이 파일은 앱이 처음 실행될 때 딱 한 번만 실행된다.
 * 하는 일은 단순함:
 * 1. HTML 파일에서 id="root"인 <div>를 찾는다
 * 2. 그 안에 React 앱(<App />)을 심는다
 * 3. 끝! 이후는 App.tsx가 모든 걸 관리한다
 *
 * 비유: 자동차 시동 거는 것. 시동 한 번 걸면 엔진(App)이 알아서 돌아간다.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'     // 🧠 뇌 역할을 하는 메인 컴포넌트
import './App.css'           // 👕 앱 전체 스타일(옷)

// HTML의 <div id="root">를 찾아서 React 앱을 그 안에 렌더링(그려넣기)
// React.StrictMode: 개발 중 실수를 잡아주는 안전장치 (배포 시에는 영향 없음)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
