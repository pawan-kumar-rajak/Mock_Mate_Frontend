import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Spin,
  Typography,
  message,
  Progress,
  Divider,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { getInterviewReport } from "../services/interviewApi";
import {
  TrophyOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ArrowLeftOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import type { InterviewReport } from "../types/interview";

const { Title, Text, Paragraph } = Typography;

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return [value];
  return [];
};

const getErrorText = (err: unknown): string => {
  if (typeof err === "string") return err;
  const e = err as any;
  return (
    e.response?.data?.detail ||
    e.response?.data?.message ||
    e.message ||
    "Unknown error"
  );
};

function InterviewReportPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<InterviewReport | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    if (!accessToken) {
      message.error("Please sign in to view your report.");
      navigate("/signin");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await getInterviewReport({ sessionId, accessToken });
        if (!cancelled) setReport(r);
      } catch (err: unknown) {
        message.error(getErrorText(err) || "Failed to load report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, navigate, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center transition-colors duration-500">
        <Spin size="large" />
        <Text className="mt-4 dark:text-slate-400 italic">
          Compiling your interview performance...
        </Text>
      </div>
    );
  }

  if (!report || !sessionId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 transition-colors duration-500">
        <Card className="rounded-3xl shadow-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 text-center p-8 max-w-sm">
          <Text className="text-lg text-slate-600 block mb-6 dark:text-slate-300">
            Session data not found.
          </Text>
          <Button
            type="primary"
            block
            className="rounded-xl h-12 bg-indigo-600 border-none"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  const strengths = asStringArray(report.strengths);
  const weaknesses = asStringArray(report.weaknesses);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors duration-500">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Main Header & Score Card */}
        <Card className="rounded-4xl! shadow-2xl border border-slate-200! dark:border-slate-800! overflow-hidden bg-white dark:bg-slate-900 transition-all">
          <div className="bg-indigo-600 p-8 md:p-12 text-center text-white relative">
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />

            <TrophyOutlined className="text-6xl mb-4 text-amber-300 animate-bounce" />
            <Title
              level={1}
              className="m-0! font-black! tracking-tighter! text-white!"
            >
              Interview Insights
            </Title>
            <Text className="text-indigo-100 font-medium opacity-80 uppercase tracking-widest text-xs mt-2 block">
              Session ID: {sessionId}
            </Text>
          </div>

          <div className="p-8 md:p-12">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="relative">
                <Progress
                  type="circle"
                  percent={report.overall_score}
                  strokeWidth={10}
                  size={160}
                  strokeColor={{ "0%": "#4f46e5", "100%": "#818cf8" }}
                  format={(p) => (
                    <div className="flex flex-col">
                      <span className="text-3xl font-black text-slate-800 dark:text-white">
                        {p}%
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Score
                      </span>
                    </div>
                  )}
                />
              </div>
              <div className="flex-1 text-center md:text-left">
                <Title level={4} className="dark:text-slate-200! mb-4!">
                  Performance Summary
                </Title>
                <Paragraph className="text-lg text-slate-600! dark:text-slate-400! italic leading-relaxed">
                  "
                  {report.summary ||
                    "Your performance has been evaluated based on technical and behavioral benchmarks."}
                  "
                </Paragraph>
              </div>
            </div>

            <Divider className="dark:border-slate-800" />

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Button
                icon={<ArrowLeftOutlined />}
                size="large"
                className="h-14 rounded-2xl flex-1 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 font-bold"
                onClick={() => navigate("/")}
              >
                Dashboard
              </Button>
              <Button
                type="primary"
                icon={<RocketOutlined />}
                size="large"
                className="h-14 rounded-2xl flex-2 bg-indigo-600 hover:bg-indigo-700 border-none font-black shadow-lg shadow-indigo-500/20"
                onClick={() => navigate("/interview-setup")}
              >
                Start New Session
              </Button>
            </div>
          </div>
        </Card>

        {/* Detailed Feedback Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Strengths Card */}
          <Card className="rounded-3xl! shadow-xl border border-slate-200! dark:border-slate-800! bg-white dark:bg-slate-900">
            <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-2xl mb-6 flex items-center gap-3">
              <CheckCircleOutlined className="text-green-500 text-xl" />
              <Text className="font-black uppercase tracking-widest text-xs text-green-700 dark:text-green-400">
                Key Strengths
              </Text>
            </div>
            {strengths.length > 0 ? (
              <ul className="space-y-4 px-2">
                {strengths.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 text-slate-700 dark:text-slate-300 leading-snug"
                  >
                    <span className="text-green-500 font-bold">•</span> {s}
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="italic text-slate-400 block px-2">
                No specific strengths noted.
              </Text>
            )}
          </Card>

          {/* Weaknesses Card */}
          <Card className="rounded-3xl! shadow-xl border border-slate-200! dark:border-slate-800! bg-white dark:bg-slate-900">
            <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl mb-6 flex items-center gap-3">
              <WarningOutlined className="text-red-500 text-xl" />
              <Text className="font-black uppercase tracking-widest text-xs text-red-700 dark:text-red-400">
                Growth Areas
              </Text>
            </div>
            {weaknesses.length > 0 ? (
              <ul className="space-y-4 px-2">
                {weaknesses.map((w, idx) => (
                  <li
                    key={idx}
                    className="flex gap-3 text-slate-700 dark:text-slate-300 leading-snug"
                  >
                    <span className="text-red-500 font-bold">•</span> {w}
                  </li>
                ))}
              </ul>
            ) : (
              <Text className="italic text-slate-400 block px-2">
                No specific weaknesses noted.
              </Text>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default InterviewReportPage;
