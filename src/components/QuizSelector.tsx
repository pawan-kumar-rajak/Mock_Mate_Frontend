import { useEffect, useState } from "react";
import { Tabs, Input, Button, Typography, Tag, InputNumber } from "antd";
import {
  BookOutlined,
  UserOutlined,
  BulbOutlined,
  StarOutlined,
  PlusOutlined,
  RocketOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useLoaderData, useNavigate } from "react-router-dom";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;

interface Skill {
  id: string;
  name: string;
  category: string;
}

const QuizSelector = () => {
  const [skills, setSkills] = useState<string[]>([]);
  const [presetSkills, setPresetSkills] = useState<Skill[]>(
    useLoaderData() as Skill[],
  );
  const [skillInput, setSkillInput] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const navigate = useNavigate();

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  const getPresetSkills = async () => {
    try {
      const response = await axios.get<Skill[]>(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/skills`,
        getAuthHeaders(),
      );
      setPresetSkills(response.data);
    } catch (error) {
      console.error("Error fetching preset skills:", error);
    }
  };

  useEffect(() => {
    getPresetSkills();
  }, []);

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed) {
      setSkills((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      setSkillInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAddSkill(skillInput);
    }
  };

  const skillQuiz = () => {
    navigate("/quiz", {
      state: { skills, role: "", type: "quick", questionCount },
    });
  };

  const roleQuiz = () => {
    navigate("/quiz", {
      state: { skills: [], role: customRole, type: "job-role", questionCount },
    });
  };

  // Shared Tailwind styles
  const cardBase =
    "p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-black/40 flex flex-col justify-between transition-all duration-500";
  const inputBase =
    "h-12 rounded-2xl border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100";

  const items = [
    {
      label: (
        <span className="flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest">
          <BulbOutlined className="mr-2" /> Specific Topics
        </span>
      ),
      key: "1",
      children: (
        <div className={cardBase}>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-2xl">
                <StarOutlined className="text-xl text-amber-500" />
              </div>
              <div>
                <Title
                  level={4}
                  className="m-0! font-black! tracking-tight! dark:text-white!"
                >
                  Add topics to start the quiz
                </Title>
              </div>
            </div>

            <div className="mb-4">
              <Text className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase block mb-4">
                Quick Add Popular Topics:
              </Text>
              <div className="flex flex-wrap gap-2">
                {presetSkills.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleAddSkill(preset.name)}
                    disabled={skills.includes(preset.name)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 uppercase!
                      ${
                        skills.includes(preset.name)
                          ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed"
                          : "bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 active:scale-95"
                      }`}
                  >
                    <PlusOutlined className="text-[10px]" /> {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex">
              <Input
                placeholder="Or type a custom topic and press Enter..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className={inputBase}
                prefix={<BookOutlined className="text-slate-400 mr-2" />}
              />
              <label className="ml-6 mr-4 self-center text-start font-bold text-slate-700 dark:text-slate-300">
                Question Count
              </label>
              <InputNumber
                min={1}
                max={30}
                value={questionCount}
                className="w-28! rounded-2xl! border-slate-200! dark:border-slate-700!"
                onChange={(value) => setQuestionCount(value ?? 10)}
              />
            </div>

            <div className="flex flex-wrap gap-2 mt-4 min-h-12 items-start">
              {skills.length > 0 ? (
                skills.map((skill) => (
                  <Tag
                    key={skill}
                    closable
                    closeIcon={
                      <CloseOutlined className="text-red-500! text-xs! ml-1!" />
                    }
                    onClose={() =>
                      setSkills((prev) => prev.filter((s) => s !== skill))
                    }
                    className="px-3! py-2! rounded-full bg-indigo-50! dark:bg-indigo-500/10! text-indigo-600! dark:text-indigo-400! border-none! text-xs! font-bold! uppercase! animate-in zoom-in duration-300"
                  >
                    {skill}
                  </Tag>
                ))
              ) : (
                <Text className="text-slate-400 dark:text-slate-600 italic text-sm ml-1">
                  No topics yet...
                </Text>
              )}
            </div>
          </div>

          <Button
            type="primary"
            size="large"
            block
            disabled={skills.length === 0}
            icon={<RocketOutlined />}
            className="h-14 rounded-2xl! bg-indigo-400! hover:bg-indigo-600! border-none! text-white! disabled:hover:text-gray-500! tracking-wide! shadow-xl shadow-indigo-500/20 active:scale-95 transition-all mt-2!"
            onClick={skillQuiz}
          >
            Generate Skill Quiz
          </Button>
        </div>
      ),
    },
    {
      label: (
        <span className="flex items-center px-6 py-2 text-xs font-black uppercase tracking-widest">
          <UserOutlined className="mr-2" /> Job Role
        </span>
      ),
      key: "2",
      children: (
        <div className={cardBase}>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl">
                <UserOutlined className="text-xl text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Title
                  level={4}
                  className="m-0! font-black! tracking-tight! dark:text-white!"
                >
                  Role-Based Assessment
                </Title>
                <Text className="text-xs! text-slate-400! font-bold! uppercase! tracking-widest!"></Text>
              </div>
            </div>

            <Paragraph className="text-slate-500 dark:text-slate-400 mb-8 text-base! leading-relaxed!">
              Enter the specific job title you're preparing for. Our AI will
              curate questions that will help you.
            </Paragraph>

            <div className="flex">
              <Input
                placeholder="e.g. MERN Stack Developer..."
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                className={`${inputBase} mb-4`}
                prefix={<StarOutlined className="text-indigo-400 mr-2" />}
              />
              <label className="ml-6 mr-4 self-center text-start font-bold text-slate-700 dark:text-slate-300">
                Question Count
              </label>
              <InputNumber
                min={1}
                max={30}
                value={questionCount}
                className="w-28! h-12 rounded-2xl! border-slate-200! dark:border-slate-700!"
                onChange={(value) => setQuestionCount(value ?? 10)}
              />
            </div>
          </div>

          <Button
            disabled={!customRole}
            type="primary"
            size="large"
            block
            icon={<RocketOutlined />}
            onClick={roleQuiz}
            className="h-14 rounded-2xl! bg-indigo-400! hover:bg-indigo-600! border-none! text-white! disabled:hover:text-gray-500! tracking-wide! shadow-xl shadow-indigo-500/20 active:scale-95 transition-all mt-2!"
          >
            Start Role Interview
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-4 transition-colors duration-500 relative overflow-hidden">
      {/* Dynamic Ambience */}
      <div className="absolute top-0 right-0 w-150 h-150 bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="max-w-3xl mx-auto relative">
        <div className="text-center">
          <Title
            level={1}
            className="text-5xl! font-black! tracking-tighter! text-slate-900! dark:text-white! mb-4"
          >
            Quiz Setup
          </Title>
          <Text className="text-lg! text-slate-500 dark:text-slate-400 max-w-lg mx-auto block">
            Select your preferred assessment mode and let our AI models tailor
            the experience for you.
          </Text>
        </div>

        <Tabs
          defaultActiveKey="1"
          centered
          items={items}
          className="quiz-tabs-custom"
        />
      </div>
    </div>
  );
};

export default QuizSelector;
