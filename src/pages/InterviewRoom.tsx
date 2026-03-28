import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
	Environment,
	OrbitControls,
} from "@react-three/drei";
import {
	Button,
	Card,
	Input,
	message,
	Spin,
	Tag,
	Typography,
	Divider,
	Space,
} from "antd";
import {
	AudioOutlined,
	SendOutlined,
	StopOutlined,
	RobotOutlined,
	UserOutlined,
	CheckCircleOutlined,
} from "@ant-design/icons";
import {
	useLocation,
	useNavigate,
	useParams,
} from "react-router-dom";
import SpeechRecognition, {
	useSpeechRecognition,
} from "react-speech-recognition";
import { Avatar } from "../components/Avatar";
import { synthesizeSarvamSpeech } from "../services/sarvamTts";
import { useInterviewSocket } from "../hooks/useInterviewSocket";
import {
	createVisemeTrackFromTranscript,
	type VisemeCue,
	type VisemeName,
} from "../utils/lipsync";
import {
	finishInterview,
	getInterviewSession,
} from "../services/interviewApi";
import type {
	InterviewEvaluation,
	InterviewQuestion,
	InterviewReport,
	InterviewSessionOut,
	WsEnvelope,
	WsErrorPayload,
} from "../types/interview";

const { Title, Text, Paragraph } = Typography;

// --- Helper Utilities ---
const toWsUrl = (httpBaseUrl: string): string => {
	const trimmed = String(httpBaseUrl || "")
		.trim()
		.replace(/\/$/, "");
	if (!trimmed) return "";
	return trimmed.replace(/^http/, "ws");
};

const nowIso = () => new Date().toISOString();

const asStringArray = (value: unknown): string[] => {
	if (Array.isArray(value))
		return value.map((v) => String(v));
	if (typeof value === "string") return [value];
	return [];
};

