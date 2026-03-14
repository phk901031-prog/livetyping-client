/**
 * SegmentList.tsx — 세그먼트(문장) 목록을 보여주는 컴포넌트
 *
 * 역할:
 * - 세그먼트를 화면 순서대로 표시
 * - 각 세그먼트에 작성자 이름, 내용, 상태(타이핑 중/완료) 표시
 * - 세그먼트 클릭 → 인라인 수정
 * - 드래그 앤 드롭으로 순서 변경
 * - 비어있을 때 / 연결 끊김 / 정회 중 / 종료 시 안내 메시지
 */
import { useRef } from 'react'
import type { Segment, UserRole } from '../types'
import type { ConnStatus, MeetingStatus } from '../App'

interface SegmentListProps {
  segments: Segment[]
  displayOrder: number[]
  mySegIndex: number | null
  connStatus: ConnStatus
  meetingStatus: MeetingStatus
  displayName: (role: UserRole | string) => string

  // 인라인 수정
  editingIndex: number | null
  editingText: string
  onEditingTextChange: (text: string) => void
  onSegmentClick: (seg: Segment) => void
  onInlineKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => void
  onInlineBlur: (index: number, text: string) => void

  // 드래그 앤 드롭
  dragOverIdx: number | null
  onDragStart: (segIndex: number) => void
  onDragOver: (e: React.DragEvent, segIndex: number) => void
  onDrop: (e: React.DragEvent, segIndex: number) => void
  onDragEnd: () => void
}

export default function SegmentList({
  segments,
  displayOrder,
  mySegIndex,
  connStatus,
  meetingStatus,
  displayName,
  editingIndex,
  editingText,
  onEditingTextChange,
  onSegmentClick,
  onInlineKeyDown,
  onInlineBlur,
  dragOverIdx,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SegmentListProps) {
  // 목록 끝으로 자동 스크롤하기 위한 ref
  const listEndRef = useRef<HTMLDivElement>(null)

  // displayOrder가 있으면 그 순서대로, 없으면 기본 순서
  const orderedSegments =
    displayOrder.length > 0
      ? (displayOrder
          .map(idx => segments.find(s => s.index === idx))
          .filter(Boolean) as Segment[])
      : segments

  return (
    <main className="segment-list">
      {/* 안내 메시지들 */}
      {segments.length === 0 && connStatus === 'connected' && (
        <p className="empty-hint">
          아래 입력창에 텍스트를 입력하고 Enter로 확정하세요.
          <br />
          세그먼트를 클릭하면 수정할 수 있습니다.
        </p>
      )}
      {connStatus !== 'connected' && (
        <p className="empty-hint connecting-hint">
          {connStatus === 'connecting'
            ? '연결 중입니다…'
            : '연결이 끊겼습니다. 재연결 시도 중…'}
        </p>
      )}
      {meetingStatus === 'recess' && connStatus === 'connected' && (
        <p className="empty-hint recess-hint">정회 중 — 회의시작을 누르면 재개됩니다.</p>
      )}
      {meetingStatus === 'ended' && (
        <p className="empty-hint ended-hint">회의가 종료되었습니다.</p>
      )}

      {/* 세그먼트 목록 */}
      {orderedSegments.map(seg => (
        <div
          key={seg.index}
          className={`segment ${seg.user === '속기사1' ? 'seg-p1' : 'seg-p2'} ${
            seg.status === 'typing' ? 'typing' : ''
          } ${editingIndex === seg.index ? 'editing' : ''} ${
            dragOverIdx === seg.index ? 'drag-over' : ''
          }`}
          draggable
          onDragStart={() => onDragStart(seg.index)}
          onDragOver={e => onDragOver(e, seg.index)}
          onDrop={e => onDrop(e, seg.index)}
          onDragEnd={onDragEnd}
          onClick={() => editingIndex !== seg.index && onSegmentClick(seg)}
        >
          {/* 드래그 손잡이 */}
          <span className="drag-handle" title="드래그하여 순서 변경">
            ⠿
          </span>

          {/* 세그먼트 번호 + 작성자 이름 */}
          <span className="seg-meta">
            <span className="seg-index">#{seg.index < 0 ? '…' : seg.index}</span>
            <span className={`seg-user ${seg.user === '속기사1' ? 'p1' : 'p2'}`}>
              {displayName(seg.user)}
            </span>
          </span>

          {/* 내용: 수정 중이면 textarea, 아니면 텍스트 */}
          {editingIndex === seg.index ? (
            <textarea
              className="seg-edit-input"
              value={editingText}
              onChange={e => onEditingTextChange(e.target.value)}
              onKeyDown={e => onInlineKeyDown(e, seg.index)}
              onBlur={() => onInlineBlur(seg.index, editingText)}
              autoFocus
              rows={2}
            />
          ) : (
            <span className="seg-content">
              {seg.content}
              {/* 다른 사람이 타이핑 중이면 깜빡이는 커서 표시 */}
              {seg.status === 'typing' && seg.index !== mySegIndex && (
                <span className="cursor-blink">|</span>
              )}
            </span>
          )}
        </div>
      ))}

      {/* 자동 스크롤 앵커 */}
      <div ref={listEndRef} />
    </main>
  )
}
