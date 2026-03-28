import React from "react";
import { Card, Button, Typography } from "antd";
import {
  ThunderboltOutlined,
  ArrowRightOutlined,
  RocketOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import Paragraph from "antd/es/typography/Paragraph";

const { Title, Text } = Typography;

interface Feature {
  label: string;
  description: string;
  action: string;
  href: string;
  featured?: boolean;
}

const features: Feature[] = [
  {
    label: "Quiz Module",
    description:
      "Test your knowledge on specific topics like MERN, Python, or DSA with AI-generated questions.",
    action: "Start Practice",
    href: "/quizselector",
  },
  {
    label: "AI Interview",
    description:
      "A full-scale mock interview with real-time feedback on your tone, eye contact, and accuracy.",
    action: "Launch Session",
    href: "/interview",
  },
  {
    label: "Group Discussion",
    description:
      "Join a live discussion room, collaborate, and practice your communication skills on a real time generated topic.",
    action: "Join Lobby",
    href: "/gd",
  },
];

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      {/* Hero Section */}
      <div className="relative pt-2 pb-8 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_top,var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center md:text-left">
          <div className="max-w-3xl">
            <Title
              level={1}
              className="text-5xl! sm:text-7xl! font-black! tracking-tighter!  text-slate-900! dark:text-white!"
            >
              Master your next{" "}
              <span className="bg-linear-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-300 bg-clip-text text-transparent">
                career move.
              </span>
            </Title>

            <Paragraph className="text-slate-500! dark:text-slate-400! text-xl! max-w-2xl!">
              Practice real-world technical concepts or simulate a high-pressure
              interview with our proprietary AI models. Professional feedback,
              instantly.
            </Paragraph>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <Card
              key={feature.label}
              hoverable
              onClick={() => navigate(feature.href)}
              className={`group relative rounded-[2.5rem]! border-none! transition-all duration-500 cursor-pointer overflow-hidden
                ${
                  feature.featured
                    ? "bg-linear-to-br from-indigo-600 to-purple-700 dark:from-indigo-600/90 dark:to-purple-700/90 shadow-2xl shadow-indigo-500/30 active:scale-[0.98]"
                    : "border border-slate-200/80 bg-white shadow-sm hover:shadow-2xl hover:shadow-indigo-500/10 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
                }`}
            >
              <div className="p-4 flex flex-col h-full">
                <Title
                  level={3}
                  className={`mb-3! font-black! tracking-tight! ${feature.featured ? "text-white!" : "text-slate-900! dark:text-white!"}`}
                >
                  {feature.label}
                </Title>

                <Text
                  className={`text-base! leading-relaxed! grow mb-10! ${feature.featured ? "text-indigo-100!" : "text-slate-500! dark:text-slate-400!"}`}
                >
                  {feature.description}
                </Text>

                <div className="mt-auto">
                  <Button
                    type="text"
                    className={`p-0! text-white! flex! items-center! gap-2! text-xs! uppercase! tracking-[0.2em]! group-hover:gap-4! transition-all duration-300`}
                    icon={<ArrowRightOutlined className="text-sm" />}
                    iconPosition="end"
                  >
                    {feature.action}
                  </Button>
                </div>
              </div>

              {/* Decorative light effect for featured card */}
              {feature.featured && (
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              )}
            </Card>
          ))}
        </div>

        {/* Dynamic Stats Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              value: "10k+",
              label: "Assessments Generated",
              icon: <CheckCircleOutlined />,
            },
            {
              value: "98%",
              label: "Accuracy Rate",
              icon: <ThunderboltOutlined />,
            },
            {
              value: "24/7",
              label: "AI Availability",
              icon: <RocketOutlined />,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group flex items-center gap-5 p-8 rounded-4xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-500 dark:hover:border-indigo-500 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-xl text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">
                  {stat.value}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-1">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
