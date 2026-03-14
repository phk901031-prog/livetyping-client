/**
 * Lobby.tsx — 방 입장 전 화면 (로비)
 *
 * 역할:
 * - 이름 입력
 * - "새 방 만들기" 버튼
 * - 방 코드 입력 + "방 참여하기" 버튼
 * - 연결 중 메시지 표시
 */
import type { ConnStatus } from '../App'

interface LobbyProps {
  nickname: string                        // 현재 입력된 이름
  onNicknameChange: (name: string) => void // 이름이 바뀔 때 호출
  joinCode: string                        // 현재 입력된 방 코드
  onJoinCodeChange: (code: string) => void // 방 코드가 바뀔 때 호출
  joinError: string                       // 참여 실패 시 에러 메시지
  connStatus: ConnStatus                  // 연결 상태
  onCreateRoom: () => void                // "새 방 만들기" 클릭 시
  onJoinRoom: () => void                  // "방 참여하기" 클릭 시
}

export default function Lobby({
  nickname,
  onNicknameChange,
  joinCode,
  onJoinCodeChange,
  joinError,
  connStatus,
  onCreateRoom,
  onJoinRoom,
}: LobbyProps) {
  return (
    <div className="mode-screen">
      <div className="mode-card">
        <h1 className="logo">LiveTyping Online</h1>
        <p className="subtitle">속기사 실시간 협업 도구 (온라인)</p>

        {/* 이름 입력란 */}
        <div className="nickname-input-group">
          <label className="nickname-label">이름</label>
          <input
            type="text"
            className="nickname-input"
            placeholder="표시할 이름을 입력하세요"
            value={nickname}
            onChange={e => onNicknameChange(e.target.value.slice(0, 10))}
            maxLength={10}
          />
        </div>

        <div className="mode-options">
          {/* 새 방 만들기 버튼 */}
          <button className="btn-p1" onClick={onCreateRoom}>
            <span className="btn-icon">+</span>
            <span>
              <strong>새 방 만들기</strong>
              <small>방 코드가 생성됩니다</small>
            </span>
          </button>

          <div className="divider">또는</div>

          {/* 방 코드 입력 + 참여 버튼 */}
          <div className="client-group">
            <input
              type="text"
              className="ip-input"
              placeholder="방 코드 입력 (6자리 숫자)"
              value={joinCode}
              onChange={e => onJoinCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && onJoinRoom()}
              maxLength={6}
            />
            {joinError && <p className="join-error">{joinError}</p>}
            <button
              className="btn-p2"
              onClick={onJoinRoom}
              disabled={joinCode.length !== 6}
            >
              <span className="btn-icon">→</span>
              <span>
                <strong>방 참여하기</strong>
                <small>방 코드로 접속</small>
              </span>
            </button>
          </div>
        </div>

        {/* 연결 중 표시 */}
        {connStatus === 'connecting' && (
          <p className="connecting-msg">서버 연결 중...</p>
        )}
      </div>
    </div>
  )
}
