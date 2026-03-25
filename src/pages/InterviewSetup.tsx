import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Typography,
  Upload,
  Divider,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  InboxOutlined,
  RocketOutlined,
  SettingOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { startInterview } from "../services/interviewApi";
import type { InterviewType, LLMMode, LLMProvider } from "../types/interview";

const { Title, Text } = Typography;

type SetupFormValues = {
  job_role: string;
  max_questions: number;
  interview_type: InterviewType;
  llm_mode: LLMMode;
  llm_provider: LLMProvider;
  api_key?: string;
};

const DEFAULTS: SetupFormValues = {
  job_role: "",
  max_questions: 8,
  interview_type: "TR",
  llm_mode: "project_gemini_key",
  llm_provider: "gemini",
  api_key: "",
};

const isPdfFile = (file: File): boolean => {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
};

const getErrorText = (err: unknown): string => {
  if (typeof err === "string") return err;
  const e = err as any;
  const data = e.response?.data;
  
  // FastAPI returns validation errors in a "detail" array
  if (data?.detail && Array.isArray(data.detail)) {
    return data.detail
      .map((d: any) => `${d.loc?.join(".") || "error"}: ${d.msg}`)
      .join("; ");
  }

  return (
    data?.detail ||
    data?.message ||
    e.message ||
    "Unknown error"
  );
};

