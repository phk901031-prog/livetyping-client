/**
 * VideoPanel.tsx — 미디어 패널 (YouTube + 로컬 파일)
 *
 * 역할:
 * - YouTube URL 입력 + 로드 버튼
 * - 로컬 파일(음성/영상) 불러오기 버튼
 * - 영상 위치(상/하/좌/우) 선택 버튼
 * - YouTube 재생 또는 HTML5 플레이어로 로컬 파일 재생
 * - 배속 조절 (YouTube, 로컬 파일 모두 지원)
 */
import React from 'react'
import type { MediaType } from '../hooks/useMedia'

type VideoPosition = 'top' | 'bottom' | 'left' | 'right'

interface VideoPanelProps {
  // YouTube 관련
  videoUrl: string
  onVideoUrlChange: (url: string) => void
  onLoadVideo: () => void
  videoId: string | null

  // 로컬 파일 관련
  mediaType: MediaType
  localFileUrl: string | null
  localFileName: string | null
  localFileMime: string | null
  isTransferring: boolean
  onLoadLocalFile: (file: File) => void
  localPlayerRef: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>

  // 공통
  videoPos: VideoPosition
  onVideoPosChange: (pos: VideoPosition) => void
  playbackRate: number
  onChangeRate: (rate: number) => void
}

export default function VideoPanel({
  videoUrl,
  onVideoUrlChange,
  onLoadVideo,
  videoId,
  mediaType,
  localFileUrl,
  localFileName,
  localFileMime,
  isTransferring,
  onLoadLocalFile,
  localPlayerRef,
  videoPos,
  onVideoPosChange,
  playbackRate,
  onChangeRate,
}: VideoPanelProps) {
  // 파일이 영상인지 음성인지 판단
  const isVideoFile = localFileMime?.startsWith('video/')

  return (
    <>
      {/* ── 상단 바: URL 입력 + 파일 선택 + 위치 버튼 ───────── */}
      <div className="video-header">
        <div className="video-url-bar">
          {/* YouTube URL 입력 */}
          <input
            type="text"
            className="video-url-input"
            placeholder="YouTube URL 붙여넣기"
            value={videoUrl}
            onChange={e => onVideoUrlChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onLoadVideo()}
          />
          <button className="btn-video-load" onClick={onLoadVideo}>
            로드
          </button>

          {/* 로컬 파일 선택 버튼
              <label>로 감싸면 클릭 시 숨겨진 <input type="file">이 작동함 */}
          <label className="btn-file-load">
            파일
            <input
              type="file"
              accept="audio/*,video/*"
              hidden
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  // 50MB 제한 확인
                  if (file.size > 50 * 1024 * 1024) {
                    alert('파일 크기가 50MB를 초과합니다.')
                    return
                  }
                  onLoadLocalFile(file)
                }
                // 같은 파일을 다시 선택할 수 있도록 초기화
                e.target.value = ''
              }}
            />
          </label>
        </div>

        {/* 패널 위치 선택 버튼 */}
        <div className="video-pos-btns">
          <span className="pos-label">위치:</span>
          {(['top', 'bottom', 'left', 'right'] as const).map(pos => (
            <button
              key={pos}
              className={`btn-pos ${videoPos === pos ? 'active' : ''}`}
              onClick={() => onVideoPosChange(pos)}
            >
              {{ top: '상', bottom: '하', left: '좌', right: '우' }[pos]}
            </button>
          ))}
        </div>
      </div>

      {/* ── 플레이어 영역 ─────────────────────────────────────── */}

      {/* 1) YouTube 모드 */}
      {mediaType === 'youtube' && videoId ? (
        <>
          <div className="video-container">
            <div id="yt-player" />
          </div>
          {/* 배속 조절 */}
          <div className="video-controls">
            <button
              className="btn-rate"
              onClick={() =>
                onChangeRate(Math.max(0.1, Math.round((playbackRate - 0.1) * 10) / 10))
              }
              disabled={playbackRate <= 0.1}
            >
              -
            </button>
            <span className="rate-display">{playbackRate.toFixed(1)}x</span>
            <button
              className="btn-rate"
              onClick={() => onChangeRate(Math.round((playbackRate + 0.1) * 10) / 10)}
            >
              +
            </button>
            <button className="btn-rate reset" onClick={() => onChangeRate(1)}>
              1x
            </button>
          </div>
        </>
      ) : /* 2) 로컬 파일 모드 */
      mediaType === 'localfile' && localFileUrl ? (
        <>
          {/* 파일 이름 표시 */}
          {localFileName && (
            <div className="local-file-name">{localFileName}</div>
          )}
          <div className="video-container local-player-container">
            {/* 영상 파일이면 <video>, 음성 파일이면 <audio> 태그 사용
                controls 속성: 브라우저 기본 재생/정지/탐색 UI를 보여줌 */}
            {isVideoFile ? (
              <video
                ref={localPlayerRef as React.RefObject<HTMLVideoElement>}
                src={localFileUrl}
                controls
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <audio
                ref={localPlayerRef as React.RefObject<HTMLAudioElement>}
                src={localFileUrl}
                controls
                style={{ width: '100%' }}
              />
            )}
          </div>
          {/* 배속 조절 (HTML5 플레이어에도 적용) */}
          <div className="video-controls">
            <button
              className="btn-rate"
              onClick={() =>
                onChangeRate(Math.max(0.1, Math.round((playbackRate - 0.1) * 10) / 10))
              }
              disabled={playbackRate <= 0.1}
            >
              -
            </button>
            <span className="rate-display">{playbackRate.toFixed(1)}x</span>
            <button
              className="btn-rate"
              onClick={() => onChangeRate(Math.round((playbackRate + 0.1) * 10) / 10)}
            >
              +
            </button>
            <button className="btn-rate reset" onClick={() => onChangeRate(1)}>
              1x
            </button>
          </div>
        </>
      ) : /* 3) 전송 중 */
      isTransferring ? (
        <div className="video-placeholder">파일 전송 중...</div>
      ) : (
        /* 4) 아무것도 없을 때 */
        <div className="video-placeholder">
          YouTube URL을 입력하거나 파일을 선택하세요
        </div>
      )}
    </>
  )
}
