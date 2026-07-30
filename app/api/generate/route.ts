import type { ResearchState } from "../../types";

// Node.js 서버리스 함수에서 환경 변수를 안전하게 읽습니다.
export const runtime = "nodejs";

const perspectives = ["정의", "척도", "범위", "차이", "변수", "조건", "수단", "모름", "오류", "예외"];

function systemPrompt(step: number, c: ResearchState) {
  const base = `당신은 한국 고등학생의 막연한 관심사를 깊이 있는 소논문/탐구 보고서 주제로 발전시키는 수석 교육 컨설턴트입니다.
학생의 처음 탐구 주제: ${c.topic}
선택한 결(방향): ${c.direction}
학생 수준을 넘어서 과도한 연구를 요구하지 말고, 구체적인 개념과 현상을 직접 언급하세요. 한국어로 답하세요.`;

  if (step === 1) return `${base}
주제를 파고들 수 있는 고정된 10가지 관점 [${perspectives.join(", ")}]을 정확히 이 순서로 생성하세요.
각 관점마다 관점 이름을 활용한 매력적인 title과, 2~3문장의 구체적인 description을 작성하세요.
추상적인 단어를 피하고 '~해 봅니다', '~를 짚어 봅니다'처럼 사유를 자극하는 어미를 사용하세요.
반드시 JSON 배열만 출력하세요. 각 항목 형식: {"key":"정의","title":"...","description":"..."}`;

  if (step === 2) return `${base}
선택한 관점: ${c.perspective?.title} — ${c.perspective?.description}
이 관점 안에서 서로 다른 연구 초점을 가진 구체적이고 심화된 탐구 경로 3개를 제안하세요.
고등학생 수준을 넘지 않되 학술적이고 비판적인 시각을 담으세요.
반드시 JSON 배열만 출력하세요. 각 항목 형식: {"title":"매력적인 소제목","question":"한 문장의 핵심 질문","description":"구체적으로 파고들 내용 2문장"}`;

  if (step === 3) return `${base}
선택한 관점: ${c.perspective?.title}
최종 선택한 길: ${c.path?.title}
핵심 질문: ${c.path?.question}
설명: ${c.path?.description}
탐구 전개를 세 항목으로 구조화하세요. question은 단 하나의 날카로운 핵심 질문, method는 고등학생이 접근 가능한 구체적 방법론 3~4문장, insight는 예상 학술적 통찰과 결론 방향 3~4문장이어야 합니다.
반드시 JSON 객체만 출력하세요. 형식: {"question":"...","method":"...","insight":"..."}`;

  if (step === 4) return `${base}
선택한 길: ${c.path?.title} — ${c.path?.description}
기본 탐구 질문: ${c.framework?.question}
방법: ${c.framework?.method}
현재 탐구에서 한 걸음 더 깊이 들어가는 심화 탐구(Micro-topic) 3개를 제안하세요.
대학 전공 기초 수준의 구체적인 전공어를 소제목에 적극 활용하고, 기존 탐구를 어떻게 더 날카롭게 만드는지 3문장 이내로 설명하세요.
반드시 JSON 배열만 출력하세요. 각 항목 형식: {"title":"전공어가 포함된 소제목","description":"..."}`;

  return `${base}
선택한 관점: ${c.perspective?.title}
선택한 세부 길: ${c.path?.title} — ${c.path?.question}
기본 탐구 틀: 질문=${c.framework?.question} / 방법=${c.framework?.method} / 통찰=${c.framework?.insight}
선택한 심화 탐구: ${c.microTopic?.title} — ${c.microTopic?.description}
위 내용을 모두 종합하여 한국 고등학교 탐구 보고서(소논문) 양식에 맞는 세밀한 목차와 개요를 작성하세요.
# 보고서 제목: 부제가 포함된 매력적이고 학술적인 제목
## I. 서론
### 1.1 탐구 동기 및 배경
### 1.2 탐구 질문 및 목적
### 1.3 탐구 범위와 접근 방식
각 항목에 학생이 작성할 방향을 2~3문장으로 안내하세요.
## II. 본론
2.1 이론적 배경부터 최소 4개 이상의 소목차를 두고, 각 소목차 아래 설명과 함께 '꼭 들어가야 할 내용' 3~4개를 bullet로 명시하세요. 흐름은 이론 → 분석/대조 → 문제점 도출/해석으로 이어져야 합니다.
## III. 결론
### 3.1 발견 요약
### 3.2 탐구의 의의와 한계
반드시 위계가 명확한 마크다운만 출력하고, 코드 펜스는 쓰지 마세요.`;
}

function extractText(payload: unknown) {
  const p = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
  if (p.error?.message) throw new Error(p.error.message);
  const text = p.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini가 빈 응답을 반환했습니다.");
  return text;
}

function parseJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(clean);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { step?: number; apiKey?: string; model?: string; context?: ResearchState };
    if (!body.context || !body.step || body.step < 1 || body.step > 5) {
      return Response.json({ error: "요청 정보가 올바르지 않습니다." }, { status: 400 });
    }
    const apiKey = body.apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Gemini API Key가 연결되지 않았습니다. Vercel 환경 변수 GEMINI_API_KEY를 확인해 주세요." }, { status: 500 });
    }
    const model = (body.model || "gemini-3.5-flash-lite").replace(/^models\//, "");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(body.step, body.context) }] },
        contents: [{ role: "user", parts: [{ text: `${body.step}단계 결과를 생성해 주세요.` }] }],
        generationConfig: {
          temperature: body.step === 5 ? 0.65 : 0.8,
          responseMimeType: body.step === 5 ? "text/plain" : "application/json",
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      const message = (payload as { error?: { message?: string } }).error?.message || "Gemini 요청에 실패했습니다.";
      return Response.json({ error: message }, { status: response.status });
    }
    const text = extractText(payload);
    return Response.json({ result: body.step === 5 ? text : parseJson(text) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
