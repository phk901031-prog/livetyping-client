/**
 * Header.tsx — 상단 헤더 바
 *
 * 역할:
 * - 내 이름(닉네임) + 방 코드 표시
 * - 회의 시작/정회/종료 버튼
 * - 테마 전환, 폰트 크기, 영상/상용구/내보내기/초기화 버튼
 * - 연결 상태 표시 (초록 점)
 */
import type { ConnStatus, MeetingStatus } from '../App'

interface HeaderProps {
  displayName: string               // 내 표시 이름
  isP1: boolean                     // 속기사1이면 true (색상 결정용)
  roomCode: string                  // 방 코드

  meetingStatus: MeetingStatus      // 회의 상태
  onMeetingChange: (next: 'running' | 'recess' | 'ended') => void

  theme: 'dark' | 'light'
  onToggleTheme: () => void
  fontSize: number
  onFontIncrease: () => void
  onFontDecrease: () => void

  showVideo: boolean
  onToggleVideo: () => void
  onToggleMacroPanel: () => void
  onExport: () => void
  onClear: () => void

  connStatus: ConnStatus
}

export default function Header({
  displayName,
  isP1,
  roomCode,
  meetingStatus,
  onMeetingChange,
  theme,
  onToggleTheme,
  fontSize,
  onFontIncrease,
  onFontDecrease,
  showVideo,
  onToggleVideo,
  onToggleMacroPanel,
  onExport,
  onClear,
  connStatus,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        {/* 내 이름 배지 (속기사1은 파란색, 속기사2는 초록색) */}
        <span className={`role-badge ${isP1 ? 'p1' : 'p2'}`}>{displayName}</span>
        <span className="room-code-display">
          방 코드: <strong>{roomCode}</strong>
        </span>
      </div>

      <div className="header-right">
        {/* 회의 상태 버튼 */}
        <div className="meeting-btns">
          <button
            className={`btn-meeting start ${meetingStatus === 'running' ? 'active' : ''}`}
            disabled={meetingStatus === 'running' || meetingStatus === 'ended'}
            onClick={() => onMeetingChange('running')}
          >
            회의시작
          </button>
          <button
            className={`btn-meeting recess ${meetingStatus === 'recess' ? 'active' : ''}`}
            disabled={meetingStatus !== 'running'}
            onClick={() => onMeetingChange('recess')}
          >
            정회
          </button>
          <button
            className={`btn-meeting end ${meetingStatus === 'ended' ? 'active' : ''}`}
            disabled={meetingStatus === 'idle' || meetingStatus === 'ended'}
            onClick={() => {
              if (window.confirm('회의를 종료합니다. 계속할까요?')) onMeetingChange('ended')
            }}
          >
            종료
          </button>
        </div>

        {/* 테마 전환 */}
        <button className="btn-theme" onClick={onToggleTheme} title="테마 전환">
          {theme === 'dark' ? '라이트' : '다크'}
        </button>

        {/* 폰트 크기 조절 */}
        <span className="font-size-ctrl" title="Ctrl+마우스휠로도 조절 가능">
          <button onClick={onFontDecrease}>A-</button>
          <span className="font-size-label">{fontSize}</span>
          <button onClick={onFontIncrease}>A+</button>
        </span>

        {/* 기능 버튼들 */}
        <button className="btn-video" onClick={onToggleVideo}>
          {showVideo ? '영상 닫기' : '영상'}
        </button>
        <button className="btn-macro" onClick={onToggleMacroPanel}>
          상용구
        </button>
        <button className="btn-export" onClick={onExport}>
          내보내기
        </button>
        <button className="btn-clear" onClick={onClear}>
          초기화
        </button>

        {/* 연결 상태 표시 */}
        <span className={`conn-dot ${connStatus}`} />
        <span className="conn-label">
          {connStatus === 'connected'
            ? '연결됨'
            : connStatus === 'connecting'
              ? '연결 중…'
              : '재연결 시도 중…'}
        </span>
      </div>
    </header>
  )
}
