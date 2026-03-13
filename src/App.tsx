import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import MacroPanel, { MacroConfig } from './components/MacroPanel'
import type { UserRole, Segment, Macro, RoomState, Nicknames } from './types'

// 서버 URL: 개발 시 localhost, 배포 시 환경변수
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

type ConnStatus = 'disconnected' | 'connecting' | 'connected'
type MeetingStatus = 'idle' | 'running' | 'recess' | 'ended'

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [nickname, setNickname] = useState('')              // 로비에서 입력하는 내 이름
  const [nicknames, setNicknames] = useState<Nicknames>({}) // 역할→이름 변환표 (예: {'속기사1':'김철수'})

  const [segments, setSegments] = useState<Segment[]>([])
  const [inputText, setInputText] = useState('')
  const [mySegIndex, setMySegIndex] = useState<number | null>(null)
  const [isCreatingSegment, setIsCreatingSegment] = useState(false)
  const [displayOrder, setDisplayOrder] = useState<number[]>([])

  const [quickAddMsg, setQuickAddMsg] = useState('')
  const [reconnectMsg, setReconnectMsg] = useState('')

  // 테마 & 폰트
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('lt_theme') as 'dark' | 'light') ?? 'dark'
  )
  const [fontSize, setFontSize] = useState<number>(() =>
    Number(localStorage.getItem('lt_fontsize')) || 14
  )

  // 회의 상태
  const [meetingStatus, setMeetingStatus] = useState<MeetingStatus>('idle')

  // 드래그 앤 드롭
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // 인라인 수정
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  // 상용구
  const [macros, setMacros] = useState<Macro[]>(() => {
    try { return JSON.parse(localStorage.getItem('lt_macros') ?? '[]') }
    catch { return [] }
  })
  const [macroConfig, setMacroConfig] = useState<MacroConfig>(() => {
    try { return JSON.parse(localStorage.getItem('lt_macro_config') ?? '{"triggerKey":"F3","jasoDeleteKey":"F4","quickAddKey":"F5"}') }
    catch { return { triggerKey: 'F3', jasoDeleteKey: 'F4', quickAddKey: 'F5' } }
  })
  const [showMacroPanel, setShowMacroPanel] = useState(false)

  // YouTube 플레이어
  const [showVideo, setShowVideo] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [playbackRate, setPlaybackRate] = useState(1)
  type VideoPosition = 'top' | 'bottom' | 'left' | 'right'
  const [videoPos, setVideoPos] = useState<VideoPosition>(() =>
    (localStorage.getItem('lt_video_pos') as VideoPosition) ?? 'top'
  )
  const [videoSize, setVideoSize] = useState<number>(() =>
    Number(localStorage.getItem('lt_video_size')) || 35
  )
  const ytPlayerRef = useRef<any>(null)
  const splitterRef = useRef<{ startPos: number; startSize: number } | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const pendingContentRef = useRef<string | null>(null)
  const mySegIndexRef = useRef<number | null>(null)
  const isCreatingRef = useRef(false)
  const roleRef = useRef<UserRole | null>(null)
  const macrosRef = useRef<Macro[]>(macros)
  const macroConfigRef = useRef<MacroConfig>(macroConfig)
  const skipInputRef = useRef<false | 'clear' | 'keep'>(false)
  const socketRef = useRef<Socket | null>(null)

  mySegIndexRef.current = mySegIndex
  isCreatingRef.current = isCreatingSegment
  roleRef.current = role
  macrosRef.current = macros
  macroConfigRef.current = macroConfig
  socketRef.current = socket

  // ─── 닉네임 헬퍼 ────────────────────────────────────────────────────────────
  // 역할 이름을 표시용 닉네임으로 변환 (예: '속기사1' → '김철수')
  // 닉네임이 없으면 역할 이름 그대로 반환
  const displayName = useCallback((r: UserRole | string) => nicknames[r] || r, [nicknames])

  // ─── 헬퍼 ───────────────────────────────────────────────────────────────────
  const buildKeyString = (e: KeyboardEvent | React.KeyboardEvent): string => {
    const parts: string[] = []
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.altKey) parts.push('Alt')
    if (e.shiftKey) parts.push('Shift')
    let k = e.key
    if (k === 'Process' || k === 'Unidentified') {
      k = (e as any).code ?? ''
      if (k.startsWith('Key')) k = k.slice(3)
    }
    if (!k) return ''
    parts.push(k.length === 1 ? k.toUpperCase() : k)
    return parts.join('+')
  }

  const deleteWord = useCallback((text: string, cursor: number) => {
    if (cursor === 0) return { newText: text, newCursor: 0 }
    const before = text.slice(0, cursor)

    // 커서 바로 앞이 공백이면 공백만 제거
    if (before.endsWith(' ')) {
      const trimmed = before.trimEnd()
      return { newText: trimmed + text.slice(cursor), newCursor: trimmed.length }
    }

    const spaceIdx = before.lastIndexOf(' ')
    if (spaceIdx === -1) return { newText: text.slice(cursor), newCursor: 0 }

    // 공백 뒤의 단어만 삭제 (공백은 보존)
    return { newText: text.slice(0, spaceIdx + 1) + text.slice(cursor), newCursor: spaceIdx + 1 }
  }, [])

  // ─── localStorage 동기화 ─────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('lt_macros', JSON.stringify(macros)) }, [macros])
  useEffect(() => { localStorage.setItem('lt_macro_config', JSON.stringify(macroConfig)) }, [macroConfig])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('lt_theme', theme)
  }, [theme])
  useEffect(() => {
    document.documentElement.style.setProperty('--seg-font-size', `${fontSize}px`)
    localStorage.setItem('lt_fontsize', String(fontSize))
  }, [fontSize])

  // Ctrl+휠 폰트 크기
  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setFontSize(prev => Math.max(10, Math.min(28, e.deltaY < 0 ? prev + 1 : prev - 1)))
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [])

  // 자동 스크롤
  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [segments])

  // ─── 소켓 연결 및 이벤트 ────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(SERVER_URL, { autoConnect: false })
    setSocket(s)

    s.on('connect', () => {
      setConnStatus(prev => {
        if (prev === 'disconnected') {
          setReconnectMsg('서버 연결 성공!')
          setTimeout(() => setReconnectMsg(''), 3000)
        }
        return 'connected'
      })
    })

    s.on('disconnect', () => setConnStatus('disconnected'))

    s.on('state:sync', (state: RoomState) => {
      setSegments(prev => {
        const myIdx = mySegIndexRef.current
        if (myIdx !== null) {
          // 자신이 타이핑 중인 세그먼트는 로컬 상태 유지 (IME 조합 중단 방지)
          const myLocalSeg = prev.find(seg => seg.index === myIdx)
          if (myLocalSeg) {
            return state.segments.map(seg =>
              seg.index === myIdx ? myLocalSeg : seg
            )
          }
        }
        return [...state.segments]
      })
      if (state.displayOrder?.length > 0) setDisplayOrder([...state.displayOrder])
      if (state.role) {
        setRole(state.role)
        roleRef.current = state.role
      }
      // 서버에서 닉네임 정보가 오면 저장
      if (state.nicknames) {
        setNicknames(state.nicknames)
      }
    })

    s.on('member:joined', ({ role: r, nickname: n }: { role: UserRole; nickname?: string }) => {
      // 참여 알림에 닉네임이 있으면 변환표 업데이트 + 이름으로 표시
      if (n) setNicknames(prev => ({ ...prev, [r]: n }))
      setReconnectMsg(`${n || r} 참여!`)
      setTimeout(() => setReconnectMsg(''), 3000)
    })

    s.on('member:left', ({ role: r }: { role: UserRole }) => {
      setReconnectMsg(`${r} 퇴장`)
      setTimeout(() => setReconnectMsg(''), 3000)
    })

    return () => { s.disconnect() }
  }, [])

  // Focus Management
  const prevSegCountRef = useRef(0)
  useEffect(() => {
    if (segments.length > prevSegCountRef.current) {
      const active = document.activeElement
      const isEditingInline = active?.classList.contains('seg-edit-input')
      // 이미 입력창에 포커스되어 있으면 .focus() 호출 생략 (IME 조합 중단 방지)
      if (!isEditingInline && active !== inputRef.current) inputRef.current?.focus()
    }
    prevSegCountRef.current = segments.length
  }, [segments.length])

  // ─── 방 생성 / 참여 ──────────────────────────────────────────────────────────
  const handleCreateRoom = useCallback(() => {
    if (!socket) return
    setConnStatus('connecting')
    socket.connect()

    const tryCreate = () => {
      // 서버에 닉네임을 함께 보냄
      const myName = nickname.trim() || '속기사1'
      socket.emit('room:create', myName, (res: { ok: boolean; code?: string }) => {
        if (res.ok && res.code) {
          setRoomCode(res.code)
          setRole('속기사1')
          roleRef.current = '속기사1'
          setNicknames({ '속기사1': myName })   // 내 이름표 저장
        }
      })
    }

    if (socket.connected) tryCreate()
    else socket.once('connect', tryCreate)
  }, [socket, nickname])

  const handleJoinRoom = useCallback(() => {
    if (!socket || !joinCode.trim()) return
    setJoinError('')
    setConnStatus('connecting')
    socket.connect()

    const tryJoin = () => {
      const myName = nickname.trim() || '속기사2'
      // 서버에 방코드 + 닉네임을 함께 보냄
      socket.emit('room:join', joinCode.trim(), myName, (res: { ok: boolean; error?: string; role?: UserRole }) => {
        if (res.ok) {
          setRoomCode(joinCode.trim())
          setConnStatus('connected')
          if (res.role) {
            setRole(res.role)
            roleRef.current = res.role
          }
        } else {
          setJoinError(res.error || '참여 실패')
          setConnStatus('disconnected')
        }
      })
    }

    if (socket.connected) tryJoin()
    else socket.once('connect', tryJoin)
  }, [socket, joinCode, nickname])

  // ─── 상용구 삽입 ──────────────────────────────────────────────────────────────
  const insertMacroText = useCallback((macro: Macro) => {
    const textarea = inputRef.current
    if (!textarea) return

    const text = textarea.value
    const cursorPos = textarea.selectionStart ?? text.length
    const selEnd = textarea.selectionEnd ?? text.length
    const beforeCursor = text.slice(0, cursorPos)
    const insertFrom = beforeCursor.endsWith(macro.label)
      ? cursorPos - macro.label.length : cursorPos
    const newText = text.slice(0, insertFrom) + macro.expand + text.slice(selEnd)

    skipInputRef.current = 'keep'
    setInputText(newText)

    requestAnimationFrame(() => {
      const pos = insertFrom + macro.expand.length
      textarea.selectionStart = pos
      textarea.selectionEnd = pos
    })

    const idx = mySegIndexRef.current
    if (idx !== null) {
      setSegments(prev =>
        prev.map(s => (s.index === idx ? { ...s, content: newText, status: 'typing' } : s))
      )
      socketRef.current?.emit('segment:update', { index: idx, content: newText, status: 'typing' })
    }
  }, [])

  // ─── 새 세그먼트 생성 ──────────────────────────────────────────────────────
  const createNewSegment = useCallback(async (user: UserRole, initialContent: string) => {
    if (!socketRef.current) return
    isCreatingRef.current = true
    setIsCreatingSegment(true)
    pendingContentRef.current = null

    const tempIndex = -(Date.now())
    setSegments(prev => [
      ...prev,
      { index: tempIndex, user, content: initialContent, status: 'typing' }
    ])

    const index = await new Promise<number>(resolve => {
      socketRef.current!.emit('segment:new', { user, content: initialContent }, (idx: number) => resolve(idx))
    })

    setSegments(prev =>
      prev
        .map(s => (s.index === tempIndex ? { ...s, index } : s))
        .sort((a, b) => a.index - b.index)
    )
    setMySegIndex(index)
    mySegIndexRef.current = index
    isCreatingRef.current = false
    setIsCreatingSegment(false)

    if (pendingContentRef.current !== null) {
      socketRef.current?.emit('segment:update', { index, content: pendingContentRef.current, status: 'typing' })
      setSegments(prev =>
        prev.map(s => (s.index === index ? { ...s, content: pendingContentRef.current! } : s))
      )
      pendingContentRef.current = null
    }
  }, [])

  // ─── 입력 onChange ──────────────────────────────────────────────────────────
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (skipInputRef.current === 'clear') {
        skipInputRef.current = false
        e.target.value = ''
        setInputText('')
        return
      }
      if (skipInputRef.current === 'keep') {
        skipInputRef.current = false
        return
      }

      const text = e.target.value
      setInputText(text)
      const currentRole = roleRef.current
      if (!currentRole) return

      if (mySegIndexRef.current !== null) {
        const idx = mySegIndexRef.current
        setSegments(prev => prev.map(s => (s.index === idx ? { ...s, content: text, status: 'typing' } : s)))
        socketRef.current?.emit('segment:update', { index: idx, content: text, status: 'typing' })
      } else if (isCreatingRef.current) {
        pendingContentRef.current = text
      } else {
        createNewSegment(currentRole, text)
      }
    },
    [createNewSegment]
  )

  // ─── keydown ──────────────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const keyStr = buildKeyString(e)

      // 1. 간단등록
      if (keyStr === macroConfigRef.current.quickAddKey) {
        e.preventDefault()
        const textarea = inputRef.current
        if (!textarea) return
        const currentText = textarea.value.trim()
        const colonIdx = currentText.indexOf(':')
        if (colonIdx > 0) {
          const lbl = currentText.slice(0, colonIdx).trim()
          const exp = currentText.slice(colonIdx + 1).trim()
          if (lbl && exp) {
            setMacros(prev => [...prev, { label: lbl, expand: exp }])
            setQuickAddMsg(`"${lbl}" 등록됨`)
            setTimeout(() => setQuickAddMsg(''), 2000)
          }
        }
        const idx = mySegIndexRef.current
        if (idx !== null) {
          setSegments(prev => prev.filter(s => s.index !== idx))
          socketRef.current?.emit('segment:update', { index: idx, content: '', status: 'completed' })
        }
        skipInputRef.current = 'clear'
        setInputText('')
        setMySegIndex(null)
        mySegIndexRef.current = null
        requestAnimationFrame(() => textarea.focus())
        return
      }

      // 2. 단어삭제
      if (keyStr === macroConfigRef.current.jasoDeleteKey) {
        e.preventDefault()
        const textarea = inputRef.current
        const currentText = textarea?.value ?? inputText
        const cursor = textarea?.selectionStart ?? currentText.length
        const { newText, newCursor } = deleteWord(currentText, cursor)
        // IME compositionend에 의한 onChange 재진입 방지
        skipInputRef.current = 'keep'
        setInputText(newText)
        requestAnimationFrame(() => {
          if (textarea) { textarea.selectionStart = newCursor; textarea.selectionEnd = newCursor }
        })
        const idx = mySegIndexRef.current
        if (idx !== null) {
          setSegments(prev => prev.map(s => s.index === idx ? { ...s, content: newText } : s))
          socketRef.current?.emit('segment:update', { index: idx, content: newText, status: 'typing' })
        }
        return
      }

      // 3. 상용구 트리거
      if (keyStr === macroConfigRef.current.triggerKey) {
        e.preventDefault()
        const textarea = inputRef.current
        if (!textarea) return
        const text = textarea.value
        const cursorPos = textarea.selectionStart ?? text.length
        const beforeCursor = text.slice(0, cursorPos)
        const allMacros = macrosRef.current

        // 순환 처리
        const expandMatch = [...allMacros]
          .sort((a, b) => b.expand.length - a.expand.length)
          .find(m => m.expand && beforeCursor.endsWith(m.expand))

        if (expandMatch) {
          const group = allMacros.filter(m => m.label === expandMatch.label)
          if (group.length > 1) {
            const currentIdx = group.findIndex(m => m.expand === expandMatch.expand)
            const next = group[(currentIdx + 1) % group.length]
            const deleteFrom = cursorPos - expandMatch.expand.length
            const newText = text.slice(0, deleteFrom) + next.expand + text.slice(cursorPos)
            skipInputRef.current = 'keep'
            setInputText(newText)
            requestAnimationFrame(() => {
              const pos = deleteFrom + next.expand.length
              textarea.selectionStart = pos
              textarea.selectionEnd = pos
            })
            const idx = mySegIndexRef.current
            if (idx !== null) {
              setSegments(prev => prev.map(s => s.index === idx ? { ...s, content: newText } : s))
              socketRef.current?.emit('segment:update', { index: idx, content: newText, status: 'typing' })
            }
            return
          }
        }

        const matched = [...allMacros]
          .sort((a, b) => b.label.length - a.label.length)
          .find(m => m.label && beforeCursor.endsWith(m.label))

        if (matched) {
          const group = allMacros.filter(m => m.label === matched.label)
          insertMacroText(group[0])
        }
        return
      }

      // 4. Enter 확정
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const idx = mySegIndexRef.current
        const finalText = inputRef.current?.value ?? inputText
        if (idx !== null) {
          setSegments(prev =>
            prev.map(s => s.index === idx ? { ...s, content: finalText, status: 'completed' } : s)
          )
          socketRef.current?.emit('segment:update', { index: idx, content: finalText, status: 'completed' })
          setMySegIndex(null)
          mySegIndexRef.current = null
        }
        setInputText('')
        inputRef.current?.focus()
      }
    },
    [insertMacroText, deleteWord]
  )

  // ─── 전송 버튼 ──────────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const idx = mySegIndexRef.current
    if (idx !== null && inputText.trim()) {
      setSegments(prev =>
        prev.map(s => (s.index === idx ? { ...s, content: inputText, status: 'completed' } : s))
      )
      socketRef.current?.emit('segment:update', { index: idx, content: inputText, status: 'completed' })
      setMySegIndex(null)
      mySegIndexRef.current = null
      setInputText('')
    }
    inputRef.current?.focus()
  }, [inputText])

  // ─── 드래그 앤 드롭 ────────────────────────────────────────────────────────
  const handleDragStart = useCallback((segIndex: number) => setDraggingIdx(segIndex), [])
  const handleDragOver = useCallback((e: React.DragEvent, segIndex: number) => {
    e.preventDefault()
    setDragOverIdx(segIndex)
  }, [])
  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    setDraggingIdx(null)
    setDragOverIdx(null)
    if (draggingIdx === null || draggingIdx === targetIndex) return
    setDisplayOrder(prev => {
      const order = [...prev]
      const fromPos = order.indexOf(draggingIdx)
      const toPos = order.indexOf(targetIndex)
      if (fromPos === -1 || toPos === -1) return prev
      order.splice(fromPos, 1)
      order.splice(toPos, 0, draggingIdx)
      socketRef.current?.emit('segment:reorder', order)
      return order
    })
  }, [draggingIdx])

  // ─── 인라인 수정 ──────────────────────────────────────────────────────────
  const handleSegmentClick = useCallback((seg: Segment) => {
    if (seg.status === 'typing' && seg.index === mySegIndexRef.current) return
    setEditingIndex(seg.index)
    setEditingText(seg.content)
  }, [])

  const commitInlineEdit = useCallback((index: number, text: string) => {
    setSegments(prev => prev.map(s => (s.index === index ? { ...s, content: text, status: 'completed' } : s)))
    socketRef.current?.emit('segment:update', { index, content: text, status: 'completed' })
    setEditingIndex(null)
    setEditingText('')
    inputRef.current?.focus()
  }, [])

  const handleInlineKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitInlineEdit(index, editingText) }
      if (e.key === 'Escape') { setEditingIndex(null); setEditingText(''); inputRef.current?.focus() }
    },
    [editingText, commitInlineEdit]
  )

  // ─── 회의 상태 ──────────────────────────────────────────────────────────────
  const changeMeetingStatus = useCallback((next: 'running' | 'recess' | 'ended') => {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    const labels: Record<string, string> = { running: '회의 시작', recess: '정  회', ended: '회의 종료' }
    const marker = `──── ${labels[next]} (${timeStr}) ────`
    const currentRole = roleRef.current
    if (currentRole && socketRef.current) {
      socketRef.current.emit('segment:new', { user: currentRole, content: marker }, (index: number) => {
        socketRef.current?.emit('segment:update', { index, content: marker, status: 'completed' })
      })
    }
    setMeetingStatus(next)
  }, [])

  // ─── 초기화 ──────────────────────────────────────────────────────────────────
  const handleClearScreen = useCallback(() => {
    if (!window.confirm('화면을 초기화합니다. 계속할까요?')) return
    setSegments([])
    setInputText('')
    setMySegIndex(null)
    mySegIndexRef.current = null
    inputRef.current?.focus()
  }, [])

  // 영상 위치/크기 저장
  useEffect(() => { localStorage.setItem('lt_video_pos', videoPos) }, [videoPos])
  useEffect(() => { localStorage.setItem('lt_video_size', String(videoSize)) }, [videoSize])

  // 스플리터 드래그
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
    const handleMouseUp = () => { splitterRef.current = null; document.body.style.cursor = '' }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [videoPos])

  const startSplitterDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const isHorizontal = videoPos === 'top' || videoPos === 'bottom'
    splitterRef.current = { startPos: isHorizontal ? e.clientY : e.clientX, startSize: videoSize }
    document.body.style.cursor = isHorizontal ? 'row-resize' : 'col-resize'
  }, [videoPos, videoSize])

  // ─── YouTube 플레이어 ──────────────────────────────────────────────────────
  const extractVideoId = useCallback((url: string): string | null => {
    // youtube.com/watch?v=ID, youtu.be/ID, youtube.com/live/ID
    const patterns = [
      /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    ]
    for (const p of patterns) {
      const m = url.match(p)
      if (m) return m[1]
    }
    return null
  }, [])

  const loadVideo = useCallback(() => {
    const id = extractVideoId(videoUrl)
    if (!id) return
    setVideoId(id)
    setPlaybackRate(1)
    // 기존 플레이어 제거
    if (ytPlayerRef.current) {
      ytPlayerRef.current.destroy()
      ytPlayerRef.current = null
    }
  }, [videoUrl, extractVideoId])

  // YouTube IFrame API 로드
  useEffect(() => {
    if (!showVideo) return
    if ((window as any).YT?.Player) return
    if (document.getElementById('yt-api-script')) return
    const tag = document.createElement('script')
    tag.id = 'yt-api-script'
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
  }, [showVideo])

  // 비디오 ID 변경 시 플레이어 생성
  useEffect(() => {
    if (!videoId || !showVideo) return

    const createPlayer = () => {
      if (ytPlayerRef.current) {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }
      ytPlayerRef.current = new (window as any).YT.Player('yt-player', {
        videoId,
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: (e: any) => {
            e.target.setPlaybackRate(playbackRate)
          }
        }
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
  }, [videoId, showVideo])

  // 배속 변경
  const changeRate = useCallback((rate: number) => {
    setPlaybackRate(rate)
    if (ytPlayerRef.current?.setPlaybackRate) {
      ytPlayerRef.current.setPlaybackRate(rate)
    }
  }, [])

  // ─── .txt 내보내기 ──────────────────────────────────────────────────────────
  const handleExportTxt = useCallback(() => {
    const ordered = displayOrder.length > 0
      ? displayOrder.map(idx => segments.find(s => s.index === idx)).filter(Boolean) as Segment[]
      : segments
    const text = ordered.map(s => s.content).join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}`
    a.download = `회의록_${dateStr}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [segments, displayOrder])

  // ─── 방 입장 전 화면 ────────────────────────────────────────────────────────
  if (!roomCode) {
    return (
      <div className="mode-screen">
        <div className="mode-card">
          <h1 className="logo">LiveTyping Online</h1>
          <p className="subtitle">속기사 실시간 협업 도구 (온라인)</p>

          <div className="nickname-input-group">
            <label className="nickname-label">이름</label>
            <input
              type="text"
              className="nickname-input"
              placeholder="표시할 이름을 입력하세요"
              value={nickname}
              onChange={e => setNickname(e.target.value.slice(0, 10))}
              maxLength={10}
            />
          </div>

          <div className="mode-options">
            <button className="btn-p1" onClick={handleCreateRoom}>
              <span className="btn-icon">+</span>
              <span>
                <strong>새 방 만들기</strong>
                <small>방 코드가 생성됩니다</small>
              </span>
            </button>

            <div className="divider">또는</div>

            <div className="client-group">
              <input
                type="text"
                className="ip-input"
                placeholder="방 코드 입력 (6자리 숫자)"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
                maxLength={6}
              />
              {joinError && <p className="join-error">{joinError}</p>}
              <button className="btn-p2" onClick={handleJoinRoom} disabled={joinCode.length !== 6}>
                <span className="btn-icon">→</span>
                <span>
                  <strong>방 참여하기</strong>
                  <small>방 코드로 접속</small>
                </span>
              </button>
            </div>
          </div>

          {connStatus === 'connecting' && (
            <p className="connecting-msg">서버 연결 중...</p>
          )}
        </div>
      </div>
    )
  }

  // ─── 메인 화면 ──────────────────────────────────────────────────────────────
  const isP1 = role === '속기사1'

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className={`role-badge ${isP1 ? 'p1' : 'p2'}`}>{role ? displayName(role) : ''}</span>
          <span className="room-code-display">
            방 코드: <strong>{roomCode}</strong>
          </span>
        </div>

        <div className="header-right">
          <div className="meeting-btns">
            <button
              className={`btn-meeting start ${meetingStatus === 'running' ? 'active' : ''}`}
              disabled={meetingStatus === 'running' || meetingStatus === 'ended'}
              onClick={() => changeMeetingStatus('running')}
            >회의시작</button>
            <button
              className={`btn-meeting recess ${meetingStatus === 'recess' ? 'active' : ''}`}
              disabled={meetingStatus !== 'running'}
              onClick={() => changeMeetingStatus('recess')}
            >정회</button>
            <button
              className={`btn-meeting end ${meetingStatus === 'ended' ? 'active' : ''}`}
              disabled={meetingStatus === 'idle' || meetingStatus === 'ended'}
              onClick={() => {
                if (window.confirm('회의를 종료합니다. 계속할까요?')) changeMeetingStatus('ended')
              }}
            >종료</button>
          </div>

          <button
            className="btn-theme"
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title="테마 전환"
          >
            {theme === 'dark' ? '라이트' : '다크'}
          </button>
          <span className="font-size-ctrl" title="Ctrl+마우스휠로도 조절 가능">
            <button onClick={() => setFontSize(s => Math.max(10, s - 1))}>A-</button>
            <span className="font-size-label">{fontSize}</span>
            <button onClick={() => setFontSize(s => Math.min(28, s + 1))}>A+</button>
          </span>
          <button className="btn-video" onClick={() => setShowVideo(v => !v)}>
            {showVideo ? '영상 닫기' : '영상'}
          </button>
          <button className="btn-macro" onClick={() => setShowMacroPanel(v => !v)}>
            상용구
          </button>
          <button className="btn-export" onClick={handleExportTxt}>
            내보내기
          </button>
          <button className="btn-clear" onClick={handleClearScreen}>
            초기화
          </button>
          <span className={`conn-dot ${connStatus}`} />
          <span className="conn-label">
            {connStatus === 'connected' ? '연결됨' : connStatus === 'connecting' ? '연결 중…' : '재연결 시도 중…'}
          </span>
        </div>
      </header>

      {/* workspace: 영상 + 스플리터 + 콘텐츠 */}
      {(() => {
        const isHorizontal = videoPos === 'top' || videoPos === 'bottom'
        const videoBefore = videoPos === 'top' || videoPos === 'left'
        const panelStyle = isHorizontal ? { height: `${videoSize}%` } : { width: `${videoSize}%` }
        const splitterCls = `splitter ${isHorizontal ? 'splitter-h' : 'splitter-v'}`

        const videoPanel = showVideo && (
          <div className="video-panel" style={panelStyle}>
            <div className="video-header">
              <div className="video-url-bar">
                <input
                  type="text"
                  className="video-url-input"
                  placeholder="YouTube URL 붙여넣기"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadVideo()}
                />
                <button className="btn-video-load" onClick={loadVideo}>로드</button>
              </div>
              <div className="video-pos-btns">
                <span className="pos-label">위치:</span>
                {(['top', 'bottom', 'left', 'right'] as const).map(pos => (
                  <button
                    key={pos}
                    className={`btn-pos ${videoPos === pos ? 'active' : ''}`}
                    onClick={() => setVideoPos(pos)}
                  >
                    {{ top: '상', bottom: '하', left: '좌', right: '우' }[pos]}
                  </button>
                ))}
              </div>
            </div>
            {videoId ? (
              <>
                <div className="video-container">
                  <div id="yt-player" />
                </div>
                <div className="video-controls">
                  <button className="btn-rate" onClick={() => changeRate(Math.max(0.1, Math.round((playbackRate - 0.1) * 10) / 10))} disabled={playbackRate <= 0.1}>-</button>
                  <span className="rate-display">{playbackRate.toFixed(1)}x</span>
                  <button className="btn-rate" onClick={() => changeRate(Math.round((playbackRate + 0.1) * 10) / 10)}>+</button>
                  <button className="btn-rate reset" onClick={() => changeRate(1)}>1x</button>
                </div>
              </>
            ) : (
              <div className="video-placeholder">YouTube URL을 입력하고 로드 버튼을 누르세요</div>
            )}
          </div>
        )

        const splitter = showVideo && (
          <div className={splitterCls} onMouseDown={startSplitterDrag} />
        )

        const contentArea = (
          <div className="content-area">
            <div className="main-layout">
              <main className="segment-list">
                {segments.length === 0 && connStatus === 'connected' && (
                  <p className="empty-hint">아래 입력창에 텍스트를 입력하고 Enter로 확정하세요.<br />세그먼트를 클릭하면 수정할 수 있습니다.</p>
                )}
                {connStatus !== 'connected' && (
                  <p className="empty-hint connecting-hint">
                    {connStatus === 'connecting' ? '연결 중입니다…' : '연결이 끊겼습니다. 재연결 시도 중…'}
                  </p>
                )}
                {meetingStatus === 'recess' && connStatus === 'connected' && (
                  <p className="empty-hint recess-hint">정회 중 — 회의시작을 누르면 재개됩니다.</p>
                )}
                {meetingStatus === 'ended' && (
                  <p className="empty-hint ended-hint">회의가 종료되었습니다.</p>
                )}

                {(displayOrder.length > 0
                  ? displayOrder.map(idx => segments.find(s => s.index === idx)).filter(Boolean) as Segment[]
                  : segments
                ).map(seg => (
                  <div
                    key={seg.index}
                    className={`segment ${seg.user === '속기사1' ? 'seg-p1' : 'seg-p2'} ${seg.status === 'typing' ? 'typing' : ''} ${editingIndex === seg.index ? 'editing' : ''} ${dragOverIdx === seg.index ? 'drag-over' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(seg.index)}
                    onDragOver={e => handleDragOver(e, seg.index)}
                    onDrop={e => handleDrop(e, seg.index)}
                    onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null) }}
                    onClick={() => editingIndex !== seg.index && handleSegmentClick(seg)}
                  >
                    <span className="drag-handle" title="드래그하여 순서 변경">⠿</span>
                    <span className="seg-meta">
                      <span className="seg-index">#{seg.index < 0 ? '…' : seg.index}</span>
                      <span className={`seg-user ${seg.user === '속기사1' ? 'p1' : 'p2'}`}>
                        {displayName(seg.user)}
                      </span>
                    </span>

                    {editingIndex === seg.index ? (
                      <textarea
                        className="seg-edit-input"
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onKeyDown={e => handleInlineKeyDown(e, seg.index)}
                        onBlur={() => commitInlineEdit(seg.index, editingText)}
                        autoFocus
                        rows={2}
                      />
                    ) : (
                      <span className="seg-content">
                        {seg.content}
                        {seg.status === 'typing' && seg.index !== mySegIndex && <span className="cursor-blink">|</span>}
                      </span>
                    )}
                  </div>
                ))}
                <div ref={listEndRef} />
              </main>

              {showMacroPanel && (
                <MacroPanel
                  macros={macros}
                  macroConfig={macroConfig}
                  onAdd={m => setMacros(prev => [...prev, m])}
                  onDelete={(label, expand) => setMacros(prev => {
                    const idx = prev.findIndex(m => m.label === label && m.expand === expand)
                    return idx === -1 ? prev : [...prev.slice(0, idx), ...prev.slice(idx + 1)]
                  })}
                  onConfigChange={setMacroConfig}
                  onClose={() => setShowMacroPanel(false)}
                />
              )}
            </div>
          </div>
        )

        return (
          <div className={`workspace ws-${videoPos}`}>
            {videoBefore ? <>{videoPanel}{splitter}{contentArea}</> : <>{contentArea}{splitter}{videoPanel}</>}
          </div>
        )
      })()}

      {reconnectMsg && <div className="reconnect-toast">{reconnectMsg}</div>}

      <footer className="input-area">
        <div className="input-header">
          <span className={`role-badge-sm ${isP1 ? 'p1' : 'p2'}`}>{role ? displayName(role) : ''} 입력</span>
          {mySegIndex !== null && (
            <span className="seg-indicator">세그먼트 #{mySegIndex} 작성 중</span>
          )}
          <div className="key-hints">
            <span className="key-hint">상용구 <kbd>{macroConfig.triggerKey}</kbd></span>
            <span className="key-hint">단어삭제 <kbd>{macroConfig.jasoDeleteKey}</kbd></span>
            <span className="key-hint">간단등록 <kbd>{macroConfig.quickAddKey}</kbd></span>
            {quickAddMsg && <span className="quick-add-msg">{quickAddMsg}</span>}
          </div>
        </div>
        <div className="input-row">
          <textarea
            ref={inputRef}
            className="main-input"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="입력 후 Enter → 확정 / Shift+Enter → 줄바꿈 / 세그먼트 클릭 → 수정"
            rows={3}
            autoFocus
            disabled={connStatus !== 'connected' || meetingStatus === 'recess'}
          />
          <button
            className="btn-send"
            onClick={handleSend}
            disabled={connStatus !== 'connected' || meetingStatus === 'recess'}
          >
            전송
          </button>
        </div>
      </footer>
    </div>
  )
}
