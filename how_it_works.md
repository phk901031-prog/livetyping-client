# LiveTyping Online — 어떻게 작동하는지 (학습용 기록지)

이 문서는 프로그래밍을 처음 배우는 사람이 이 프로젝트의 코드를 이해할 수 있도록,
**고등학생 수준**에서 핵심 개념과 동작 원리를 설명합니다.

---

## 1. 전체 구조: 식당에 비유하기

LiveTyping은 **식당**에 비유할 수 있어요.

| 실제 | 우리 앱 |
|------|---------|
| 손님 (2명) | 속기사1, 속기사2 (브라우저) |
| 주방 (서버) | Socket.io 서버 (`server/src/index.ts`) |
| 테이블 (방) | Room 객체 (6자리 코드) |
| 주문서 | 세그먼트 (입력한 문장 하나하나) |
| 웨이터 | Socket.io (데이터를 실시간으로 전달) |

**흐름:**
1. 손님 A가 테이블(방)을 잡음 → 6자리 번호를 받음
2. 손님 B가 그 번호로 같은 테이블에 앉음
3. 손님 A가 주문서(문장)를 쓰면, 웨이터(Socket.io)가 주방(서버)에 전달
4. 주방이 손님 B에게도 같은 주문서를 보여줌
5. 실시간으로 서로의 주문서(문장)가 화면에 보임!

---

## 2. React란 무엇인가?

React는 **화면을 만드는 도구**예요.

### 기본 개념: 레고 블록

```
App (전체 앱)
├── Header (상단 바) ← 레고 블록 1
├── SegmentList (문장 목록) ← 레고 블록 2
├── VideoPanel (영상 패널) ← 레고 블록 3
└── InputArea (입력창) ← 레고 블록 4
```

각 `.tsx` 파일이 레고 블록 하나예요. 이걸 **컴포넌트(Component)**라고 부릅니다.
App.tsx가 이 블록들을 조립해서 완성된 화면을 만들어요.

### State (상태) = 화면이 기억하는 값

```typescript
const [inputText, setInputText] = useState('')
//     ^^^^^^^^   ^^^^^^^^^^^
//     현재 값     값을 바꾸는 함수
```

- `inputText`: 지금 입력창에 뭐가 써있는지
- `setInputText('안녕')`: 입력창 내용을 '안녕'으로 바꿈 → **화면이 자동으로 다시 그려짐!**

React의 핵심: **state가 바뀌면 화면이 자동으로 업데이트된다.**
직접 DOM을 건드릴 필요 없이, 값만 바꾸면 됨.

### Props = 부모가 자식에게 전달하는 값

```typescript
// App.tsx (부모)
<Header displayName="김철수" roomCode="123456" />

// Header.tsx (자식)
function Header({ displayName, roomCode }) {
  return <span>{displayName}</span>  // "김철수" 표시
}
```

부모(App)가 자식(Header)에게 "이름은 김철수야, 방 코드는 123456이야" 하고 알려주는 것.

### Hook = 재사용 가능한 기능 묶음

```typescript
const { theme, toggleTheme } = useTheme()
```

`useTheme()`은 테마 관련 기능을 묶어놓은 것.
마치 "테마 리모컨"을 꺼내서 쓰는 느낌이에요.
- `theme`: 지금 다크인지 라이트인지
- `toggleTheme()`: 테마를 바꾸는 버튼

---

## 3. Socket.io란 무엇인가?

일반적인 웹사이트는 **편지**처럼 통신해요:
- 브라우저: "이 페이지 주세요" (요청)
- 서버: "여기요" (응답)
- 끝. 연결 끊김.

Socket.io는 **전화 통화**처럼 통신해요:
- 브라우저: "여보세요?" (연결)
- 서버: "네 듣고 있어요"
- 브라우저: "새 문장이요!" → 서버: "알겠어요, 상대방에게 전달할게요"
- 서버: "상대방이 문장 썼어요!" → 브라우저: "화면에 표시할게요"
- **계속 연결이 유지됨!** ← 이게 핵심

