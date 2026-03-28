import { useLocation, useNavigate } from "react-router-dom";
import {
  Tag,
  Radio,
  Button,
  Card,
  Typography,
  Result,
  Spin,
  message,
} from "antd";
import {
  DownloadOutlined,
  LeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Title, Text, Paragraph } = Typography;

interface QuizState {
  skills: string[];
  role: string;
  type: "quick" | "job-role";
  questionCount: number;
}

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  topic_tag: string;
}

interface QuizResult {
  score_percentage: number;
  correct_answers: number;
  total_questions: number;
  review: {
    question_id: string;
    question_text: string;
    options: string[];
    selected_option: number;
    correct_option: number;
    explanation: string;
  }[];
}

function Quiz() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as QuizState | null;

  const skills = state?.skills ?? [];
  const role = state?.role ?? "";
  const quizType = state?.type ?? "quick";
  const questionCount = state?.questionCount ?? 10;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  const getQuestions = async () => {
    setLoading(true);
    try {
      const payload = {
        type: quizType,
        skill_names: quizType === "quick" ? skills : [],
        job_description: quizType === "job-role" ? role : "",
        num_questions: questionCount,
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/start`,
        payload,
        getAuthHeaders(),
      );
      setQuestions(data.questions);
    } catch (error) {
      message.error("Error loading quiz questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getQuestions();
  }, []);

  const handleSelect = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedAnswers).length < questions.length) {
      message.warning("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        session_type: String(quizType),
        selected_skills: quizType === "quick" ? skills : [],
        job_description: quizType === "job-role" ? String(role) : "",
        extracted_skills: quizType === "quick" ? skills : [],
        answers: questions.map((q) => ({
          question_id: q.id,
          selected_option: Number(selectedAnswers[q.id]),
        })),
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/submit`,
        payload,
        getAuthHeaders(),
      );

      setQuizResult(data);
      message.success("Quiz submitted successfully!");
      window.scrollTo({ top: 0 });
    } catch (error: any) {
      message.error("Submission failed (500)");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Quiz Assessment Report", 14, 20);
    doc.setFontSize(10);
    doc.text(
      `Focus: ${quizType === "quick" ? skills.join(", ") : role}`,
      14,
      30,
    );
    doc.text(`Score: ${quizResult?.score_percentage}%`, 14, 35);

    const rows = quizResult?.review.map((item, idx) => [
      idx + 1,
      item.question_text,
      item.options[item.selected_option] || "Skipped",
      item.options[item.correct_option],
      item.explanation,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["#", "Question", "Your Answer", "Correct Answer", "Explanation"]],
      body: rows || [],
      styles: { fontSize: 7 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save("quiz_results.pdf");
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0d1117] transition-colors duration-300">
        <Spin size="large" />
        <Text className="mt-4 text-slate-500! dark:text-slate-400! animate-pulse">
          AI is preparing your quiz...
        </Text>
      </div>
    );

  if (quizResult) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0d1117] py-12 px-4 transition-colors duration-300">
        <div className="mx-20">
          <Card className="shadow-2xl rounded-3xl! mb-10 text-center bg-white dark:bg-[#161b22] border-slate-100! dark:border-slate-800!">
            <Result
              status={quizResult.score_percentage >= 70 ? "success" : "warning"}
              title={
                <span className="text-slate-900! dark:text-white! font-black text-2xl tracking-tight">
                  Assessment Score: {quizResult.score_percentage}%
                </span>
              }
              subTitle={
                <span className="text-slate-500! dark:text-slate-400!">
                  You got {quizResult.correct_answers} out of{" "}
                  {quizResult.total_questions} questions correct.
                </span>
              }
              extra={[
                <Button
                  type="primary"
                  key="pdf"
                  icon={<DownloadOutlined />}
                  onClick={downloadPDF}
                  size="large"
                  className="rounded-xl! bg-indigo-600! border-none! shadow-lg shadow-indigo-500/20 hover:scale-105! transition-all"
                >
                  Download Report
                </Button>,
                <Button
                  key="back"
                  onClick={() => navigate("/")}
                  size="large"
                  className="rounded-xl! dark:bg-slate-800! dark:text-white! dark:border-slate-700! hover:border-indigo-500!"
                >
                  Back Home
                </Button>,
              ]}
            />
          </Card>

          <div className="space-y-6">
            <Title
              level={4}
              className="dark:text-slate-300! px-2 my-4 uppercase tracking-widest text-lg! font-bold"
            >
              Question Review
            </Title>
            {quizResult.review.map((item, idx) => (
              <Card
                key={idx}
                className="rounded-2xl! border-none shadow-sm dark:bg-[#161b22] overflow-hidden mb-4!"
              >
                <div className="flex items-start gap-4 p-2">
                  <div className="mt-1">
                    {item.selected_option === item.correct_option ? (
                      <CheckCircleOutlined className="text-green-500 text-xl" />
                    ) : (
                      <CloseCircleOutlined className="text-red-500 text-xl" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Text
                      strong
                      className="block mb-6 text-lg! text-slate-800! dark:text-slate-200! leading-snug"
                    >
                      {item.question_text}
                    </Text>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {item.options.map((opt, i) => {
                        let containerStyle =
                          "p-4 rounded-xl border-2 transition-all ";
                        if (i === item.correct_option)
                          containerStyle +=
                            "bg-green-50/50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400 font-bold";
                        else if (i === item.selected_option)
                          containerStyle +=
                            "bg-red-50/50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 font-bold";
                        else
                          containerStyle +=
                            "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-500";

                        return (
                          <div key={i} className={containerStyle}>
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 p-5 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border-l-4 border-indigo-400">
                      <Text className="text-lg! text-indigo-900! dark:text-indigo-300! leading-relaxed italic">
                        <strong className="not-italic uppercase text-lg mr-1 opacity-70">
                          Explanation:
                        </strong>
                        {item.explanation}
                      </Text>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto pt-4 bg-slate-50 dark:bg-[#0d1117] min-h-screen transition-all duration-500">
      <header className="flex flex-col justify-between md:flex-row md:items-end">
        <div>
          <Button
            icon={<LeftOutlined />}
            type="text"
            onClick={() => navigate("/")}
            className="mx-20! mb-2! pl-0! text-slate-500! dark:text-slate-400! hover:text-slate-700! transition-colors text-lg!"
          >
            Exit Quiz
          </Button>
          <Title
            level={2}
            className="mx-20! font-black! tracking-tight! dark:text-indigo-400!"
          >
            {quizType === "quick" ? "Skill Practice" : "Role Assessment"}
          </Title>
        </div>
        <div className="flex gap-2 flex-wrap mx-20">
          {quizType === "quick" ? (
            skills.map((s) => (
              <Tag
                color="blue"
                key={s}
                className="rounded-full! px-4! py-1! border-none! shadow-sm"
              >
                {s}
              </Tag>
            ))
          ) : (
            <Tag
              color="purple"
              className="rounded-full! px-5! py-1! border-none! shadow-sm font-bold tracking-wide uppercase text-[10px]"
            >
              {role}
            </Tag>
          )}
        </div>
      </header>

      <div className="mx-20">
        {questions.map((q, idx) => (
          <Card
            key={q.id}
            title={
              <h2 className="text-xl text-slate-400 uppercase font-extrabold">
                Question {idx + 1}
              </h2>
            }
            className="mb-4! rounded-3xl! shadow-xl dark:shadow-black/20 border border-slate-200! dark:border-slate-800! bg-white! dark:bg-[#161b22] overflow-hidden"
          >
            <Paragraph className="text-lg! font-bold text-slate-800! dark:text-slate-100!">
              {q.question_text}
            </Paragraph>
            <Radio.Group
              onChange={(e) => handleSelect(q.id, e.target.value)}
              value={selectedAnswers[q.id]}
              className="w-full"
            >
              <div className="flex flex-col gap-4">
                {q.options.map((opt, i) => (
                  <Radio
                    key={i}
                    value={i}
                    className="group w-full rounded-2xl! border border-slate-200 p-5 transition-all dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500"
                  >
                    <span className="ml-2 text-lg">{opt}</span>
                  </Radio>
                ))}
              </div>
            </Radio.Group>
          </Card>
        ))}
      </div>

      <div className="mt-2 bg-linear-to-t from-slate-50 dark:from-[#0d1117] mx-20!">
        <Button
          type="primary"
          size="large"
          block
          onClick={handleSubmit}
          loading={submitting}
          disabled={Object.keys(selectedAnswers).length < questions.length}
          className="h-16 rounded-2xl! bg-indigo-600! hover:bg-indigo-700! border-none! font-white! text-lg! tracking-wide! shadow-2xl shadow-indigo-500/40 disabled:bg-slate-200! dark:disabled:bg-slate-800! transition-all hover:scale-[1.01]"
        >
          {submitting ? "Processing..." : "Submit Final Assessment"}
        </Button>
        {Object.keys(selectedAnswers).length < questions.length && (
          <div className="text-center mt-3 animate-bounce">
            <Text className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Answer all questions to unlock submission
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

export default Quiz;
