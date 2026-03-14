/**
 * VideoPanel.tsx — YouTube 영상 패널
 *
 * 역할:
 * - YouTube URL 입력 + 로드 버튼
 * - 영상 위치(상/하/좌/우) 선택 버튼
 * - 영상 재생 + 배속 조절
 */

type VideoPosition = 'top' | 'bottom' | 'left' | 'right'

interface VideoPanelProps {
  videoUrl: string
  onVideoUrlChange: (url: string) => void
  onLoadVideo: () => void
  videoId: string | null
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
  videoPos,
  onVideoPosChange,
  playbackRate,
  onChangeRate,
}: VideoPanelProps) {
  return (
    <>
      {/* URL 입력 + 위치 선택 */}
      <div className="video-header">
        <div className="video-url-bar">
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
        </div>
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

      {/* 영상 영역 */}
      {videoId ? (
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
      ) : (
        <div className="video-placeholder">YouTube URL을 입력하고 로드 버튼을 누르세요</div>
      )}
    </>
  )
}