### 주요 이벤트 (전화 통화 내용)

```
[방 만들기]
브라우저 → 서버: "room:create" + 이름
서버 → 브라우저: "OK, 방 코드는 123456"

[방 참여]
브라우저 → 서버: "room:join" + 코드 + 이름
서버 → 브라우저: "OK, 너는 속기사2야"

[문장 입력]
브라우저 → 서버: "segment:new" + 문장 내용
서버 → 모든 브라우저: "state:sync" + 전체 상태

[영상 공유]
속기사1 → 서버: "media:youtube" + 영상 ID
서버 → 속기사2: "media:youtube" + 영상 ID
속기사2 화면에 자동으로 영상 표시!
```

---

## 4. 데이터가 흘러가는 과정 (문장 입력 ~ 화면 표시)

속기사1이 "안녕하세요"를 치는 상황을 따라가 봅시다:

### 단계 1: 키보드 입력
```
사용자가 키보드를 누름
→ <textarea>의 onChange 이벤트 발생
→ handleInputChange() 함수 호출 (App.tsx:366)
```

### 단계 2: 새 세그먼트 생성 (처음 타이핑할 때)
```
handleInputChange()에서:
  "아직 내 세그먼트가 없네?" (mySegIndex === null)
  → createNewSegment() 호출 (App.tsx:334)
```

### 단계 3: 서버에 알림 + 화면에 바로 표시 (Optimistic Update)
```
createNewSegment()에서:
  1. 임시 번호로 화면에 먼저 표시 (tempIndex = -현재시간)
     → setSegments([...이전문장들, 새문장])
     → 화면에 바로 보임! (서버 응답을 안 기다림 = Optimistic Update)

  2. 서버에 "새 문장이요!" 전송
     → socket.emit('segment:new', { user: '속기사1', content: '안' })

  3. 서버가 진짜 번호를 줌 (예: 0)
     → 임시 번호를 진짜 번호로 교체
```

### 단계 4: 서버가 상대방에게 전달
```
서버(index.ts:148):
  segment:new 이벤트를 받음
  → room.segments에 저장
  → broadcastState() 호출
  → 방의 모든 사람에게 "state:sync" 이벤트 전송
```

### 단계 5: 상대방 화면에 표시
```
속기사2의 브라우저:
  "state:sync" 이벤트 수신 (App.tsx:142)
  → setSegments(서버에서 받은 세그먼트 목록)
  → 화면이 자동으로 업데이트됨!
```

### 단계 6: 타이핑 계속
```
사용자가 계속 타이핑 ("안" → "안녕" → "안녕하세요")
→ handleInputChange()에서:
  "내 세그먼트가 이미 있네!" (mySegIndex !== null)
  → 화면 업데이트 + 서버에 변경 내용 전송
  → socket.emit('segment:update', { index: 0, content: '안녕하세요', status: 'typing' })
```

### 단계 7: Enter로 확정
```
Enter 키 누름 → handleKeyDown() (App.tsx:398)
  → status를 'completed'로 변경
  → 서버에 전송
  → 입력창 비우기
  → 다음 입력을 위해 준비 완료!
```

---

## 5. 한글 IME 문제와 해결법

### 문제: 왜 한글 입력이 특별한가?

영어는 간단해요: `a` 키를 누르면 바로 `a`가 입력됨.

한글은 복잡해요:
```
ㅎ → 하 → 한 (한 글자를 만들기 위해 여러 키를 조합)
```

이 조합 과정을 **IME(입력기) 조합**이라고 하는데,
조합이 끝날 때 `compositionend`라는 이벤트가 발생해요.
문제는 이 이벤트가 `onChange`를 **한 번 더** 발생시켜서,
글자가 이중으로 입력되거나 삭제가 안 되는 버그가 생김.

### 해결: skipInputRef (3단계 스위치)

```typescript
const skipInputRef = useRef<false | 'clear' | 'keep'>(false)
```

| 값 | 의미 | 사용 시점 |
|-----|------|-----------|
| `false` | 정상 동작 | 보통 때 |
| `'clear'` | 입력창을 비워라 | 간단등록(F5) 후 |
| `'keep'` | onChange를 무시해라 | 상용구 삽입, 단어삭제 후 |

