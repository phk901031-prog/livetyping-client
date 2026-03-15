/**
 * InputArea.tsx — 하단 입력 영역
 *
 * 역할:
 * - 내 이름 + "입력" 라벨 표시
 * - 현재 작성 중인 세그먼트 번호 표시
 * - 상용구 키 안내 (트리거키, 삭제키, 등록키)
 * - 텍스트 입력 + 전송 버튼
 */
import React from 'react'
import type { ConnStatus, MeetingStatus } from '../App'
import type { MacroConfig } from './MacroPanel'

interface InputAreaProps {
  inputRef: React.RefObject<HTMLTextAreaElement>
  displayName: string                     // 내 표시 이름
  isP1: boolean                           // 속기사1이면 true (색상용)
  mySegIndex: number | null               // 현재 작성 중인 세그먼트 번호
  macroConfig: MacroConfig                // 키 설정 (트리거키, 삭제키, 등록키)
  quickAddMsg: string                     // 간단등록 성공 메시지
  inputText: string                       // 현재 입력 텍스트
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  connStatus: ConnStatus
  meetingStatus: MeetingStatus
}

export default function InputArea({
  inputRef,
  displayName,
  isP1,
  mySegIndex,
  macroConfig,
  quickAddMsg,
  inputText,
  onInputChange,
  onKeyDown,
  onSend,
  connStatus,
  meetingStatus,
}: InputAreaProps) {
  return (
    <footer className="input-area">
      {/* 입력 영역 상단: 이름, 세그먼트 번호, 키 안내 */}
      <div className="input-header">
        <span className={`role-badge-sm ${isP1 ? 'p1' : 'p2'}`}>{displayName} 입력</span>
        {mySegIndex !== null && (
          <span className="seg-indicator">세그먼트 #{mySegIndex} 작성 중</span>
        )}
        <div className="key-hints">
          <span className="key-hint">
            상용구 <kbd>{macroConfig.triggerKey}</kbd>
          </span>
          <span className="key-hint">
            단어삭제 <kbd>{macroConfig.jasoDeleteKey}</kbd>
          </span>
          <span className="key-hint">
            간단등록 <kbd>{macroConfig.quickAddKey}</kbd>
          </span>
          <span className="key-hint">
            이동 <kbd>{macroConfig.segUpKey}</kbd><kbd>{macroConfig.segDownKey}</kbd>
          </span>
          {quickAddMsg && <span className="quick-add-msg">{quickAddMsg}</span>}
        </div>
      </div>

      {/* 텍스트 입력 + 전송 버튼 */}
      <div className="input-row">
        <textarea
          ref={inputRef}
          className="main-input"
          value={inputText}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder="입력 후 Enter → 확정 / Shift+Enter → 줄바꿈 / 세그먼트 클릭 → 수정"
          rows={3}
          autoFocus
          disabled={connStatus !== 'connected' || meetingStatus === 'recess'}
        />
        <button
          className="btn-send"
          onClick={onSend}
          disabled={connStatus !== 'connected' || meetingStatus === 'recess'}
        >
          전송
        </button>
      </div>
    </footer>
  )
}
