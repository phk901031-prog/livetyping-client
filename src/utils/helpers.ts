/**
 * helpers.ts — 순수 도구 함수 모음
 *
 * "순수 함수"란 입력값만 받아서 결과만 돌려주는 함수.
 * React state나 서버 연결 같은 외부 상태를 건드리지 않는다.
 */

/**
 * 키보드 이벤트를 "Ctrl+Shift+F3" 같은 문자열로 변환한다.
 *
 * 예: Ctrl 누른 상태에서 A → "Ctrl+A"
 *     그냥 F3 → "F3"
 *
 * 한글 IME가 활성화되면 key가 'Process'로 올 수 있어서
 * 그때는 code 속성에서 실제 키 이름을 가져온다.
 */
export function buildKeyString(e: KeyboardEvent | React.KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')    // Ctrl 키가 눌려 있으면 추가
  if (e.altKey) parts.push('Alt')      // Alt 키가 눌려 있으면 추가
  if (e.shiftKey) parts.push('Shift')  // Shift 키가 눌려 있으면 추가

  let k = e.key
  // 한글 IME 활성화 시 key가 'Process'로 오는 경우 대체
  if (k === 'Process' || k === 'Unidentified') {
    k = (e as any).code ?? ''
    if (k.startsWith('Key')) k = k.slice(3) // 'KeyA' → 'A'
  }
  if (!k) return ''

  // 한 글자면 대문자로 통일 (a → A), 그 외는 그대로 (F3, Enter 등)
  parts.push(k.length === 1 ? k.toUpperCase() : k)
  return parts.join('+')
}

/**
 * 커서 앞의 "한 단어"를 삭제한다 (띄어쓰기 기준).
 *
 * 동작 방식:
 * - 커서 바로 앞이 공백이면 → 공백만 제거
 * - 커서 바로 앞이 글자이면 → 그 단어만 제거 (앞의 공백은 보존)
 *
 * 예: "안녕하세요 반갑습니다|" → "안녕하세요 |"
 *     "안녕하세요 |"          → "안녕하세요|"
 */
export function deleteWord(
  text: string,
  cursor: number
): { newText: string; newCursor: number } {
  if (cursor === 0) return { newText: text, newCursor: 0 }
  const before = text.slice(0, cursor) // 커서 앞쪽 텍스트

  // 커서 바로 앞이 공백이면 공백만 제거
  if (before.endsWith(' ')) {
    const trimmed = before.trimEnd()
    return { newText: trimmed + text.slice(cursor), newCursor: trimmed.length }
  }

  // 마지막 공백 위치를 찾아서 그 뒤의 단어만 삭제
  const spaceIdx = before.lastIndexOf(' ')
  if (spaceIdx === -1) return { newText: text.slice(cursor), newCursor: 0 }

  // 공백 뒤의 단어만 삭제 (공백 자체는 보존)
  return {
    newText: text.slice(0, spaceIdx + 1) + text.slice(cursor),
    newCursor: spaceIdx + 1,
  }
}

/**
 * YouTube URL에서 영상 ID(11자리)를 추출한다.
 *
 * 지원하는 형식:
 * - https://www.youtube.com/watch?v=ABC12345678
 * - https://youtu.be/ABC12345678
 * - https://www.youtube.com/live/ABC12345678
 * - https://www.youtube.com/embed/ABC12345678
 *
 * 매칭 실패 시 null 반환
 */
export function extractVideoId(url: string): string | null {
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
}