**작동 방식:**
```
1. 상용구 트리거(F3) 누름
2. skipInputRef = 'keep' 으로 설정
3. IME의 compositionend가 onChange를 발생시킴
4. onChange에서: "skipInputRef가 'keep'이네? 무시하자!"
5. skipInputRef = false로 리셋
6. 다음 onChange부터는 정상 동작
```

---

## 6. Ref vs State — 무엇이 다른가?

### State: 변경되면 화면이 다시 그려짐
```typescript
const [inputText, setInputText] = useState('')
// inputText가 바뀌면 → 화면 전체가 다시 렌더링됨
```

### Ref: 변경되어도 화면에 영향 없음 (메모장 같은 것)
```typescript
const mySegIndexRef = useRef<number | null>(null)
// mySegIndexRef.current를 바꿔도 화면은 안 바뀜
// 하지만 다른 함수에서 "지금 값이 뭐지?" 하고 읽을 수 있음
```

### 왜 둘 다 필요한가?

**State가 필요한 경우**: 화면에 보여줘야 할 때
- `inputText` → 입력창에 표시
- `segments` → 문장 목록에 표시

**Ref가 필요한 경우**: 화면과 무관하게 "최신 값"을 기억해야 할 때
- `mySegIndexRef` → 소켓 이벤트 리스너 안에서 "내 세그먼트 번호가 뭐지?" 할 때
- `skipInputRef` → onChange에서 "지금 무시해야 하나?" 판단할 때

### Stale Closure 문제 (소켓에서 ref가 필수인 이유)

```typescript
// 소켓 이벤트는 처음 한 번만 등록됨 (useEffect([], []) → [] = 처음만 실행)
useEffect(() => {
  socket.on('media:youtube', ({ videoId }) => {
    // 여기서 receiveYouTube(videoId)를 부르면...
    // 이 함수는 "처음 등록할 때의 receiveYouTube"를 기억함
    // 나중에 receiveYouTube가 바뀌어도 옛날 버전을 씀! (= Stale Closure)

    // 해결: ref를 통해 항상 "최신 버전"을 부름
    receiveYouTubeRef.current(videoId)  // ← 항상 최신!
  })
}, []) // [] = 처음 한 번만 실행

// 매 렌더링마다 ref를 업데이트
receiveYouTubeRef.current = receiveYouTube  // 항상 최신 함수를 넣어둠
```

비유: 전화번호부에 "김철수: 010-xxxx"라고 적어놨는데, 김철수가 번호를 바꿈.
- State 방식: 옛날 전화번호부를 계속 봄 (연락 안 됨)
- Ref 방식: 항상 최신 전화번호부를 봄 (연락 됨!)

---

## 7. Optimistic Update — 왜 서버 응답을 안 기다릴까?

### 기다리는 방식 (느림)
```
타이핑 → 서버에 전송 → 기다림... → 서버 응답 → 화면 표시
         ^^^^^^^^^^^^^^^^^^^^^^^^^^^
         이 사이에 화면이 멈춰 보임!
```

### Optimistic Update (빠름)
```
타이핑 → 화면에 바로 표시 + 동시에 서버에 전송
         ^^^^^^^^^^^^^^^^
         사용자는 지연을 느끼지 못함!
```

만약 서버가 다른 결과를 보내면? `state:sync`에서 서버의 데이터로 교체됨.
하지만 **내가 타이핑 중인 세그먼트**는 서버 데이터로 덮어쓰지 않음:

```typescript
// App.tsx:142 — state:sync 처리
if (myIdx !== null) {
  const myLocalSeg = prev.find(seg => seg.index === myIdx)
  if (myLocalSeg) {
    // 내 세그먼트는 로컬 데이터 유지, 나머지만 서버 데이터 사용
    return state.segments.map(seg =>
      seg.index === myIdx ? myLocalSeg : seg
    )
  }
}
```

---

## 8. 미디어 동기화 — 영상/파일이 공유되는 과정

