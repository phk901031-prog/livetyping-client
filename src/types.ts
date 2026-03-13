export type UserRole = '속기사1' | '속기사2'

export interface Segment {
  index: number
  user: UserRole
  content: string
  status: 'typing' | 'completed'
}

export interface Macro {
  label: string
  expand: string
}

// 역할(role) → 표시이름(nickname) 매핑
// 예: { '속기사1': '김철수', '속기사2': '박영희' }
export type Nicknames = Record<string, string>

export interface RoomState {
  segments: Segment[]
  nextIndex: number
  displayOrder: number[]
  role?: UserRole
  nicknames?: Nicknames   // 각 역할의 표시 이름
}