function InterviewSetup() {
  const navigate = useNavigate();
  const [form] = Form.useForm<SetupFormValues>();
  const [resumeFileList, setResumeFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const onSubmit = async (values: SetupFormValues) => {
    if (!accessToken) {
      message.error("Please sign in before starting.");
      navigate("/signin");
      return;
    }

    const resume = resumeFileList[0]?.originFileObj as File | undefined;
    if (!resume || !isPdfFile(resume)) {
      message.error("Please upload a valid PDF resume.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("resume_file", resume);
      formData.append("job_role", values.job_role.trim());
      formData.append("max_questions", String(values.max_questions));
      formData.append("llm_mode", values.llm_mode);
      formData.append("llm_provider", values.llm_provider);
      formData.append("interview_type", values.interview_type);

      if (values.llm_mode === "own_api_key") {
        formData.append("api_key", values.api_key?.trim() || "");
      }

      const started = await startInterview({ formData, accessToken });
      form.setFieldValue("api_key", "");
      navigate(`/interview/${started.session_id}`, {
        state: { firstQuestion: started.first_question },
      });
    } catch (err: unknown) {
      message.error(getErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Shared Tailwind styles
  const inputBase =
    "rounded-xl! h-11! border-slate-200! dark:border-slate-700! bg-white! dark:bg-slate-800/50! text-slate-900! dark:text-slate-100! placeholder:text-slate-400! dark:placeholder:text-slate-500! hover:border-indigo-500! transition-all";
  const labelText =
    "text-slate-600 dark:text-slate-400 font-bold text-[14px] uppercase tracking-wider ml-1";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-4 transition-colors duration-500 relative">
      <div className="absolute top-0 right-0 w-full h-64 bg-linear-to-b from-indigo-500/5 to-transparent pointer-events-none" />

      <div className="max-w-3xl mx-auto relative">
        <header className="mb-6 text-center md:text-left">
          <Title
            level={2}
            className="m-0! font-black! tracking-tight! text-slate-900! dark:text-white!"
          >
            Interview Setup
          </Title>
          <Text className="text-slate-500 dark:text-slate-400 block mt-2 text-lg">
            Configure your AI interview session below.
          </Text>
        </header>

        <Card className="rounded-3xl! shadow-xl dark:shadow-black/40 border-none dark:bg-slate-900 overflow-hidden">
          <Form<SetupFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={DEFAULTS}
            onFinish={onSubmit}
            className="p-2"
          >
            {/* 1. Resume Upload Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4 ml-1">
                <FilePdfOutlined className="text-white!" />
                <span className={labelText}>Resume</span>
              </div>
              <Upload.Dragger
                accept=".pdf"
                multiple={false}
                fileList={resumeFileList}
                beforeUpload={() => false}
                onChange={(info) => setResumeFileList(info.fileList.slice(-1))}
                onRemove={() => setResumeFileList([])}
                className="bg-slate-50! dark:bg-slate-800/30!  dark:border-slate-700! hover:border-indigo-400! transition-all rounded-2xl!"
              >
                <p className="ant-upload-drag-icon mb-2!">
                  <InboxOutlined className="text-indigo-500" />
                </p>
                <p className="ant-upload-text dark:text-slate-300! font-semibold">
                  Drop your resume here in pdf format
                </p>
                <p className="ant-upload-hint dark:text-slate-500! text-xs">
                  AI will analyze this file to generate tailored questions.
                </p>
              </Upload.Dragger>
            </div>

            <Divider className="border-slate-100! dark:border-slate-800!" />

            {/* 2. Job Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <Form.Item
                name="job_role"
                label={<span className={labelText}>Target Job Role</span>}
                className="md:col-span-8"
                rules={[{ required: true, message: "Please enter a job role" }]}
              >
                <Input
                  placeholder="e.g. Senior MERN Stack Developer"
                  className={inputBase}
                />
              </Form.Item>

              <Form.Item
                name="max_questions"
                label={<span className={labelText}>Question Count</span>}
                className="md:col-span-4"
                rules={[{ required: true, message: "Required" }]}
              >
                <InputNumber
                  min={1}
                  max={30}
                  className={`${inputBase} w-full! flex! items-center!`}
                />
              </Form.Item>
            </div>

            <Form.Item
              name="interview_type"
              label={<span className={labelText}>Session Focus</span>}
              rules={[{ required: true }]}
            >
              <Select
                className="rounded-xl! h-11 text-white! dark:bg-slate-800!"
                popupClassName="dark:bg-slate-800! text-white!"
                options={[
                  { value: "TR", label: "Technical Round (TR)" },
                  { value: "HR", label: "Behavioral / HR Round" },
                  { value: "MR", label: "Managerial Round" },
                  { value: "MIXED", label: "Comprehensive (Mixed)" },
                ]}
              />
            </Form.Item>

            {/* 3. LLM Configuration Section */}
            <div className="flex items-center gap-1 mb-4 ml-1">
              <SettingOutlined className="text-white! mr-2" />
              <span className={labelText}>Engine Configuration</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
              <Form.Item name="llm_mode">
                <Radio.Group
                  className="w-full"
                  onChange={(e) => {
                    if (e.target.value === "project_gemini_key") {
                      form.setFieldsValue({
                        llm_provider: "gemini",
                        api_key: "",
                      });
                    }
                  }}
                >
                  <div className="flex flex-col gap-4 m-6 mb-0">
                    <Radio value="project_gemini_key" className="w-full">
                      <span className="dark:text-slate-300">
                        System Gemini Key
                      </span>
                    </Radio>
                    <Radio value="own_api_key" className="w-full">
                      <span className="dark:text-slate-300">
                        Personal API Key
                      </span>
                    </Radio>
                  </div>
                </Radio.Group>
              </Form.Item>

              <Form.Item shouldUpdate noStyle>
                {() => {
                  const mode = form.getFieldValue("llm_mode");
                  const isBYOK = mode === "own_api_key";

                  if (!isBYOK) return null;

                  return (
                    <div className="m-4 grid grid-cols-1 md:grid-cols-2 gap-4 transition-all duration-300">
                      <Form.Item
                        name="llm_provider"
                        label={<span className={labelText}>AI Provider</span>}
                        rules={[{ required: true }]}
                      >
                        <Select
                          className="h-11 bg-slate-600 rounded-xl border-slate-200"
                          popupClassName="dark:bg-slate-800! text-white!"
                          options={[
                            { value: "gemini", label: "Google Gemini" },
                            { value: "openai", label: "OpenAI GPT" },
                            { value: "anthropic", label: "Anthropic Claude" },
                          ]}
                        />
                      </Form.Item>

                      <Form.Item
                        name="api_key"
                        label={
                          <span className={labelText}>Provider API Key</span>
                        }
                        rules={[{ required: true, message: "Key required" }]}
                      >
                        <Input.Password
                          placeholder="Enter key..."
                          className={`${inputBase}`}
                        />
                      </Form.Item>
                    </div>
                  );
                }}
              </Form.Item>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mt-10">
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                icon={<RocketOutlined />}
                className="h-14 rounded-2xl! flex-2 bg-indigo-600! border-none! font-black! text-lg! shadow-xl shadow-indigo-500/20 active:scale-[0.98] transition-all"
              >
                Launch Interview
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default InterviewSetup;
