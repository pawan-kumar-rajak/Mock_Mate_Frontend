import { useEffect, useRef } from "react";
import createLogger from "../utils/logger";

const logger = createLogger("useGdTranscription");

type TranscriptHandler = (text: string) => void;

type SpeechRecognitionCtor = new () => SpeechRecognition;

const getSpeechRecognition =
	(): SpeechRecognitionCtor | null => {
		const anyWindow = window as typeof window & {
			SpeechRecognition?: SpeechRecognitionCtor;
			webkitSpeechRecognition?: SpeechRecognitionCtor;
		};
		return (
			anyWindow.SpeechRecognition ||
			anyWindow.webkitSpeechRecognition ||
			null
		);
	};

export function useGdTranscription(params: {
	enabled: boolean;
	onTranscript: TranscriptHandler;
	onStatusChange?: (status: {
		supported: boolean;
		active: boolean;
		error?: string | null;
	}) => void;
}) {
	const { enabled, onTranscript, onStatusChange } = params;
	const recognitionRef = useRef<SpeechRecognition | null>(
		null,
	);
	const restartingRef = useRef(false);
	const enabledRef = useRef(enabled);
	const lastTranscriptRef = useRef("");
	const lastTranscriptAtRef = useRef(0);
	const canRestartRef = useRef(true);
	const stoppingRef = useRef(false);
	const lastErrorRef = useRef<string | null>(null);
	const restartTimerRef = useRef<number | null>(null);
	const networkRetryCountRef = useRef(0);

	useEffect(() => {
		enabledRef.current = enabled;
	}, [enabled]);

	useEffect(() => {
		const Recognition = getSpeechRecognition();
		if (!Recognition) {
			logger.warn("SpeechRecognition not available");
			onStatusChange?.({
				supported: false,
				active: false,
				error: "unsupported_browser",
			});
			return;
		}

		if (!enabled) {
			logger.warn("Transcription disabled");
			onStatusChange?.({
				supported: true,
				active: false,
				error: null,
			});
			return;
		}

		logger.info("Initializing GD Transcription");
		onStatusChange?.({
			supported: true,
			active: false,
			error: null,
		});
		const recognition = new Recognition();
		recognitionRef.current = recognition;
		recognition.continuous = true;
		recognition.interimResults = false;
		recognition.lang = navigator.language || "en-US";
		recognition.maxAlternatives = 1;
		canRestartRef.current = true;
		stoppingRef.current = false;
		lastErrorRef.current = null;
		networkRetryCountRef.current = 0;

		recognition.onresult = (event) => {
			let finalText = "";
			for (
				let i = event.resultIndex;
				i < event.results.length;
				i += 1
			) {
				const result = event.results[i];
				if (result.isFinal) {
					finalText += result[0]?.transcript ?? "";
				}
			}
			const trimmed = finalText.trim();
			if (trimmed) {
				const now = Date.now();
				const isDuplicate =
					lastTranscriptRef.current === trimmed &&
					now - lastTranscriptAtRef.current < 1500;
				if (isDuplicate) {
					logger.debug(
						"Skipping duplicate transcript chunk",
						{
							text: trimmed,
						},
					);
					return;
				}
				lastTranscriptRef.current = trimmed;
				lastTranscriptAtRef.current = now;
				logger.debug("Transcript received", {
					text: trimmed,
					length: trimmed.length,
				});
				onTranscript(trimmed);
			}
		};

		recognition.onerror = (event) => {
			lastErrorRef.current = event.error;
			const isExpectedAbort =
				event.error === "aborted" &&
				(restartingRef.current ||
					stoppingRef.current ||
					!enabledRef.current);
			if (isExpectedAbort) {
				logger.debug(
					"Ignoring expected transcription abort",
					{
						error: event.error,
					},
				);
				return;
			}
			if (event.error === "network") {
				logger.info(
					"Transcription network issue detected; will retry",
				);
			} else {
				logger.warn("Transcription error", {
					error: event.error,
				});
			}
			if (
				event.error === "not-allowed" ||
				event.error === "service-not-allowed" ||
				event.error === "audio-capture"
			) {
				canRestartRef.current = false;
			}
			onStatusChange?.({
				supported: true,
				active: false,
				error: event.error,
			});
		};

		recognition.onend = () => {
			if (stoppingRef.current || !enabledRef.current) {
				logger.debug(
					"Transcription ended after intentional stop",
				);
				return;
			}
			logger.warn("Transcription ended");
			if (!canRestartRef.current) {
				logger.warn(
					"Transcription restart disabled due to previous error",
				);
				onStatusChange?.({
					supported: true,
					active: false,
					error: lastErrorRef.current,
				});
				return;
			}
			if (restartingRef.current) return;
			restartingRef.current = true;
			const restartReason = lastErrorRef.current || "ended";
			const delayMs =
				restartReason === "network"
					? Math.min(
							4000,
							500 *
								2 **
									networkRetryCountRef.current,
					  )
					: 500;
			if (restartReason === "network") {
				networkRetryCountRef.current += 1;
			} else {
				networkRetryCountRef.current = 0;
			}
			logger.info("Restarting transcription", {
				delayMs,
				reason: restartReason,
			});
			restartTimerRef.current = window.setTimeout(() => {
				restartingRef.current = false;
				try {
					if (!enabledRef.current) return;
					lastErrorRef.current = null;
					recognition.start();
					networkRetryCountRef.current = 0;
					onStatusChange?.({
						supported: true,
						active: true,
						error: null,
					});
				} catch (error) {
					logger.error(
						"Failed to restart transcription",
						error,
					);
					onStatusChange?.({
						supported: true,
						active: false,
						error: "restart_failed",
					});
				}
			}, delayMs);
		};

		try {
			logger.info("Starting transcription");
			recognition.start();
			onStatusChange?.({
				supported: true,
				active: true,
				error: null,
			});
		} catch (error) {
			logger.error("Failed to start transcription", error);
			onStatusChange?.({
				supported: true,
				active: false,
				error: "start_failed",
			});
		}

		return () => {
			canRestartRef.current = false;
			stoppingRef.current = true;
			if (restartTimerRef.current !== null) {
				window.clearTimeout(restartTimerRef.current);
				restartTimerRef.current = null;
			}
			try {
				logger.info("Stopping transcription");
				recognition.stop();
			} catch (error) {
				logger.error("Failed to stop transcription", error);
			}
			recognitionRef.current = null;
			onStatusChange?.({
				supported: true,
				active: false,
				error: null,
			});
		};
	}, [enabled, onStatusChange, onTranscript]);
}
