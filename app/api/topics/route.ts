// Node.js 서버리스 함수에서 환경 변수를 안전하게 읽습니다.
export const runtime = "nodejs";

type TopicInput = {
  student_id: string;
  grade: string;
  subject: string;
  initial_topic: string;
  final_report_md: string;
};

function config() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL 또는 서버 전용 Secret Key가 연결되지 않았습니다.");
  }
  return { url, key };
}

function headers(key: string) {
  return { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };
}

export async function GET() {
  try {
    const { url, key } = config();
    const response = await fetch(`${url}/rest/v1/student_topics?select=*&order=created_at.desc`, { headers: headers(key), cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "저장 내역을 불러오지 못했습니다.");
    return Response.json({ topics: data });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as TopicInput;
    if (!input.student_id?.trim() || !input.grade?.trim() || !input.subject?.trim() || !input.initial_topic?.trim() || !input.final_report_md?.trim()) {
      return Response.json({ error: "저장할 학생 정보와 보고서가 부족합니다." }, { status: 400 });
    }
    const { url, key } = config();
    const response = await fetch(`${url}/rest/v1/student_topics`, {
      method: "POST",
      headers: { ...headers(key), Prefer: "return=representation" },
      body: JSON.stringify(input),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Supabase 저장에 실패했습니다.");
    return Response.json({ topic: data[0] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
