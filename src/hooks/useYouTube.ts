/**
 * useYouTube.ts — YouTube 영상 플레이어를 관리하는 Hook
 *
 * 이 Hook이 하는 일:
 * 1. YouTube IFrame API 로드
 * 2. 영상 로드/재생/배속 조절
 * 3. 영상 패널 위치(상/하/좌/우) + 크기 관리
 * 4. 스플리터 드래그로 크기 조절
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { extractVideoId } from '../utils/helpers'

// VideoPosition: 영상 패널이 화면에서 어디에 위치하는지
type VideoPosition = 'top' | 'bottom' | 'left' | 'right'

export function useYouTube() {
  // ── 상태 ─────────────────────────────────────────────────────
  const [showVideo, setShowVideo] = useState(false)       // 영상 패널 표시 여부
  const [videoUrl, setVideoUrl] = useState('')            // 사용자가 입력한 URL
  const [videoId, setVideoId] = useState<string | null>(null) // 추출된 영상 ID
  const [playbackRate, setPlaybackRate] = useState(1)     // 배속 (기본 1.0x)

  // 영상 패널 위치 (localStorage에서 불러옴)
  const [videoPos, setVideoPos] = useState<VideoPosition>(() =>
    (localStorage.getItem('lt_video_pos') as VideoPosition) ?? 'top'
  )

  // 영상 패널 크기 % (localStorage에서 불러옴)
  const [videoSize, setVideoSize] = useState<number>(() =>
    Number(localStorage.getItem('lt_video_size')) || 35
  )

  // ── Ref ──────────────────────────────────────────────────────
  const ytPlayerRef = useRef<any>(null)         // YouTube 플레이어 객체
  const splitterRef = useRef<{                  // 스플리터 드래그 상태
    startPos: number
    startSize: number
  } | null>(null)

  // ── localStorage 저장 ────────────────────────────────────────
  useEffect(() => { localStorage.setItem('lt_video_pos', videoPos) }, [videoPos])
  useEffect(() => { localStorage.setItem('lt_video_size', String(videoSize)) }, [videoSize])

  // ── YouTube IFrame API 스크립트 로드 ─────────────────────────
  // showVideo가 true가 되면, YouTube API 스크립트를 페이지에 삽입
  useEffect(() => {
    if (!showVideo) return
    if ((window as any).YT?.Player) return                // 이미 로드됨
    if (document.getElementById('yt-api-script')) return  // 이미 삽입됨
    const tag = document.createElement('script')
    tag.id = 'yt-api-script'
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [showVideo])

  // ── 비디오 ID가 바뀌면 플레이어 생성 ────────────────────────
  useEffect(() => {
    if (!videoId || !showVideo) return

    const createPlayer = () => {
      // 기존 플레이어가 있으면 파괴
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }
      // 새 플레이어 생성 (HTML에 id="yt-player"인 div에 삽입)
      ytPlayerRef.current = new (window as any).YT.Player('yt-player', {
        videoId,
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: (e: any) => e.target.setPlaybackRate(playbackRate),
        },
      })
    }

    // API가 이미 로드되었으면 바로 생성, 아니면 API 로드 완료 콜백에 연결
    if ((window as any).YT?.Player) {
      createPlayer()
    } else {
      (window as any).onYouTubeIframeAPIReady = createPlayer
    }

    return () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }
    }
  }, [videoId, showVideo])

  // ── URL에서 영상 ID 추출 후 로드 ────────────────────────────
  const loadVideo = useCallback(() => {
    const id = extractVideoId(videoUrl)
    if (!id) return
    setVideoId(id)
    setPlaybackRate(1)
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy()
      ytPlayerRef.current = null
    }
  }, [videoUrl])

  // ── 배속 변경 ────────────────────────────────────────────────
  const changeRate = useCallback((rate: number) => {
    setPlaybackRate(rate)
    if (ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(rate)
    }
  }, [])

  // ── 스플리터 드래그 ──────────────────────────────────────────
  // 마우스를 드래그해서 영상 패널 크기를 조절하는 기능
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!splitterRef.current) return
      e.preventDefault()
      const isHorizontal = videoPos === 'top' || videoPos === 'bottom'
      const container = document.querySelector('.workspace') as HTMLElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      let pct: number
      if (isHorizontal) {
        const offset = e.clientY - rect.top
        pct = (offset / rect.height) * 100
        if (videoPos === 'bottom') pct = 100 - pct
      } else {
        const offset = e.clientX - rect.left
        pct = (offset / rect.width) * 100
        if (videoPos === 'right') pct = 100 - pct
      }
      setVideoSize(Math.max(15, Math.min(70, pct))) // 15%~70% 범위 제한
    }
    const handleMouseUp = () => {
      splitterRef.current = null
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [videoPos])

  // 스플리터 드래그 시작
  const startSplitterDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const isHorizontal = videoPos === 'top' || videoPos === 'bottom'
      splitterRef.current = {
        startPos: isHorizontal ? e.clientY : e.clientX,
        startSize: videoSize,
      }
      document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize'
    },
    [videoPos, videoSize]
  )

  return {
    showVideo,
    setShowVideo,
    videoUrl,
    setVideoUrl,
    videoId,
    videoPos,
    setVideoPos,
    videoSize,
    playbackRate,
    loadVideo,
    changeRate,
    startSplitterDrag,
  }
}
