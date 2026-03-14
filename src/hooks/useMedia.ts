/**
 * useMedia.ts — 미디어 재생을 관리하는 Hook (YouTube + 로컬 파일)
 *
 * 이전에는 useYouTube.ts였으나, 로컬 파일 재생 기능이 추가되면서 이름 변경.
 *
 * 이 Hook이 하는 일:
 * 1. YouTube 영상 로드/재생/배속 조절
 * 2. 로컬 음성/영상 파일 로드/재생
 * 3. 영상 패널 위치(상/하/좌/우) + 크기 관리
 * 4. 스플리터 드래그로 크기 조절
 *
 * ⚠️ 소켓 통신(동기화)은 이 Hook이 하지 않음!
 *    App.tsx에서 이 Hook의 함수를 호출하면서 소켓 이벤트를 같이 보냄.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { extractVideoId } from '../utils/helpers'

// 미디어 종류: YouTube인지, 로컬 파일인지, 아무것도 없는지
export type MediaType = 'youtube' | 'localfile' | null

// 영상 패널 위치
type VideoPosition = 'top' | 'bottom' | 'left' | 'right'

export function useMedia() {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 공통 상태
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [showVideo, setShowVideo] = useState(false)       // 미디어 패널 표시 여부
  const [mediaType, setMediaType] = useState<MediaType>(null) // 현재 미디어 종류

  // 배속 (YouTube, 로컬 파일 모두 사용)
  const [playbackRate, setPlaybackRate] = useState(1)

  // 패널 위치/크기 (localStorage에서 불러옴)
  const [videoPos, setVideoPos] = useState<VideoPosition>(() =>
    (localStorage.getItem('lt_video_pos') as VideoPosition) ?? 'top'
  )
  const [videoSize, setVideoSize] = useState<number>(() =>
    Number(localStorage.getItem('lt_video_size')) || 35
  )

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // YouTube 전용 상태
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [videoUrl, setVideoUrl] = useState('')            // 사용자가 입력한 URL
  const [videoId, setVideoId] = useState<string | null>(null) // 추출된 영상 ID
  const ytPlayerRef = useRef<any>(null)                   // YouTube 플레이어 객체

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 로컬 파일 전용 상태
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // localFileUrl: 파일을 브라우저에서 재생할 수 있는 임시 주소 (Blob URL)
  // 비유: USB에 있는 파일을 컴퓨터에 복사해서 임시 폴더에 넣는 것
  const [localFileUrl, setLocalFileUrl] = useState<string | null>(null)
  const [localFileName, setLocalFileName] = useState<string | null>(null)
  const [localFileMime, setLocalFileMime] = useState<string | null>(null)

  // 파일 전송 중 표시 (상대방에게 파일 보내는 동안)
  const [isTransferring, setIsTransferring] = useState(false)

  // 로컬 파일 재생에 사용하는 HTML5 <video> 또는 <audio> 태그 참조
  const localPlayerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 스플리터 드래그 (패널 크기 조절)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const splitterRef = useRef<{ startPos: number; startSize: number } | null>(null)

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // localStorage 저장
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => { localStorage.setItem('lt_video_pos', videoPos) }, [videoPos])
  useEffect(() => { localStorage.setItem('lt_video_size', String(videoSize)) }, [videoSize])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // YouTube IFrame API 스크립트 로드
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (!showVideo) return
    if ((window as any).YT?.Player) return
    if (document.getElementById('yt-api-script')) return
    const tag = document.createElement('script')
    tag.id = 'yt-api-script'
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [showVideo])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // YouTube 플레이어 생성 (videoId가 바뀔 때)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    if (!videoId || !showVideo || mediaType !== 'youtube') return

    const createPlayer = () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }
      ytPlayerRef.current = new (window as any).YT.Player('yt-player', {
        videoId,
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: (e: any) => e.target.setPlaybackRate(playbackRate),
        },
      })
    }

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
  }, [videoId, showVideo, mediaType])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Blob URL 정리 (메모리 누수 방지)
  // 로컬 파일을 로드하면 브라우저가 임시 주소를 만드는데,
  // 안 쓰게 되면 그 주소를 해제해서 메모리를 돌려줘야 함
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const revokeLocalFile = useCallback(() => {
    if (localFileUrl) {
      URL.revokeObjectURL(localFileUrl)
    }
  }, [localFileUrl])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // YouTube 로드 (사용자가 URL 입력 후 "로드" 클릭)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const loadVideo = useCallback((): string | null => {
    const id = extractVideoId(videoUrl)
    if (!id) return null

    // 기존 로컬 파일 정리
    revokeLocalFile()
    setLocalFileUrl(null)
    setLocalFileName(null)
    setLocalFileMime(null)

    // YouTube로 전환
    setVideoId(id)
    setMediaType('youtube')
    setPlaybackRate(1)

    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy()
      ytPlayerRef.current = null
    }

    return id // App.tsx에서 이 ID를 소켓으로 보냄
  }, [videoUrl, revokeLocalFile])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 로컬 파일 로드 (사용자가 "파일" 버튼으로 파일 선택)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const loadLocalFile = useCallback((file: File) => {
    // 기존 리소스 정리
    revokeLocalFile()
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy()
      ytPlayerRef.current = null
    }

    // File 객체를 브라우저에서 재생 가능한 임시 주소(Blob URL)로 변환
    // 비유: USB 파일을 컴퓨터 임시 폴더에 복사하는 것
    const objectUrl = URL.createObjectURL(file)

    setLocalFileUrl(objectUrl)
    setLocalFileName(file.name)
    setLocalFileMime(file.type)
    setVideoId(null)          // YouTube 해제
    setMediaType('localfile') // 로컬 파일 모드로 전환
    setPlaybackRate(1)
  }, [revokeLocalFile])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 상대방으로부터 YouTube 수신 (소켓에서 호출)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const receiveYouTube = useCallback((id: string) => {
    revokeLocalFile()
    setLocalFileUrl(null)
    setLocalFileName(null)
    setLocalFileMime(null)

    setVideoId(id)
    setMediaType('youtube')
    setPlaybackRate(1)
    setShowVideo(true) // 패널 자동 열기
  }, [revokeLocalFile])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 상대방으로부터 로컬 파일 수신 (소켓에서 호출)
  // 상대방이 보낸 바이너리 데이터를 Blob으로 변환 → Blob URL 생성 → 재생
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const receiveLocalFile = useCallback((fileName: string, mime: string, data: ArrayBuffer) => {
    revokeLocalFile()
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy()
      ytPlayerRef.current = null
    }

    // ArrayBuffer(바이너리 데이터) → Blob(파일 객체) → URL(재생 가능한 주소)
    const blob = new Blob([data], { type: mime })
    const objectUrl = URL.createObjectURL(blob)

    setLocalFileUrl(objectUrl)
    setLocalFileName(fileName)
    setLocalFileMime(mime)
    setVideoId(null)
    setMediaType('localfile')
    setPlaybackRate(1)
    setShowVideo(true) // 패널 자동 열기
  }, [revokeLocalFile])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 미디어 닫기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const clearMedia = useCallback(() => {
    revokeLocalFile()
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy()
      ytPlayerRef.current = null
    }
    setLocalFileUrl(null)
    setLocalFileName(null)
    setLocalFileMime(null)
    setVideoId(null)
    setMediaType(null)
  }, [revokeLocalFile])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 배속 변경 (YouTube + 로컬 파일 모두 지원)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const changeRate = useCallback((rate: number) => {
    setPlaybackRate(rate)

    // YouTube 플레이어가 있으면 YouTube 배속 변경
    if (ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(rate)
    }

    // 로컬 파일 플레이어가 있으면 HTML5 플레이어 배속 변경
    if (localPlayerRef.current) {
      localPlayerRef.current.playbackRate = rate
    }
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 스플리터 드래그 (패널 크기 조절)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
      setVideoSize(Math.max(15, Math.min(70, pct)))
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 반환: App.tsx에서 사용할 모든 상태와 함수
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return {
    // 공통
    showVideo, setShowVideo,
    mediaType,
    playbackRate, changeRate,
    videoPos, setVideoPos,
    videoSize,
    startSplitterDrag,
    isTransferring, setIsTransferring,

    // YouTube
    videoUrl, setVideoUrl,
    videoId,
    loadVideo,

    // 로컬 파일
    localFileUrl, localFileName, localFileMime,
    localPlayerRef,
    loadLocalFile,

    // 동기화 수신 (App.tsx의 소켓 이벤트에서 호출)
    receiveYouTube,
    receiveLocalFile,
    clearMedia,
  }
}
