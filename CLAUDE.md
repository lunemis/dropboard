# dropboard - Project Context

## Overview
dropboard(구명 docket)는 AI 에이전트가 만든 산출물(설계서, 분석, 리포트, 재미 콘텐츠)을
self-contained HTML/Markdown 페이지로 게시하고, 사용자가 모바일 웹에서 리뷰·아카이브·삭제하는
**셀프호스팅 AI 산출물 리뷰 보드**다.

핵심 흐름: 대화 중 "board에 올려줘" → 에이전트가 페이지 제작 후 `dropboard publish` → 사용자가 보드 웹에서 리뷰.

## Tech Stack
- Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, 모바일 퍼스트(390px)
- 저장: 파일시스템 `data/items/{id}/` (meta.json + index.html|md) — DB 없음
- 유일한 런타임 의존성: `marked`

## Key Conventions
- 항목 상태: `inbox | archived | trash` — 파일 이동 없이 meta.json의 status만 변경
- 휴지통 정리: 서버 내장 스위퍼(`src/instrumentation.ts`, 6시간마다, `DROPBOARD_TRASH_TTL_DAYS`) — 외부 스케줄러 불필요
- 뷰어는 `<iframe sandbox="allow-scripts">`로 산출물 격리 (`allow-same-origin` 금지). raw 접근은 서명 URL/Bearer/세션 3중 허용
- 쓰기 API는 `DROPBOARD_TOKEN` Bearer, UI는 PIN(6자리, 5회 실패 15분 잠금) + 180일 세션 쿠키
- 산출물은 self-contained HTML (외부 CDN 의존 금지, 인라인 CSS/JS, 5MB 제한)
- UI 문자열은 `src/lib/i18n.ts` 경유 (기본 en, `NEXT_PUBLIC_DROPBOARD_LOCALE=ko`) — 하드코딩 금지
- 코드 주석·CLI 출력 영어. 특정 머신 전용 값(포트·경로·도메인)은 코드에 넣지 않는다 — env/배포 설정으로
- 에이전트 통합 템플릿은 `integrations/` (claude-code / codex / generic)

## Routes
```
/          — Inbox (미읽음/핀/유형 뱃지/검색)
/archive   — 보관함
/trash     — 휴지통 (TTL 후 자동 영구삭제)
/i/[id]    — 뷰어 (sandbox iframe)
/login     — PIN 입력
```

머신 전용 설정(포트, 배포, 도메인)은 CLAUDE.local.md 참고 (커밋되지 않음).
