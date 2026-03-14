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

// 미디어 상태: 현재 방에서 어떤 미디어가 재생 중인지 나타내는 정보
// 서버가 이걸 기억하고 있어서, 늦게 들어온 사람도 YouTube 영상을 볼 수 있음
export interface MediaState {
  type: 'youtube' | 'localfile' | null  // 어떤 종류의 미디어인지
  youtubeId: string | null              // YouTube 영상 ID (11자리)
  fileName: string | null               // 로컬 파일 이름
  fileMime: string | null               // 파일 종류 (예: 'video/mp4', 'audio/mp3')
  fileSize: number | null               // 파일 크기 (바이트)
}

export interface RoomState {
  segments: Segment[]
  nextIndex: number
  displayOrder: number[]
  role?: UserRole
  nicknames?: Nicknames   // 각 역할의 표시 이름
  mediaState?: MediaState // 현재 재생 중인 미디어 정보
}