function InterviewRoom() {
	const navigate = useNavigate();
	const { sessionId } = useParams<{ sessionId: string }>();
	const location = useLocation();

	const accessToken = useMemo(
		() => String(localStorage.getItem("accessToken") || ""),
		[],
	);

	const [sessionMeta, setSessionMeta] =
		useState<InterviewSessionOut | null>(null);
	const [loadingMeta, setLoadingMeta] = useState(false);

	const navState = (location.state ?? null) as {
		firstQuestion?: InterviewQuestion;
	} | null;
	const [question, setQuestion] =
		useState<InterviewQuestion | null>(
			navState?.firstQuestion ?? null,
		);
	const [evaluation, setEvaluation] =
		useState<InterviewEvaluation | null>(null);
	const [report, setReport] =
		useState<InterviewReport | null>(null);
	const [autoSpeak, setAutoSpeak] = useState(true);
	const [typedAnswer, setTypedAnswer] = useState("");

	// --- Avatar & Audio States ---
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [activeViseme, setActiveViseme] =
		useState<VisemeName>("viseme_sil");

	const audioRef = useRef<HTMLAudioElement | null>(null);
	const audioObjectUrlRef = useRef<string | null>(null);
	const visemeTrackRef = useRef<VisemeCue[]>([]);
	const visemeRafRef = useRef<number | null>(null);
	const cueIndexRef = useRef(0);
	const lastVisemeRef = useRef<VisemeName>("viseme_sil");

	// --- Handlers ---
	const stopVisemeLoop = useCallback(() => {
		if (visemeRafRef.current !== null) {
			cancelAnimationFrame(visemeRafRef.current);
			visemeRafRef.current = null;
		}
	}, []);

	const resetVisemes = useCallback(() => {
		stopVisemeLoop();
		cueIndexRef.current = 0;
		lastVisemeRef.current = "viseme_sil";
		visemeTrackRef.current = [];
		setActiveViseme("viseme_sil");
	}, [stopVisemeLoop]);

	const stopSpeaking = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.currentTime = 0;
		}
		setIsSpeaking(false);
		resetVisemes();
	}, [resetVisemes]);

	const speakQuestion = useCallback(
		async (text: string) => {
			const trimmed = text.trim();
			if (!trimmed) return;
			stopSpeaking();
			setIsSpeaking(true);

			try {
				const blob = await synthesizeSarvamSpeech({
					text: trimmed,
				});
				const url = URL.createObjectURL(blob);
				audioObjectUrlRef.current = url;
				const audio = audioRef.current ?? new Audio();
				audioRef.current = audio;
				audio.src = url;

				audio.onloadedmetadata = () => {
					visemeTrackRef.current =
						createVisemeTrackFromTranscript(
							trimmed,
							audio.duration,
						);
					const loop = () => {
						const t = audio.currentTime;
						while (
							cueIndexRef.current <
								visemeTrackRef.current.length &&
							t >=
								visemeTrackRef.current[cueIndexRef.current]
									.end
						) {
							cueIndexRef.current += 1;
						}
						const cue =
							visemeTrackRef.current[cueIndexRef.current];
						const nextV = cue ? cue.viseme : "viseme_sil";
						if (lastVisemeRef.current !== nextV) {
							lastVisemeRef.current = nextV;
							setActiveViseme(nextV);
						}
						visemeRafRef.current =
							requestAnimationFrame(loop);
					};
					visemeRafRef.current =
						requestAnimationFrame(loop);
				};

				audio.onended = () => {
					setIsSpeaking(false);
					resetVisemes();
				};
				await audio.play();
			} catch (err) {
				setIsSpeaking(false);
				resetVisemes();
				message.error(
					"TTS failed. Please check backend config.",
				);
			}
		},
		[resetVisemes, stopSpeaking],
	);

	const onWsMessage = useCallback(
		(msg: WsEnvelope) => {
			if (msg.type === "question.next") {
				const p = msg.payload ?? {};
				const nextQ = {
					id: String(p.question_id || p.id),
					question_text: String(p.question_text),
					index: Number(p.index || 0),
				};
				setQuestion(nextQ);
				setEvaluation(null);
				setTypedAnswer("");
				if (autoSpeak && nextQ.question_text)
					speakQuestion(nextQ.question_text);
			} else if (msg.type === "answer.evaluation") {
				setEvaluation(msg.payload ?? {});
			} else if (msg.type === "session.complete") {
				setReport(msg.payload ?? {});
			}
		},
		[autoSpeak, speakQuestion],
	);

	const wsUrl = useMemo(
		() =>
			toWsUrl(import.meta.env.VITE_BACKEND_URL) +
			"/interviews/ws",
		[],
	);
	const { isConnected, send } = useInterviewSocket({
		wsUrl,
		sessionId: sessionId!,
		accessToken,
		onMessage: onWsMessage,
	});

	const {
		transcript,
		interimTranscript,
		finalTranscript,
		listening,
		resetTranscript,
		browserSupportsSpeechRecognition,
		isMicrophoneAvailable,
	} = useSpeechRecognition();
	const sttDrivesTypedAnswerRef = useRef(false);

	useEffect(() => {
		if (listening && sttDrivesTypedAnswerRef.current) {
			setTypedAnswer(
				`${finalTranscript} ${interimTranscript}`.trim(),
			);
		}
	}, [finalTranscript, interimTranscript, listening]);

	const startListening = () => {
		if (!browserSupportsSpeechRecognition)
			return message.error("STT not supported.");
		resetTranscript();
		sttDrivesTypedAnswerRef.current = true;
		SpeechRecognition.startListening({
			continuous: true,
			interimResults: true,
		});
	};

	const submitAnswerText = (text: string) => {
		if (!text.trim())
			return message.warning("Answer cannot be empty.");
		send({
			type: "answer.final",
			session_id: sessionId!,
			request_id: `final-${nowIso()}`,
			payload: { transcript_text: text.trim() },
		});
		resetTranscript();
		setTypedAnswer("");
	};
	const strengths = asStringArray(evaluation?.strengths);
	const weaknesses = asStringArray(evaluation?.weaknesses);

	if (loadingMeta)
		return (
			<div className="min-h-screen flex items-center justify-center dark:bg-slate-950">
				<Spin size="large" />
			</div>
		);

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 transition-colors duration-500">
			<div className="max-w-7xl mx-auto">
				{/* Header Section */}
				<header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<Title
							level={2}
							className="m-0! font-black! tracking-tight! dark:text-white!"
						>
							Interview Room
						</Title>
						<div className="flex flex-wrap gap-2 mt-3">
							<Tag
								className="border-none! rounded-full! px-3! font-bold uppercase text-[10px] tracking-widest shadow-sm"
								color={isConnected ? "green" : "red"}
							>
								{isConnected
									? "WS Connected"
									: "Disconnected"}
							</Tag>
							<Tag
								color="blue"
								className="rounded-full! border-none shadow-sm"
							>
								{sessionMeta?.llm_provider}
							</Tag>
							<Tag
								color="purple"
								className="rounded-full! border-none shadow-sm"
							>
								Q {(question?.index ?? 0) + 1} /{" "}
								{sessionMeta?.max_questions}
							</Tag>
						</div>
					</div>

					<Space>
						<Button
							className="rounded-xl! border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
							onClick={() => setAutoSpeak(!autoSpeak)}
						>
							Voice: {autoSpeak ? "Auto" : "Manual"}
						</Button>
						<Button
							danger
							type="primary"
							className="rounded-xl! bg-red-500! hover:bg-red-600! border-none! font-bold"
							onClick={() =>
								send({
									type: "session.finish",
									session_id: sessionId!,
									payload: {},
								})
							}
						>
							Finish Session
						</Button>
					</Space>
				</header>

				{/* Main Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
					{/* Left Column: Avatar & Question */}
					<div className="lg:col-span-5 space-y-6">
						<Card className="rounded-3xl! shadow-xl border border-slate-200! dark:border-slate-800! overflow-hidden bg-white dark:bg-slate-900">
							<div className="p-4 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center">
								<Text className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
									AI Interviewer
								</Text>
								<Space>
									<Button
										size="small"
										type="text"
										icon={<AudioOutlined />}
										onClick={() =>
											speakQuestion(
												question?.question_text || "",
											)
										}
									/>
									<Button
										size="small"
										type="text"
										danger
										icon={<StopOutlined />}
										onClick={stopSpeaking}
									/>
								</Space>
							</div>
							<div className="h-[450px] bg-slate-950 relative">
								<Canvas
									camera={{
										position: [0, 1.4, 2.2],
										fov: 35,
									}}
								>
									<ambientLight intensity={0.6} />
									<pointLight
										position={[10, 10, 10]}
										intensity={1}
									/>
									<Environment preset="studio" />
									<group position={[0, -1.2, 0]}>
										<Avatar
											activeViseme={activeViseme}
											isSpeaking={isSpeaking}
										/>
									</group>
									<OrbitControls
										enableZoom={false}
										enablePan={false}
									/>
								</Canvas>
							</div>
						</Card>

						<Card className="rounded-3xl! shadow-lg border-none bg-indigo-600 dark:bg-indigo-500/90 text-white p-2">
							<div className="p-6">
								<Text className="text-indigo-200 uppercase text-[10px] font-black tracking-[0.2em] block mb-4">
									Interviewer's Question
								</Text>
								<Paragraph className="text-xl font-bold text-white! leading-relaxed m-0">
									{question?.question_text ||
										"Ready for your first question?"}
								</Paragraph>
							</div>
						</Card>
					</div>

					{/* Right Column: User Answer & Feedback */}
					<div className="lg:col-span-7 space-y-6">
						<Card className="rounded-3xl! shadow-xl border border-slate-200! dark:border-slate-800! bg-white dark:bg-slate-900">
							<div className="p-6">
								<div className="flex items-center justify-between mb-6">
									<div className="flex items-center gap-2">
										<div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
											<UserOutlined className="text-indigo-600" />
										</div>
										<Text className="font-bold dark:text-slate-200">
											Your Response
										</Text>
									</div>
									<Space>
										<Button
											icon={<AudioOutlined />}
											onClick={
												listening
													? SpeechRecognition.stopListening
													: startListening
											}
											className={`rounded-full! ${listening ? "bg-red-500! text-white! border-none! animate-pulse" : "dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"}`}
										>
											{listening
												? "Recording..."
												: "Voice Input"}
										</Button>
										<Button
											type="primary"
											icon={<SendOutlined />}
											onClick={() =>
												submitAnswerText(typedAnswer)
											}
											className="rounded-full! bg-indigo-600! border-none! px-6 font-bold"
										>
											Submit
										</Button>
									</Space>
								</div>

								{/* STT Viewport */}
								<div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-6 min-h-[140px] mb-4 border border-slate-200 dark:border-slate-800 font-mono">
									<Text
										className={`${finalTranscript ? "text-slate-800 dark:text-slate-100" : "text-slate-500 italic"} text-base`}
									>
										{finalTranscript ||
											(listening
												? ""
												: "Microphone idle...")}
									</Text>
									<Text className="text-indigo-400 opacity-60 ml-1 italic">
										{interimTranscript}
									</Text>
								</div>

								<Input.TextArea
									value={typedAnswer}
									onChange={(e) => {
										sttDrivesTypedAnswerRef.current = false;
										setTypedAnswer(e.target.value);
									}}
									placeholder="Click 'Voice Input' to speak or type your answer here..."
									className="rounded-2xl! bg-slate-50! dark:bg-slate-800/50! border-none! p-4! text-base! dark:text-slate-200!"
									autoSize={{ minRows: 4, maxRows: 8 }}
								/>
							</div>
						</Card>

						{evaluation && (
							<Card className="rounded-3xl! shadow-lg border border-slate-200! dark:border-slate-800! bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-4 duration-500">
								<div className="p-6">
									<div className="flex justify-between items-center mb-6">
										<Title
											level={4}
											className="m-0! dark:text-slate-200! flex items-center gap-2"
										>
											<RobotOutlined className="text-indigo-500" />{" "}
											AI Evaluation
										</Title>
										<Tag
											color="indigo"
											className="rounded-full! px-4! py-1! border-none! font-bold"
										>
											SCORE: {evaluation.score}
										</Tag>
									</div>

									<Paragraph className="text-slate-600 dark:text-slate-400 text-lg italic mb-6">
										"{evaluation.feedback}"
									</Paragraph>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-2xl">
											<Text className="text-green-600 uppercase text-[10px] font-black tracking-widest block mb-2">
												Strengths
											</Text>
											<ul className="list-none p-0 m-0 space-y-1">
												{strengths.map((s, i) => (
													<li
														key={i}
														className="text-green-800 dark:text-green-400 text-sm flex gap-2"
													>
														<CheckCircleOutlined className="mt-1" />{" "}
														{s}
													</li>
												))}
											</ul>
										</div>
										<div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl">
											<Text className="text-red-600 uppercase text-[10px] font-black tracking-widest block mb-2">
												Weaknesses
											</Text>
											<ul className="list-none p-0 m-0 space-y-1 text-sm text-red-800 dark:text-red-400">
												{weaknesses.map((w, i) => (
													<li key={i}>• {w}</li>
												))}
											</ul>
										</div>
									</div>
								</div>
							</Card>
						)}
					</div>
				</div>

				<audio ref={audioRef} className="hidden" />
			</div>
		</div>
	);
}

export default InterviewRoom;