### YouTube 동기화
```
속기사1: YouTube URL 입력 → "로드" 클릭
  → extractVideoId()로 영상 ID 추출 (예: "dQw4w9WgXcQ")
  → 내 화면에 YouTube 재생 시작
  → 서버에 전송: socket.emit('media:youtube', { videoId: "dQw4w9WgXcQ" })

서버: videoId를 Room에 저장 + 속기사2에게 전달

속기사2: 'media:youtube' 이벤트 수신
  → receiveYouTube("dQw4w9WgXcQ") 호출
  → 내 화면에도 같은 YouTube 재생!
```

### 로컬 파일 동기화
```
속기사1: "파일" 버튼 → MP3 파일 선택
  → loadLocalFile(file): Blob URL 생성 → 내 화면에서 재생
  → FileReader로 파일을 바이너리 데이터(ArrayBuffer)로 읽음
  → 서버에 전송: socket.emit('media:localfile', { fileName, mime, data: 바이너리 })

서버: 파일 데이터를 속기사2에게 중계 (저장은 안 함! 택배회사 역할)

속기사2: 'media:localfile' 이벤트 수신
  → receiveLocalFile(fileName, mime, data)
  → ArrayBuffer → Blob → Blob URL 생성 → 내 화면에서 재생!
```

**Blob URL이란?**
파일을 브라우저 메모리에 올려놓고, 임시 주소를 만드는 것.
```
blob:http://localhost:5173/abc123-def456
```
이 주소를 `<video src="...">` 또는 `<audio src="...">`에 넣으면 재생 가능!

---

## 9. useCallback과 useEffect — 언제 쓰는가?

### useEffect: "이 값이 바뀌면 이걸 해라"
```typescript
useEffect(() => {
  // theme이 바뀔 때마다 실행됨
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('lt_theme', theme)
}, [theme])  // ← 이 값이 바뀔 때만 실행
//  ^^^^^
//  의존성 배열 (dependency array)
```

- `[theme]` → theme이 바뀔 때만 실행
- `[]` → 컴포넌트가 처음 만들어질 때 한 번만 실행
- `[a, b]` → a 또는 b가 바뀔 때마다 실행

### useCallback: "이 함수를 기억해둬라"
```typescript
const handleSend = useCallback(() => {
  // 전송 로직
}, [inputText])
```

React는 컴포넌트가 다시 그려질 때마다 함수도 새로 만듦.
`useCallback`은 "의존성이 안 바뀌면 이전 함수를 재사용해!"라고 알려주는 것.
성능 최적화에 도움이 됨.

---

## 10. CSS 변수와 테마 시스템

### CSS 변수란?
```css
:root {
  --bg: #1a1a2e;       /* 배경색 */
  --fg: #ffffff;       /* 글자색 */
}

[data-theme="light"] {
  --bg: #f5f5f5;       /* 라이트 모드 배경 */
  --fg: #333333;       /* 라이트 모드 글자 */
}
```

HTML 태그에 `data-theme="light"`가 붙으면,
CSS 변수가 자동으로 라이트 모드 값으로 바뀜.
모든 요소가 `var(--bg)`, `var(--fg)`를 쓰기 때문에, 변수만 바꾸면 전체 테마가 변경!

---

## 11. localStorage — 새로고침해도 데이터가 남는 이유

```typescript
// 저장
localStorage.setItem('lt_theme', 'dark')

// 불러오기
const theme = localStorage.getItem('lt_theme')  // → 'dark'
```

`localStorage`는 브라우저에 내장된 작은 저장소예요.
쿠키보다 크고 (5MB), 직접 지우기 전까지 영구 보존됨.
우리 앱에서 저장하는 것들:
- `lt_theme`: 다크/라이트 테마
- `lt_fontsize`: 글자 크기
- `lt_macros`: 상용구 목록 (JSON)
- `lt_macro_config`: 키 설정 (JSON)
- `lt_video_pos`: 영상 패널 위치
- `lt_video_size`: 영상 패널 크기

---

