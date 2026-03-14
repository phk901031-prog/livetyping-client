/**
 * useMacros.ts — 상용구(매크로) 상태를 관리하는 Hook
 *
 * 이 Hook이 하는 일:
 * 1. 상용구 목록(macros) 관리 + localStorage 저장
 * 2. 키 설정(macroConfig: 트리거키, 삭제키, 등록키) 관리 + localStorage 저장
 * 3. 상용구 패널 열기/닫기
 */
import { useState, useEffect, useRef } from 'react'
import type { Macro } from '../types'
import type { MacroConfig } from '../components/MacroPanel'

export function useMacros() {
  // ── 상용구 목록 ──────────────────────────────────────────────
  // localStorage에서 이전에 등록한 상용구 목록을 불러옴
  const [macros, setMacros] = useState<Macro[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lt_macros') ?? '[]')
    } catch {
      return []
    }
  })

  // ── 키 설정 ──────────────────────────────────────────────────
  // 트리거키(F3), 단어삭제키(F4), 간단등록키(F5) 설정
  const [macroConfig, setMacroConfig] = useState<MacroConfig>(() => {
    try {
      return JSON.parse(
        localStorage.getItem('lt_macro_config') ??
          '{"triggerKey":"F3","jasoDeleteKey":"F4","quickAddKey":"F5"}'
      )
    } catch {
      return { triggerKey: 'F3', jasoDeleteKey: 'F4', quickAddKey: 'F5' }
    }
  })

  // ── 패널 표시 여부 ───────────────────────────────────────────
  const [showMacroPanel, setShowMacroPanel] = useState(false)

  // ── Ref (최신 값을 항상 참조할 수 있도록) ────────────────────
  // useCallback 안에서 state를 직접 읽으면 "옛날 값"이 읽힐 수 있어서
  // ref에 항상 최신 값을 넣어둔다 (카메라 vs 사진 비유: ref는 실시간 카메라)
  const macrosRef = useRef<Macro[]>(macros)
  const macroConfigRef = useRef<MacroConfig>(macroConfig)
  macrosRef.current = macros
  macroConfigRef.current = macroConfig

  // 상용구 목록이 바뀔 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('lt_macros', JSON.stringify(macros))
  }, [macros])

  // 키 설정이 바뀔 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('lt_macro_config', JSON.stringify(macroConfig))
  }, [macroConfig])

  // 상용구 추가
  const addMacro = (m: Macro) => setMacros(prev => [...prev, m])

  // 상용구 삭제 (label과 expand가 모두 일치하는 첫 번째 항목 삭제)
  const deleteMacro = (label: string, expand: string) =>
    setMacros(prev => {
      const idx = prev.findIndex(m => m.label === label && m.expand === expand)
      return idx === -1 ? prev : [...prev.slice(0, idx), ...prev.slice(idx + 1)]
    })

  return {
    macros,
    setMacros,
    macroConfig,
    setMacroConfig,
    showMacroPanel,
    setShowMacroPanel,
    macrosRef,
    macroConfigRef,
    addMacro,
    deleteMacro,
  }
}
