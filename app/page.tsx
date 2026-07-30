"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { ArrowIcon, CheckIcon, CloseIcon, KeyIcon, SettingsIcon, SparkIcon } from "./components/Icons";
import { MarkdownReport } from "./components/MarkdownReport";
import type { Framework, MicroTopic, PathOption, Perspective, ResearchState } from "./types";

const stepLabels = ["관점 발견", "세 길", "탐구 틀", "더 깊이", "보고서"];
const directionOptions = ["원리와 메커니즘", "사회적 영향", "문제와 해결", "비교와 대조", "윤리와 쟁점"];

type Settings = { apiKey: string; model: string };
type StudentInfo = { studentNumber: string; studentName: string; grade: string; subject: string };

function SettingsModal({ value, onClose, onSave }: { value: Settings; onClose: () => void; onSave: (v: Settings) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><CloseIcon /></button>
        <div className="modal-kicker"><SettingsIcon size={16} /> 개인 설정</div>
        <h2 id="settings-title">나의 Gemini 연결</h2>
        <p className="muted">API 키와 모델은 이 브라우저에만 저장됩니다. 생성 요청 때만 서버를 거쳐 Gemini로 전달돼요.</p>
        <label className="field-label" htmlFor="api-key">Gemini API Key</label>
        <div className="input-with-icon"><KeyIcon size={18} /><input id="api-key" type="password" value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} placeholder="AIza..." autoComplete="off" /></div>
        <label className="field-label" htmlFor="model">선호 모델</label>
        <input id="model" value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} placeholder="gemini-3.5-flash-lite" />
        <div className="modal-actions"><button className="button primary" onClick={() => onSave(draft)} disabled={!draft.model.trim()}>설정 저장</button></div>
      </section>
    </div>
  );
}

function StepRail({ current }: { current: number }) {
  return (
    <div className="step-rail" aria-label="탐구 진행 단계">
      {stepLabels.map((label, i) => {
        const n = i + 1;
        return <div className={`step-item ${n === current ? "active" : ""} ${n < current ? "done" : ""}`} key={label}>
          <span className="step-dot">{n < current ? <CheckIcon size={15} strokeWidth={2.5} /> : n}</span>
          <span>{label}</span>
        </div>;
      })}
    </div>
  );
}

