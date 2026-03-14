/**
 * useTheme.ts — 테마(다크/라이트)와 폰트 크기를 관리하는 Hook
 *
 * 이 Hook이 하는 일:
 * 1. 다크/라이트 테마 전환 + localStorage에 저장
 * 2. 폰트 크기 조절 + localStorage에 저장
 * 3. Ctrl+마우스 휠로 폰트 크기 조절
 */
import { useState, useEffect } from 'react'

export function useTheme() {
  // ── 테마 ──────────────────────────────────────────────────────
  // localStorage에서 이전에 선택한 테마를 불러옴. 없으면 'dark'
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('lt_theme') as 'dark' | 'light') ?? 'dark'
  )

  // ── 폰트 크기 ────────────────────────────────────────────────
  // localStorage에서 이전 크기를 불러옴. 없으면 14px
  const [fontSize, setFontSize] = useState<number>(() =>
    Number(localStorage.getItem('lt_fontsize')) || 14
  )

  // 테마가 바뀔 때마다:
  // 1) HTML 태그에 data-theme 속성 설정 → CSS가 이걸 보고 색상 변경
  // 2) localStorage에 저장 → 새로고침해도 유지
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lt_theme', theme)
  }, [theme])

  // 폰트 크기가 바뀔 때마다:
  // 1) CSS 변수 --seg-font-size 업데이트 → 세그먼트 글자 크기 변경
  // 2) localStorage에 저장
  useEffect(() => {
    document.documentElement.style.setProperty('--seg-font-size', `${fontSize}px`)
    localStorage.setItem('lt_fontsize', String(fontSize))
  }, [fontSize])

  // Ctrl+마우스 휠로 폰트 크기 조절 (10~28px 범위)
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return          // Ctrl 안 누르면 무시
      e.preventDefault()              // 브라우저 기본 줌 방지
      setFontSize(prev =>
        Math.max(10, Math.min(28, e.deltaY < 0 ? prev + 1 : prev - 1))
        // 휠 위로(deltaY < 0) → 크기 +1, 아래로 → -1
      )
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])

  // 테마 토글: 다크이면 라이트로, 라이트이면 다크로
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  // 폰트 크기 1px 증가/감소 (범위: 10~28)
  const increaseFontSize = () => setFontSize(s => Math.min(28, s + 1))
  const decreaseFontSize = () => setFontSize(s => Math.max(10, s - 1))

  return { theme, toggleTheme, fontSize, increaseFontSize, decreaseFontSize }
}
