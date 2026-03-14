/**
 * App.tsx — 총괄 조립 파일
 *
 * 이 파일은 각 부품(컴포넌트, 훅)을 가져와서 조립만 한다.
 * 실제 로직은 hooks/ 폴더, 화면은 components/ 폴더에 분리되어 있다.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// ── 타입 ────────────────────────────────────────────────────────
import type { UserRole, Segment, Macro, RoomState, Nicknames } from './types'

// ── 유틸리티 (순수 도구 함수) ────────────────────────────────────
import { buildKeyString, deleteWord } from './utils/helpers'

// ── 훅 (각 담당 부서) ───────────────────────────────────────────
import { useTheme } from './hooks/useTheme'
import { useMacros } from './hooks/useMacros'
import { useYouTube } from './hooks/useYouTube'

// ── 컴포넌트 (화면 부품) ────────────────────────────────────────
import Lobby from './components/Lobby'
import Header from './components/Header'
import SegmentList from './components/SegmentList'
import VideoPanel from './components/VideoPanel'
import InputArea from './components/InputArea'
import MacroPanel from './components/MacroPanel'

// ── 서버 URL ────────────────────────────────────────────────────
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

// ── 공용 타입 (다른 컴포넌트에서도 import할 수 있도록 export) ─────
export type ConnStatus = 'disconnected' | 'connecting' | 'connected'
export type MeetingStatus = 'idle' | 'running' | 'recess' | 'ended'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App() {
  // ── 훅에서 가져온 기능들 ─────────────────────────────────────
  const { theme, toggleTheme, fontSize, increaseFontSize, decreaseFontSize } = useTheme()
  const {
    macros, setMacros, macroConfig, setMacroConfig,
    showMacroPanel, setShowMacroPanel,
    macrosRef, macroConfigRef, addMacro, deleteMacro,
  } = useMacros()
  const {
    showVideo, setShowVideo, videoUrl, setVideoUrl, videoId,
    videoPos, setVideoPos, videoSize, playbackRate,
    loadVideo, changeRate, startSplitterDrag,
  } = useYouTube()

  // ── 소켓 / 방 상태 ──────────────────────────────────────────
  const [socket, setSocket] = useState<Socket | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [connStatus, setConnStatus] = useState<ConnStatus>('disconnected')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [nickname, setNickname] = useState('')
  const [nicknames, setNicknames] = useState<Nicknames>({})

  // ── 세그먼트 상태 ───────────────────────────────────────────
  const [segments, setSegments] = useState<Segment[]>([])
  const [inputText, setInputText] = useState('')
  const [mySegIndex, setMySegIndex] = useState<number | null>(null)
  const [isCreatingSegment, setIsCreatingSegment] = useState(false)
  const [displayOrder, setDisplayOrder] = useState<number[]>([])

  // ── 메시지 ──────────────────────────────────────────────────
  const [quickAddMsg, setQuickAddMsg] = useState('')
  const [reconnectMsg, setReconnectMsg] = useState('')

  // ── 회의 상태 ───────────────────────────────────────────────
  const [meetingStatus, setMeetingStatus] = useState<MeetingStatus>('idle')

  // ── 드래그 앤 드롭 ──────────────────────────────────────────
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // ── 인라인 수정 ─────────────────────────────────────────────
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')

  // ── Ref (최신 값 참조용) ────────────────────────────────────
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const pendingContentRef = useRef<string | null>(null)
  const mySegIndexRef = useRef<number | null>(null)
  const isCreatingRef = useRef(false)
  const roleRef = useRef<UserRole | null>(null)
  const skipInputRef = useRef<false | 'clear' | 'keep'>(false)
  const socketRef = useRef<Socket | null>(null)

  // Ref를 항상 최신 state와 동기화
  mySegIndexRef.current = mySegIndex
  isCreatingRef.current = isCreatingSegment
  roleRef.current = role
  socketRef.current = socket

  // ── 닉네임 헬퍼 ────────────────────────────────────────────
  const displayName = useCallback(
    (r: UserRole | string) => nicknames[r] || r,
    [nicknames]
  )

  // ── 자동 스크롤 ────────────────────────────────────────────
  const listEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 소켓 연결 및 이벤트
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
      if (state.role) { setRole(state.role); roleRef.current = state.role }
      if (state.nicknames) setNicknames(state.nicknames)
    })

    s.on('member:joined', ({ role: r, nickname: n }: { role: UserRole; nickname?: string }) => {
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

  // Focus 관리
  const prevSegCountRef = useRef(0)
  useEffect(() => {
    if (segments.length > prevSegCountRef.current) {
      const active = document.activeElement
      const isEditingInline = active?.classList.contains('seg-edit-input')
      if (!isEditingInline && active !== inputRef.current) inputRef.current?.focus()
    }
    prevSegCountRef.current = segments.length
  }, [segments.length])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 방 생성 / 참여
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleCreateRoom = useCallback(() => {
    if (!socket) return
    setConnStatus('connecting')
    socket.connect()
    const tryCreate = () => {
      const myName = nickname.trim() || '속기사1'
      socket.emit('room:create', myName, (res: { ok: boolean; code?: string }) => {
        if (res.ok && res.code) {
          setRoomCode(res.code)
          setRole('속기사1')
          roleRef.current = '속기사1'
          setNicknames({ '속기사1': myName })
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
      socket.emit('room:join', joinCode.trim(), myName, (res: { ok: boolean; error?: string; role?: UserRole }) => {
        if (res.ok) {
          setRoomCode(joinCode.trim())
          setConnStatus('connected')
          if (res.role) { setRole(res.role); roleRef.current = res.role }
        } else {
          setJoinError(res.error || '참여 실패')
          setConnStatus('disconnected')
        }
      })
    }
    if (socket.connected) tryJoin()
    else socket.once('connect', tryJoin)
  }, [socket, joinCode, nickname])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 상용구 삽입
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const insertMacroText = useCallback((macro: Macro) => {
    const textarea = inputRef.current
    if (!textarea) return
    const text = textarea.value
    const cursorPos = textarea.selectionStart ?? text.length
    const selEnd = textarea.selectionEnd ?? text.length
    const beforeCursor = text.slice(0, cursorPos)
    const insertFrom = beforeCursor.endsWith(macro.label)
      ? cursorPos - macro.label.length
      : cursorPos
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 새 세그먼트 생성
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const createNewSegment = useCallback(async (user: UserRole, initialContent: string) => {
    if (!socketRef.current) return
    isCreatingRef.current = true
    setIsCreatingSegment(true)
    pendingContentRef.current = null
    const tempIndex = -(Date.now())
    setSegments(prev => [
      ...prev,
      { index: tempIndex, user, content: initialContent, status: 'typing' },
    ])
    const index = await new Promise<number>(resolve => {
      socketRef.current!.emit('segment:new', { user, content: initialContent }, (idx: number) => resolve(idx))
    })
    setSegments(prev =>
      prev.map(s => (s.index === tempIndex ? { ...s, index } : s)).sort((a, b) => a.index - b.index)
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 입력 onChange
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // keydown 핸들러
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    [insertMacroText, inputText, setMacros]
  )

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 전송 버튼
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 드래그 앤 드롭
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
  const handleDragEnd = useCallback(() => {
    setDraggingIdx(null)
    setDragOverIdx(null)
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 인라인 수정
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 회의 상태 변경
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const changeMeetingStatus = useCallback((next: 'running' | 'recess' | 'ended') => {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 초기화
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleClearScreen = useCallback(() => {
    if (!window.confirm('화면을 초기화합니다. 계속할까요?')) return
    setSegments([])
    setInputText('')
    setMySegIndex(null)
    mySegIndexRef.current = null
    inputRef.current?.focus()
  }, [])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 내보내기
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    a.download = `회의록_${dateStr}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [segments, displayOrder])

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 화면 렌더링
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // 방 입장 전 → 로비 화면
  if (!roomCode) {
    return (
      <Lobby
        nickname={nickname}
        onNicknameChange={setNickname}
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        joinError={joinError}
        connStatus={connStatus}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    )
  }

  // 방 입장 후 → 메인 화면
  const isP1 = role === '속기사1'
  const myDisplayName = role ? displayName(role) : ''
  const isHorizontal = videoPos === 'top' || videoPos === 'bottom'
  const videoBefore = videoPos === 'top' || videoPos === 'left'
  const panelStyle = isHorizontal
    ? { height: `${videoSize}%` }
    : { width: `${videoSize}%` }
  const splitterCls = `splitter ${isHorizontal ? 'splitter-h' : 'splitter-v'}`

  const videoPanel = showVideo && (
    <div className="video-panel" style={panelStyle}>
      <VideoPanel
        videoUrl={videoUrl}
        onVideoUrlChange={setVideoUrl}
        onLoadVideo={loadVideo}
        videoId={videoId}
        videoPos={videoPos}
        onVideoPosChange={setVideoPos}
        playbackRate={playbackRate}
        onChangeRate={changeRate}
      />
    </div>
  )

  const splitter = showVideo && (
    <div className={splitterCls} onMouseDown={startSplitterDrag} />
  )

  const contentArea = (
    <div className="content-area">
      <div className="main-layout">
        <SegmentList
          segments={segments}
          displayOrder={displayOrder}
          mySegIndex={mySegIndex}
          connStatus={connStatus}
          meetingStatus={meetingStatus}
          displayName={displayName}
          editingIndex={editingIndex}
          editingText={editingText}
          onEditingTextChange={setEditingText}
          onSegmentClick={handleSegmentClick}
          onInlineKeyDown={handleInlineKeyDown}
          onInlineBlur={commitInlineEdit}
          dragOverIdx={dragOverIdx}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
        />

        {showMacroPanel && (
          <MacroPanel
            macros={macros}
            macroConfig={macroConfig}
            onAdd={addMacro}
            onDelete={deleteMacro}
            onConfigChange={setMacroConfig}
            onClose={() => setShowMacroPanel(false)}
          />
        )}
      </div>
    </div>
  )

  return (
    <div className="app">
      <Header
        displayName={myDisplayName}
        isP1={isP1}
        roomCode={roomCode}
        meetingStatus={meetingStatus}
        onMeetingChange={changeMeetingStatus}
        theme={theme}
        onToggleTheme={toggleTheme}
        fontSize={fontSize}
        onFontIncrease={increaseFontSize}
        onFontDecrease={decreaseFontSize}
        showVideo={showVideo}
        onToggleVideo={() => setShowVideo(v => !v)}
        onToggleMacroPanel={() => setShowMacroPanel(v => !v)}
        onExport={handleExportTxt}
        onClear={handleClearScreen}
        connStatus={connStatus}
      />

      <div className={`workspace ws-${videoPos}`}>
        {videoBefore
          ? <>{videoPanel}{splitter}{contentArea}</>
          : <>{contentArea}{splitter}{videoPanel}</>}
      </div>

      {reconnectMsg && <div className="reconnect-toast">{reconnectMsg}</div>}

      <InputArea
        inputRef={inputRef}
        displayName={myDisplayName}
        isP1={isP1}
        mySegIndex={mySegIndex}
        macroConfig={macroConfig}
        quickAddMsg={quickAddMsg}
        inputText={inputText}
        onInputChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        connStatus={connStatus}
        meetingStatus={meetingStatus}
      />
    </div>
  )
}