export default function Home() {
  const [settings, setSettings] = useState<Settings>({ apiKey: "", model: "gemini-3.5-flash-lite" });
  const [showSettings, setShowSettings] = useState(false);
  const [student, setStudent] = useState<StudentInfo>({ studentNumber: "", studentName: "", grade: "2학년", subject: "" });
  const [state, setState] = useState<ResearchState>({ topic: "", direction: "" });
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedSettings = localStorage.getItem("inquiry-settings");
    if (savedSettings) {
      try { setSettings(JSON.parse(savedSettings)); } catch { /* ignore invalid local data */ }
    }
  }, []);

  const canStart = state.topic.trim().length >= 2 && state.direction && student.studentNumber.trim() && student.studentName.trim() && student.subject.trim();
  const studentId = `${student.studentNumber} ${student.studentName}`.trim();
  const context = useMemo(() => JSON.stringify(state), [state]);

  async function generate(nextStep: number, nextState = state) {
    setLoading(true); setError(""); setSaved(false);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: nextStep, apiKey: settings.apiKey, model: settings.model, context: nextState }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "콘텐츠를 생성하지 못했습니다.");
      setStep(nextStep);
      setResult(data.result);
      if (nextStep === 5 && typeof data.result === "string") {
        setState({ ...nextState, finalReport: data.result });
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."); }
    finally { setLoading(false); }
  }

  function choosePerspective(item: Perspective) {
    const next = { ...state, perspective: item };
    setState(next); generate(2, next);
  }
  function choosePath(item: PathOption) {
    const next = { ...state, path: item };
    setState(next); generate(3, next);
  }
  function acceptFramework() {
    const next = { ...state, framework: result as Framework };
    setState(next); generate(4, next);
  }
  function chooseMicro(item: MicroTopic) {
    const next = { ...state, microTopic: item };
    setState(next); generate(5, next);
  }

  async function saveResult() {
    const finalReport = state.finalReport || (typeof result === "string" ? result : "");
    if (!finalReport) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/topics", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ student_id: studentId, grade: student.grade, subject: student.subject, initial_topic: state.topic, final_report_md: finalReport }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "저장하지 못했습니다.");
      if (!data.topic?.id) throw new Error("저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  function reset() {
    setState({ topic: "", direction: "" }); setStudent({ studentNumber: "", studentName: "", grade: "2학년", subject: "" });
    setStep(0); setResult(null); setError(""); setSaved(false);
  }

  function saveSettings(v: Settings) {
    setSettings(v); localStorage.setItem("inquiry-settings", JSON.stringify(v)); setShowSettings(false); setError("");
  }

  return (
    <main>
      <AppHeader onSettings={() => setShowSettings(true)} />
      <div className="page-shell">
        {step > 0 && <StepRail current={step} />}

        {step === 0 && (
          <section className="intro-grid">
            <div className="hero-copy">
              <span className="eyebrow"><SparkIcon size={16} /> 막연한 호기심을, 날카로운 질문으로</span>
              <h1>생각의 결을 따라<br/><em>나만의 탐구</em>를 찾다.</h1>
              <p>하나의 관심사에서 출발해 관점을 고르고, 탐구의 길을 좁혀 보세요. 다섯 번의 선택 끝에 바로 쓸 수 있는 소논문 목차가 완성됩니다.</p>
              <div className="process-preview" aria-label="5단계 과정">
                {["10가지 관점", "3개의 길", "탐구 틀", "심화 주제", "보고서"].map((v, i) => <span key={v}><b>0{i+1}</b>{v}</span>)}
              </div>
            </div>
            <div className="start-card">
              <div className="card-number">01</div>
              <h2>탐구의 씨앗을 적어 주세요.</h2>
              <p>아직 완벽한 주제가 아니어도 괜찮아요. 지금 궁금한 현상이나 개념이면 충분합니다.</p>
              <label className="field-label" htmlFor="topic">막연한 관심사 또는 탐구 주제</label>
              <textarea id="topic" value={state.topic} onChange={(e) => setState({ ...state, topic: e.target.value })} placeholder="예: 미세플라스틱은 우리 몸에 어떤 영향을 줄까?" rows={3} />
              <div className="student-grid student-grid-four">
                <label><span className="field-label">학번</span><input value={student.studentNumber} onChange={(e) => setStudent({ ...student, studentNumber: e.target.value })} placeholder="2107" inputMode="numeric" /></label>
                <label><span className="field-label">이름</span><input value={student.studentName} onChange={(e) => setStudent({ ...student, studentName: e.target.value })} placeholder="김탐구" /></label>
                <label><span className="field-label">학년</span><select value={student.grade} onChange={(e) => setStudent({ ...student, grade: e.target.value })}><option>1학년</option><option>2학년</option><option>3학년</option></select></label>
                <label><span className="field-label">과목</span><input value={student.subject} onChange={(e) => setStudent({ ...student, subject: e.target.value })} placeholder="생명과학" /></label>
              </div>
              <span className="field-label">어떤 결로 바라보고 싶나요?</span>
              <div className="chip-group">
                {directionOptions.map((v) => <button key={v} className={`chip ${state.direction === v ? "selected" : ""}`} onClick={() => setState({ ...state, direction: v })}>{v}</button>)}
              </div>
              <button className="button primary wide" disabled={!canStart || loading} onClick={() => generate(1)}>
                {loading ? "관점을 펼치는 중…" : <>10가지 관점 만나기 <ArrowIcon size={18} /></>}
              </button>
              {!settings.apiKey && <button className="key-hint" onClick={() => setShowSettings(true)}><KeyIcon size={15}/> 개인 Gemini API Key를 사용하려면 설정에서 입력해 주세요</button>}
            </div>
          </section>
        )}

        {step > 0 && (
          <section className="workspace">
            <div className="workspace-heading">
              <div><span className="section-kicker">STEP {String(step).padStart(2, "0")}</span>
                <h1>{step === 1 ? "어떤 관점으로 바라볼까요?" : step === 2 ? "탐구의 세 길이 열렸어요." : step === 3 ? "탐구의 뼈대를 확인해 보세요." : step === 4 ? "한 단계 더 깊이 들어가 볼까요?" : "탐구 보고서 설계가 완성됐어요."}</h1>
                <p>{step < 5 ? "마음이 끌리는 카드를 선택하면 다음 단계로 이어집니다." : `${studentId} 학생의 ${student.subject} 탐구 보고서 초안입니다.`}</p>
              </div>
              <button className="text-button" onClick={reset}>처음부터 다시</button>
            </div>

            {loading && <div className="loading-panel"><span className="loader" /><h3>생각의 결을 다듬고 있어요</h3><p>구체적인 개념과 연구 초점을 연결하는 중입니다.</p></div>}
            {!loading && step === 1 && <div className="perspective-grid">{(result as Perspective[]).map((item, i) => <button className="choice-card perspective-card" key={item.key} onClick={() => choosePerspective(item)}><span className="index">{String(i+1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.description}</p><span className="card-action">이 관점 선택 <ArrowIcon size={16}/></span></button>)}</div>}
            {!loading && step === 2 && <div className="path-grid">{(result as PathOption[]).map((item, i) => <button className="choice-card path-card" key={item.title} onClick={() => choosePath(item)}><span className="path-label">PATH {i+1}</span><h2>{item.title}</h2><blockquote>{item.question}</blockquote><p>{item.description}</p><span className="card-action">이 길로 탐구하기 <ArrowIcon size={16}/></span></button>)}</div>}
            {!loading && step === 3 && (() => { const f = result as Framework; return <div className="framework-card"><div className="framework-row question"><span>무엇을 묻나</span><h2><em>{f.question}</em></h2></div><div className="framework-row"><span>어떻게 알아보나</span><p>{f.method}</p></div><div className="framework-row"><span>무엇을 만나게 되나</span><p>{f.insight}</p></div><button className="button primary" onClick={acceptFramework}>이 틀로 더 깊이 <ArrowIcon size={18}/></button></div>; })()}
            {!loading && step === 4 && <div className="micro-grid">{(result as MicroTopic[]).map((item, i) => <button className="choice-card micro-card" key={item.title} onClick={() => chooseMicro(item)}><span className="micro-num">{i+1}</span><h2>{item.title}</h2><p>{item.description}</p><span className="card-action">최종 보고서로 <ArrowIcon size={16}/></span></button>)}</div>}
            {!loading && step === 5 && typeof result === "string" && <><div className="report-paper"><MarkdownReport markdown={result}/></div><div className="save-bar"><div><h3>{saved ? "Supabase에 안전하게 저장됐어요." : "이 탐구를 내 기록으로 남길까요?"}</h3><p>{saved ? "저장 내역에서 지금 바로 확인할 수 있습니다." : "중간 과정은 저장하지 않고, 완성된 보고서만 저장합니다."}</p></div>{saved ? <div className="save-actions"><span className="button success"><CheckIcon size={18}/> 저장 완료</span><Link className="button saved-link" href="/history">저장 내역 보기 <ArrowIcon size={16}/></Link></div> : <button className="button primary" onClick={saveResult} disabled={loading}>결과를 Supabase에 저장</button>}</div></>}
          </section>
        )}
        {error && <div className="toast error" role="alert">{error}<button onClick={() => setError("")} aria-label="알림 닫기"><CloseIcon size={16}/></button></div>}
      </div>
      <footer><span>탐구의 결</span><p>질문을 고르는 힘이 탐구의 깊이를 만듭니다.</p></footer>
      {showSettings && <SettingsModal value={settings} onClose={() => setShowSettings(false)} onSave={saveSettings} />}
      <span className="sr-only">{context}</span>
    </main>
  );
}