## 12. TypeScript 타입 — 왜 귀찮게 타입을 쓰는가?

```typescript
// JavaScript (타입 없음)
function add(a, b) { return a + b }
add(1, '2')  // → '12' ← 의도한 게 아닌데 에러 안 남!

// TypeScript (타입 있음)
function add(a: number, b: number): number { return a + b }
add(1, '2')  // → 빨간 줄! "string은 number에 넣을 수 없어요"
```

TypeScript는 코드를 실행하기 **전에** 실수를 잡아줘요.
특히 여러 파일이 데이터를 주고받을 때, 타입이 안 맞으면 바로 알려줌.

```typescript
// types.ts에서 정의
interface Segment {
  index: number
  user: UserRole
  content: string
  status: 'typing' | 'completed'
}

// 다른 파일에서 사용
const seg: Segment = {
  index: 0,
  user: '속기사1',
  content: '안녕하세요',
  status: 'typing',
  // color: 'red'  ← 이거 넣으면 에러! Segment에 color는 없으니까
}
```

---

## 13. 파일별 핵심 코드 위치 가이드

"이 기능의 코드가 어디 있지?" 할 때 참고하세요:

| 기능 | 파일 | 위치 |
|------|------|------|
| 방 생성/참여 | App.tsx | `handleCreateRoom`, `handleJoinRoom` |
| 문장 입력 처리 | App.tsx | `handleInputChange`, `handleKeyDown` |
| 새 세그먼트 생성 | App.tsx | `createNewSegment` |
| 상용구 치환 | App.tsx | `insertMacroText` |
| 한글 IME 대응 | App.tsx | `skipInputRef` 관련 코드 |
| 소켓 이벤트 등록 | App.tsx | `useEffect` 안의 `s.on(...)` |
| 방향키 세그먼트 이동 | App.tsx | `handleKeyDown`의 ArrowUp + `handleInlineKeyDown` |
| 테마/폰트 | hooks/useTheme.ts | 전체 |
| 상용구 목록 관리 | hooks/useMacros.ts | 전체 |
| YouTube 재생 | hooks/useMedia.ts | `loadVideo`, YouTube Player 생성 useEffect |
| 로컬 파일 재생 | hooks/useMedia.ts | `loadLocalFile`, `receiveLocalFile` |
| 배속 조절 | hooks/useMedia.ts | `changeRate` |
| 스플리터 드래그 | hooks/useMedia.ts | `startSplitterDrag`, mousemove useEffect |
| YouTube URL 파싱 | utils/helpers.ts | `extractVideoId` |
| 단어 삭제 | utils/helpers.ts | `deleteWord` |
| 서버 방 관리 | server/src/index.ts | `rooms` Map, `room:create`, `room:join` |
| 서버 미디어 중계 | server/src/index.ts | `media:youtube`, `media:localfile` |

---

## 14. 바이브코딩을 위한 팁

### 새 기능을 추가하고 싶을 때
1. **어디에 영향을 주는지** 먼저 파악
   - 화면에 보이는 것 → `components/` 수정
   - 데이터/로직 → `hooks/` 또는 `App.tsx` 수정
   - 서버 통신 → `App.tsx`의 소켓 부분 + `server/src/index.ts` 수정

2. **작은 단위로** 수정하고 테스트
   - 한 번에 많이 바꾸면 어디서 망가졌는지 찾기 어려움
   - 한 줄 바꾸고 → 브라우저에서 확인 → 다음 줄 바꾸기

3. **console.log로** 디버깅
   ```typescript
   console.log('여기 도착!', { mySegIndex, inputText })
   ```
   브라우저 F12 → Console 탭에서 확인

### 자주 하는 실수
- `useState`의 값을 바꿀 때 `=` 대신 `set함수` 사용해야 함
  - `inputText = '안녕'` ← 안 됨!
  - `setInputText('안녕')` ← 이렇게!
- `useEffect`의 의존성 배열을 빠뜨리면 무한 루프 위험
- 소켓 이벤트 리스너 안에서 state를 읽으면 옛날 값이 나옴 → ref 사용
