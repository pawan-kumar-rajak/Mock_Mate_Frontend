import React, { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
	Environment,
	OrbitControls,
} from "@react-three/drei";
import { Lipsync } from "wawa-lipsync";
import { Avatar } from "./Avatar";
import {
	createVisemeTrackFromTranscript,
	createVisemeTrackFromWordBoundaries,
	type WordBoundaryLike,
	type VisemeCue,
	type VisemeName,
} from "../utils/lipsync";
import { synthesizeSarvamSpeech } from "../services/sarvamTts";
import SpeechRecognition, {
	useSpeechRecognition,
} from "react-speech-recognition";
interface Pause {
	duration: number;
	timestamp: number;
}

interface Analytics {
	fillerWords: Record<string, number>;
	pauses: Pause[];
	responseTime: string | null;
	wordCount: number;
}

const FILLER_WORDS = [
	"um",
	"uh",
	"ah",
	"er",
	"like",
	"you know",
	"actually",
	"basically",
	"well",
	"so",
];

const LIP_SYNC_TEST_TEXT =
	"Peter bought five thin socks and chewy noodles around noon.";
const HUNDRED_NS_TO_SECONDS = 1e7;

const TTS_STT_Test: React.FC = () => {
	const [text, setText] = useState<string>(
		"Tell me about your experience with React development.",
	);
	const [isSpeaking, setIsSpeaking] =
		useState<boolean>(false);
	const [audioUrl, setAudioUrl] = useState<string | null>(
		null,
	);
	const [ttsBoundaries, setTtsBoundaries] = useState<
		WordBoundaryLike[]
	>([]);
	const [activeViseme, setActiveViseme] =
		useState<VisemeName>("viseme_sil");
	const [audioSourceLabel, setAudioSourceLabel] = useState<
		string | null
	>(null);

	const [analytics, setAnalytics] = useState<Analytics>({
		fillerWords: {},
		pauses: [],
		responseTime: null,
		wordCount: 0,
	});
	const [sttError, setSttError] = useState<string | null>(
		null,
	);

	const lastSpeechTimeRef = useRef<number>(Date.now());
	const responseStartTimeRef = useRef<number | null>(null);
	const speechStartTimeRef = useRef<number | null>(null);
	const processedFinalTranscriptRef = useRef<string>("");
	const isBrowserSpeechRef = useRef(false);
	const audioElementRef = useRef<HTMLAudioElement | null>(
		null,
	);
	const audioObjectUrlRef = useRef<string | null>(null);
	const wawaLipsyncRef = useRef<Lipsync | null>(null);
	const wawaLipSyncRafRef = useRef<number | null>(null);
	const isWawaDrivenRef = useRef(false);

	const lipSyncTrackRef = useRef<VisemeCue[]>([]);
	const lipSyncRafRef = useRef<number | null>(null);
	const cueIndexRef = useRef(0);
	const lastVisemeRef = useRef<VisemeName>("viseme_sil");
	const ttsBoundaryBufferRef = useRef<WordBoundaryLike[]>(
		[],
	);

	const {
		transcript,
		finalTranscript,
		interimTranscript,
		listening,
		isMicrophoneAvailable,
		resetTranscript,
		browserSupportsSpeechRecognition,
		browserSupportsContinuousListening,
	} = useSpeechRecognition();
	const stopLipSyncLoop = () => {
		if (lipSyncRafRef.current !== null) {
			cancelAnimationFrame(lipSyncRafRef.current);
			lipSyncRafRef.current = null;
		}
	};

	const stopWawaLipSyncLoop = () => {
		if (wawaLipSyncRafRef.current !== null) {
			cancelAnimationFrame(wawaLipSyncRafRef.current);
			wawaLipSyncRafRef.current = null;
		}
	};

	const revokeAudioObjectUrl = () => {
		if (!audioObjectUrlRef.current) return;
		URL.revokeObjectURL(audioObjectUrlRef.current);
		audioObjectUrlRef.current = null;
	};

	const resetLipSyncState = () => {
		stopLipSyncLoop();
		stopWawaLipSyncLoop();
		isWawaDrivenRef.current = false;
		cueIndexRef.current = 0;
		lastVisemeRef.current = "viseme_sil";
		setActiveViseme("viseme_sil");
	};

	const normalizeBoundaries = (
		boundaries: WordBoundaryLike[],
		defaultDurationSeconds = 0.2,
	): WordBoundaryLike[] => {
		const defaultDuration = Math.round(
			defaultDurationSeconds * HUNDRED_NS_TO_SECONDS,
		);
		return boundaries.map((boundary, index) => {
			if (boundary.duration > 0) return boundary;
			const next = boundaries[index + 1];
			if (next) {
				return {
					...boundary,
					duration: Math.max(
						next.offset - boundary.offset,
						defaultDuration,
					),
				};
			}
			return {
				...boundary,
				duration: defaultDuration,
			};
		});
	};

	const extractWordAtCharIndex = (
		fullText: string,
		charIndex: number,
	): string => {
		const safeIndex = Math.max(
			0,
			Math.min(charIndex, fullText.length),
		);
		const tail = fullText.slice(safeIndex);
		const match = tail.match(/^[\s"'([{<]*([A-Za-z']+)/);
		return match?.[1] ?? "";
	};

	const choosePreferredVoice = (
		voices: SpeechSynthesisVoice[],
	): SpeechSynthesisVoice | null => {
		if (!voices.length) return null;
		const priorities = [
			(v: SpeechSynthesisVoice) =>
				v.lang.toLowerCase().startsWith("en-in") &&
				v.name.toLowerCase().includes("female"),
			(v: SpeechSynthesisVoice) =>
				v.lang.toLowerCase().startsWith("en-in"),
			(v: SpeechSynthesisVoice) =>
				v.lang.toLowerCase().startsWith("en-us"),
			(v: SpeechSynthesisVoice) =>
				v.lang.toLowerCase().startsWith("en"),
		];
		for (const matches of priorities) {
			const found = voices.find(matches);
			if (found) return found;
		}
		return voices[0] ?? null;
	};

	const waitForVoices = async (): Promise<
		SpeechSynthesisVoice[]
	> => {
		const synth = window.speechSynthesis;
		const immediate = synth.getVoices();
		if (immediate.length > 0) return immediate;

		return new Promise((resolve) => {
			const timeoutId = window.setTimeout(() => {
				synth.onvoiceschanged = null;
				resolve(synth.getVoices());
			}, 1200);
			synth.onvoiceschanged = () => {
				window.clearTimeout(timeoutId);
				synth.onvoiceschanged = null;
				resolve(synth.getVoices());
			};
		});
	};

	const stopCurrentAudio = () => {
		window.speechSynthesis?.cancel();
		isBrowserSpeechRef.current = false;
		speechStartTimeRef.current = null;
		isWawaDrivenRef.current = false;
		stopWawaLipSyncLoop();
		const audio = audioElementRef.current;
		if (audio) {
			audio.pause();
			audio.removeAttribute("src");
			audio.load();
		}
		revokeAudioObjectUrl();
		ttsBoundaryBufferRef.current = [];
		setTtsBoundaries([]);
		setAudioUrl(null);
		setAudioSourceLabel(null);
		resetLipSyncState();
		setIsSpeaking(false);
	};

	const driveLipSyncFromWawa = () => {
		if (!isWawaDrivenRef.current) return;
		const manager = wawaLipsyncRef.current;
		if (!manager) return;
		manager.processAudio();
		const nextViseme = manager.viseme as VisemeName;
		if (nextViseme !== lastVisemeRef.current) {
			lastVisemeRef.current = nextViseme;
			setActiveViseme(nextViseme);
		}
		wawaLipSyncRafRef.current = requestAnimationFrame(
			driveLipSyncFromWawa,
		);
	};

	const driveLipSyncFromClock = () => {
		if (
			!isBrowserSpeechRef.current ||
			speechStartTimeRef.current === null
		) {
			return;
		}
		const elapsed =
			(performance.now() - speechStartTimeRef.current) /
			1000;
		const cues = lipSyncTrackRef.current;
		let cueIndex = cueIndexRef.current;
		while (
			cueIndex < cues.length - 1 &&
			elapsed > cues[cueIndex].end
		) {
			cueIndex += 1;
		}
		cueIndexRef.current = cueIndex;

		const currentCue = cues[cueIndex];
		const nextViseme: VisemeName =
			currentCue &&
			elapsed >= currentCue.start &&
			elapsed <= currentCue.end
				? currentCue.viseme
				: "viseme_sil";
		if (nextViseme !== lastVisemeRef.current) {
			lastVisemeRef.current = nextViseme;
			setActiveViseme(nextViseme);
		}
		lipSyncRafRef.current = requestAnimationFrame(
			driveLipSyncFromClock,
		);
	};

	const speakWithSarvamTTS = async (
		inputText: string,
	): Promise<boolean> => {
		if (!inputText.trim()) return false;
		stopCurrentAudio();

		try {
			const audioBlob = await synthesizeSarvamSpeech({
				text: inputText,
				targetLanguageCode: "en-IN",
				speaker: "anushka",
				model: "bulbul:v2",
			});

			ttsBoundaryBufferRef.current = [];
			setTtsBoundaries([]);
			const estimatedDuration = Math.max(
				inputText.split(/\s+/).filter(Boolean).length *
					0.38,
				1.0,
			);
			lipSyncTrackRef.current =
				createVisemeTrackFromTranscript(
					inputText,
					estimatedDuration,
				);
			cueIndexRef.current = 0;

			const audio = audioElementRef.current;
			const manager = wawaLipsyncRef.current;
			if (!audio || !manager) {
				throw new Error(
					"Audio or lipsync manager unavailable",
				);
			}

			revokeAudioObjectUrl();
			const objectUrl = URL.createObjectURL(audioBlob);
			audioObjectUrlRef.current = objectUrl;
			audio.src = objectUrl;
			audio.preload = "auto";
			audio.currentTime = 0;

			manager.connectAudio(audio);
			setAudioUrl(objectUrl);
			setAudioSourceLabel("sarvam-tts");
			setIsSpeaking(true);

			isWawaDrivenRef.current = true;
			stopWawaLipSyncLoop();
			wawaLipSyncRafRef.current = requestAnimationFrame(
				driveLipSyncFromWawa,
			);
			await audio.play();
			return true;
		} catch (error) {
			console.error(
				"Sarvam TTS / wawa-lipsync failed:",
				error,
			);
			stopCurrentAudio();
			return false;
		}
	};

	const speakText = async (inputText: string) => {
		const usedSarvam = await speakWithSarvamTTS(inputText);
		if (usedSarvam) return;
		await speakWithBrowserTTS(inputText);
	};

	const speakWithBrowserTTS = async (inputText: string) => {
		if (
			!("speechSynthesis" in window) ||
			typeof SpeechSynthesisUtterance === "undefined"
		) {
			alert(
				"Text-to-speech is not supported in this browser.",
			);
			return;
		}
		stopCurrentAudio();
		window.speechSynthesis.cancel();

		const voices = await waitForVoices();
		const chosenVoice = choosePreferredVoice(voices);

		const utterance = new SpeechSynthesisUtterance(
			inputText,
		);
		if (chosenVoice) {
			utterance.voice = chosenVoice;
			utterance.lang = chosenVoice.lang;
		} else {
			utterance.lang = "en-US";
		}
		utterance.rate = 0.95;
		utterance.pitch = 1;
		utterance.volume = 1;

		const words = inputText
			.split(/\s+/)
			.filter(Boolean).length;
		const estimatedDuration =
			Math.max(words * 0.4, 1.0) / utterance.rate;
		lipSyncTrackRef.current =
			createVisemeTrackFromTranscript(
				inputText,
				estimatedDuration,
			);
		cueIndexRef.current = 0;
		ttsBoundaryBufferRef.current = [];
		setTtsBoundaries([]);
		setAudioUrl(null);
		setAudioSourceLabel(null);
		setIsSpeaking(true);

		let hasStarted = false;
		const startGuard = window.setTimeout(() => {
			if (!hasStarted) {
				window.speechSynthesis.cancel();
				setIsSpeaking(false);
				alert(
					"Voice output failed to start. Check browser audio permissions/device.",
				);
			}
		}, 2500);

		utterance.onstart = () => {
			hasStarted = true;
			window.clearTimeout(startGuard);
			isBrowserSpeechRef.current = true;
			speechStartTimeRef.current = performance.now();
			setAudioUrl("speech-synthesis://active");
			setAudioSourceLabel("browser-speech");
			lipSyncRafRef.current = requestAnimationFrame(
				driveLipSyncFromClock,
			);
		};

		utterance.onboundary = (
			event: SpeechSynthesisEvent,
		) => {
			if (event.name && event.name !== "word") return;
			const word = extractWordAtCharIndex(
				inputText,
				event.charIndex,
			);
			if (!word) return;

			const offset = Math.max(
				0,
				Math.round(
					event.elapsedTime * HUNDRED_NS_TO_SECONDS,
				),
			);
			const buffer = ttsBoundaryBufferRef.current;
			if (buffer.length > 0) {
				const previous = buffer[buffer.length - 1];
				if (previous.duration === 0) {
					previous.duration = Math.max(
						offset - previous.offset,
						Math.round(0.06 * HUNDRED_NS_TO_SECONDS),
					);
				}
			}
			buffer.push({ offset, duration: 0, text: word });

			const normalized = normalizeBoundaries(buffer);
			setTtsBoundaries(normalized);
			lipSyncTrackRef.current =
				createVisemeTrackFromWordBoundaries(normalized);
		};

		utterance.onend = () => {
			window.clearTimeout(startGuard);
			isBrowserSpeechRef.current = false;
			speechStartTimeRef.current = null;
			const normalized = normalizeBoundaries(
				ttsBoundaryBufferRef.current,
			);
			if (normalized.length > 0) {
				setTtsBoundaries(normalized);
			}
			setAudioUrl(null);
			setAudioSourceLabel(null);
			resetLipSyncState();
			setIsSpeaking(false);
		};

		utterance.onerror = (event) => {
			window.clearTimeout(startGuard);
			console.error("Browser TTS error:", event.error);
			isBrowserSpeechRef.current = false;
			speechStartTimeRef.current = null;
			setAudioUrl(null);
			setAudioSourceLabel(null);
			resetLipSyncState();
			setIsSpeaking(false);
		};

		window.speechSynthesis.speak(utterance);
		window.speechSynthesis.resume();
	};

	useEffect(() => {
		const audio = new Audio();
		audio.preload = "auto";
		audioElementRef.current = audio;
		wawaLipsyncRef.current = new Lipsync();
		const recognition = SpeechRecognition.getRecognition();

		const handleRecognitionError = (event: Event) => {
			const sttEvent = event as Event & {
				error?: string;
				message?: string;
			};
			const label =
				sttEvent.error ??
				sttEvent.message ??
				"speech-recognition-error";
			setSttError(label);
		};
		const handleRecognitionStart = () => {
			setSttError(null);
		};
		if (recognition?.addEventListener) {
			recognition.addEventListener(
				"error",
				handleRecognitionError as EventListener,
			);
			recognition.addEventListener(
				"start",
				handleRecognitionStart,
			);
		}

		audio.onended = () => {
			isWawaDrivenRef.current = false;
			stopWawaLipSyncLoop();
			revokeAudioObjectUrl();
			setAudioUrl(null);
			setAudioSourceLabel(null);
			resetLipSyncState();
			setIsSpeaking(false);
		};

		audio.onerror = () => {
			isWawaDrivenRef.current = false;
			stopWawaLipSyncLoop();
			revokeAudioObjectUrl();
			setAudioUrl(null);
			setAudioSourceLabel(null);
			resetLipSyncState();
			setIsSpeaking(false);
		};

		return () => {
			stopLipSyncLoop();
			stopWawaLipSyncLoop();
			isWawaDrivenRef.current = false;
			if (window.speechSynthesis)
				window.speechSynthesis.cancel();
			void SpeechRecognition.stopListening();
			if (recognition?.removeEventListener) {
				recognition.removeEventListener(
					"error",
					handleRecognitionError as EventListener,
				);
				recognition.removeEventListener(
					"start",
					handleRecognitionStart,
				);
			}
			const currentAudio = audioElementRef.current;
			if (currentAudio) {
				currentAudio.pause();
				currentAudio.removeAttribute("src");
				currentAudio.load();
				currentAudio.onended = null;
				currentAudio.onerror = null;
			}
			audioElementRef.current = null;
			revokeAudioObjectUrl();
		};
	}, []);

	const analyzeFillerWords = (textSegment: string) => {
		const words = textSegment.toLowerCase().split(/\s+/);
		setAnalytics((prev) => {
			const newFillers = { ...prev.fillerWords };
			words.forEach((word) => {
				const clean = word.replace(/[.,!?;:]/g, "");
				if (FILLER_WORDS.includes(clean)) {
					newFillers[clean] = (newFillers[clean] || 0) + 1;
				}
			});
			return { ...prev, fillerWords: newFillers };
		});
	};

	useEffect(() => {
		if (!finalTranscript) {
			processedFinalTranscriptRef.current = "";
			return;
		}
		const previous = processedFinalTranscriptRef.current;
		if (finalTranscript.length <= previous.length) {
			processedFinalTranscriptRef.current = finalTranscript;
			return;
		}

		const newSegment = finalTranscript
			.slice(previous.length)
			.trim();
		processedFinalTranscriptRef.current = finalTranscript;
		if (!newSegment) return;

		analyzeFillerWords(newSegment);
		const now = Date.now();
		const gap = now - lastSpeechTimeRef.current;
		if (gap > 1500) {
			setAnalytics((prev) => ({
				...prev,
				pauses: [
					...prev.pauses,
					{ duration: gap, timestamp: now },
				],
			}));
		}
		lastSpeechTimeRef.current = now;
	}, [finalTranscript]);

	useEffect(() => {
		const totalWords = transcript
			.trim()
			.split(/\s+/)
			.filter((word: string) => word !== "").length;
		setAnalytics((prev) => ({
			...prev,
			wordCount: totalWords,
		}));
	}, [transcript]);

	useEffect(() => {
		if (listening || responseStartTimeRef.current === null)
			return;
		const time = (
			(Date.now() - responseStartTimeRef.current) /
			1000
		).toFixed(1);
		setAnalytics((prev) => ({
			...prev,
			responseTime: time,
		}));
		responseStartTimeRef.current = null;
	}, [listening]);

	const startListening = async () => {
		if (!browserSupportsSpeechRecognition) {
			alert(
				"Speech recognition not supported in this browser.",
			);
			return;
		}
		if (!navigator.onLine) {
			alert(
				"Speech recognition is offline. Please check internet connection.",
			);
			return;
		}
		resetTranscript();
		processedFinalTranscriptRef.current = "";
		setSttError(null);
		setAnalytics({
			fillerWords: {},
			pauses: [],
			responseTime: null,
			wordCount: 0,
		});
		responseStartTimeRef.current = Date.now();
		lastSpeechTimeRef.current = Date.now();
		const preferredLanguage =
			(navigator.language || "").trim() || "en-US";

		try {
			await SpeechRecognition.startListening({
				continuous:
					browserSupportsContinuousListening,
				language: preferredLanguage,
			});
		} catch (error) {
			console.error("SR Error:", error);
			setSttError("microphone-start-failed");
			alert(
				"Microphone access failed. Please check browser permissions.",
			);
		}
	};
	// console.log("transcript=", transcript);
	const stopListening = async () => {
		await SpeechRecognition.stopListening();
	};

	const totalFillers = Object.values(
		analytics.fillerWords,
	).reduce((sum, count) => sum + count, 0);

	return (
		<div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-500">
			<div className="max-w-6xl mx-auto">
				<header className="mb-10">
					<h1 className="text-4xl font-extrabold text-slate-900 dark:text-white">
						AI Interview Proctor
					</h1>
					<p className="text-slate-600 dark:text-slate-400 mt-2">
						TTS/STT Bench with 3D Avatar Lip Sync
					</p>
				</header>

				<section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-8">
					<h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-slate-100">
						Avatar Lip Sync Preview
					</h2>
					<div className="w-full h-[420px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
						<Canvas
							camera={{
								position: [0, 0.35, 1.4],
								fov: 28,
							}}
						>
							<ambientLight intensity={0.8} />
							<directionalLight
								position={[2, 3, 3]}
								intensity={1.2}
							/>
							<React.Suspense fallback={null}>
								<Avatar
									position={[0, -1.45, 0]}
									activeViseme={activeViseme}
									visemeStrength={0.6}
									smoothing={0.65}
									isSpeaking={isSpeaking}
								/>
								<Environment preset="city" />
							</React.Suspense>
							<OrbitControls
								enablePan={false}
								minDistance={1.1}
								maxDistance={1.9}
							/>
						</Canvas>
					</div>
					<div className="mt-3 text-sm text-slate-600 dark:text-slate-400 flex gap-6">
						<span>Active viseme: {activeViseme}</span>
						<span>
							Word boundaries: {ttsBoundaries.length}
						</span>
					</div>
					{audioUrl && (
						<div className="mt-3 text-sm text-slate-500 dark:text-slate-400 break-all">
							Audio source:{" "}
							{audioSourceLabel === "sarvam-tts"
								? "Sarvam TTS + wawa-lipsync"
								: "browser speech synthesis (fallback)"}
						</div>
					)}
				</section>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
						<h2 className="text-xl font-bold mb-4 text-blue-700">
							1. Interviewer (TTS)
						</h2>
						<textarea
							className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-slate-100"
							rows={5}
							value={text}
							onChange={(e) => setText(e.target.value)}
						/>
						<div className="flex gap-3 mt-4">
							<button
								onClick={() => void speakText(text)}
								disabled={isSpeaking}
								className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
							>
								{isSpeaking
									? "Speaking + Lip Sync..."
									: "Play Voice"}
							</button>
							<button
								onClick={() => void speakText(text)}
								disabled={isSpeaking}
								className="bg-slate-700 text-white font-semibold px-4 py-3 rounded-xl hover:bg-slate-800 disabled:bg-gray-300 transition-colors"
								title={LIP_SYNC_TEST_TEXT}
							>
								Test Lip Sync
							</button>
						</div>
					</section>

					<section className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
						<h2 className="text-xl font-bold mb-4 text-purple-700">
							2. Candidate (STT)
						</h2>
						<button
							onClick={
								listening ? stopListening : startListening
							}
							disabled={!browserSupportsSpeechRecognition}
							className={`w-full py-4 rounded-xl font-bold text-lg mb-4 transition-all ${
								listening
									? "bg-red-100 text-red-600 border-2 border-red-600 animate-pulse"
									: "bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-600"
							}`}
						>
							{listening
								? "Stop Recording"
								: "Start Responding"}
						</button>
						<div className="p-4 bg-gray-900 text-gray-100 rounded-xl min-h-40 leading-relaxed shadow-inner">
							<span className="opacity-100">
								{finalTranscript}
							</span>
							<span className="opacity-50 text-blue-300">
								{interimTranscript}
							</span>
							{!finalTranscript && !interimTranscript && (
								<span className="text-gray-500 italic">
									Waiting for speech...
								</span>
							)}
						</div>
						{!browserSupportsSpeechRecognition && (
							<p className="mt-3 text-sm text-red-600">
								This browser does not support speech
								recognition.
							</p>
						)}
						{browserSupportsSpeechRecognition &&
							!isMicrophoneAvailable && (
								<p className="mt-3 text-sm text-red-600">
									Microphone permission denied.
									Enable mic access for this site.
								</p>
							)}
						{sttError && (
							<p className="mt-2 text-xs text-amber-700">
								STT error: {sttError}
							</p>
						)}
						{browserSupportsSpeechRecognition &&
							!browserSupportsContinuousListening && (
								<p className="mt-2 text-xs text-slate-500">
									Continuous listening is limited on
									this browser. Recording may stop after
									each phrase.
								</p>
							)}
					</section>
				</div>

				{analytics.wordCount > 0 && (
					<section className="mt-8 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
						<h3 className="text-2xl font-bold text-gray-800 dark:text-slate-100 mb-6">
							Speech Insights
						</h3>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
							<MetricItem
								label="Word Count"
								value={analytics.wordCount}
								sub="words"
								color="text-blue-600"
							/>
							<MetricItem
								label="Filler Usage"
								value={totalFillers}
								sub="fillers"
								color="text-orange-500"
							/>
							<MetricItem
								label="Total Pauses"
								value={analytics.pauses.length}
								sub="> 1.5s"
								color="text-purple-600"
							/>
							<MetricItem
								label="Session Time"
								value={analytics.responseTime || 0}
								sub="seconds"
								color="text-green-600"
							/>
						</div>

						{Object.keys(analytics.fillerWords).length >
							0 && (
							<div className="mt-8 pt-6 border-t border-gray-100">
								<p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
									Frequency breakdown
								</p>
								<div className="flex flex-wrap gap-3">
									{Object.entries(
										analytics.fillerWords,
									).map(([word, count]) => (
										<div
											key={word}
											className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-lg"
										>
											<span className="font-medium text-orange-800">
												{word}
											</span>
											<span className="ml-2 bg-orange-200 text-orange-900 px-2 py-0.5 rounded text-xs font-bold">
												{count}
											</span>
										</div>
									))}
								</div>
							</div>
						)}
					</section>
				)}
			</div>
		</div>
	);
};

const MetricItem = ({
	label,
	value,
	sub,
	color,
}: {
	label: string;
	value: number | string;
	sub: string;
	color: string;
}) => (
	<div className="flex flex-col">
		<span className="text-gray-500 text-sm font-medium">
			{label}
		</span>
		<div className="flex items-baseline gap-1">
			<span className={`text-3xl font-black ${color}`}>
				{value}
			</span>
			<span className="text-gray-400 text-xs">{sub}</span>
		</div>
	</div>
);

export default TTS_STT_Test;
