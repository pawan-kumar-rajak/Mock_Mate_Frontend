import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	IceCandidateMessage,
	SignalMessage,
} from "../types/gd";
import createLogger from "../utils/logger";

const logger = createLogger("useGdWebRtc");

type PeerConnectionMap = Record<string, RTCPeerConnection>;
type StreamMap = Record<string, MediaStream>;

const defaultIceServers: RTCIceServer[] = [
	{ urls: "stun:stun.l.google.com:19302" },
];

const parseIceServers = (): RTCIceServer[] => {
	const raw = String(
		import.meta.env.VITE_GD_ICE_SERVERS || "",
	).trim();
	if (!raw) return defaultIceServers;
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed))
			return parsed as RTCIceServer[];
	} catch {
		// ignore
	}
	return defaultIceServers;
};

export function useGdWebRtc(params: {
	send: (
		payload:
			| SignalMessage
			| IceCandidateMessage
			| Record<string, unknown>,
	) => void;
}) {
	const { send } = params;
	const iceServers = useMemo(parseIceServers, []);

	const pcsRef = useRef<PeerConnectionMap>({});
	const localStreamRef = useRef<MediaStream | null>(null);

	const [localStream, setLocalStream] =
		useState<MediaStream | null>(null);
	const [remoteStreams, setRemoteStreams] =
		useState<StreamMap>({});
	const [isAudioEnabled, setIsAudioEnabled] =
		useState(true);
	const [isVideoEnabled, setIsVideoEnabled] =
		useState(true);

	const attachLocalTracks = useCallback(
		(pc: RTCPeerConnection) => {
			const stream = localStreamRef.current;
			if (!stream) return;
			stream.getTracks().forEach((track) => {
				pc.addTrack(track, stream);
			});
		},
		[],
	);

	const createPeerConnection = useCallback(
		(peerId: string) => {
			if (pcsRef.current[peerId]) {
				logger.debug("Peer connection already exists", {
					peerId,
				});
				return pcsRef.current[peerId];
			}

			logger.info("Creating peer connection", {
				peerId,
				iceServersCount: iceServers.length,
			});
			const pc = new RTCPeerConnection({ iceServers });
			pcsRef.current[peerId] = pc;

			attachLocalTracks(pc);

			pc.onicecandidate = (event) => {
				if (!event.candidate) {
					logger.debug(
						"ICE candidate gathering completed",
						{ peerId },
					);
					return;
				}
				logger.debug("ICE candidate generated", { peerId });
				send({
					type: "ice_candidate",
					to_user: peerId,
					candidate: event.candidate,
				});
			};

			pc.ontrack = (event) => {
				const stream = event.streams[0];
				if (!stream) {
					logger.warn(
						"Track received but no stream available",
						{ peerId },
					);
					return;
				}
				logger.info("Remote track received", {
					peerId,
					streamId: stream.id,
				});
				setRemoteStreams((prev) => ({
					...prev,
					[peerId]: stream,
				}));
			};

			pc.onconnectionstatechange = () => {
				logger.info("Peer connection state changed", {
					peerId,
					state: pc.connectionState,
				});
				if (
					pc.connectionState === "failed" ||
					pc.connectionState === "closed"
				) {
					logger.warn("Peer connection failed or closed", {
						peerId,
						state: pc.connectionState,
					});
					setRemoteStreams((prev) => {
						const next = { ...prev };
						delete next[peerId];
						return next;
					});
				}
			};

			return pc;
		},
		[attachLocalTracks, iceServers, send],
	);

	const initLocalMedia = useCallback(async () => {
		if (localStreamRef.current) {
			logger.debug("Local media already initialized");
			return localStreamRef.current;
		}
		logger.info("Initializing local media");
		let stream: MediaStream;
		const preferredConstraints: MediaStreamConstraints = {
			audio: {
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
			video: {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				frameRate: { ideal: 24, max: 30 },
			},
		};
		try {
			stream =
				await navigator.mediaDevices.getUserMedia(
					preferredConstraints,
				);
		} catch (error) {
			logger.warn(
				"Video+audio capture failed, retrying with audio-only",
				error,
			);
			stream =
				await navigator.mediaDevices.getUserMedia({
					audio: {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
					},
					video: false,
				});
		}
		logger.info("Local media initialized successfully", {
			streamId: stream.id,
		});
		localStreamRef.current = stream;
		setLocalStream(stream);
		setIsAudioEnabled(stream.getAudioTracks().length > 0);
		setIsVideoEnabled(stream.getVideoTracks().length > 0);
		return stream;
	}, []);

	const handleRoomState = useCallback(
		async (
			peers: { user_id: string }[],
			reconnected?: boolean,
		) => {
			logger.info("Handling room state", {
				peerCount: peers.length,
				reconnected,
			});
			if (reconnected) {
				logger.warn(
					"Reconnected to room, closing all peer connections",
				);
				Object.values(pcsRef.current).forEach((pc) =>
					pc.close(),
				);
				pcsRef.current = {};
				setRemoteStreams({});
			}
			await initLocalMedia();
			peers.forEach((peer) => {
				createPeerConnection(peer.user_id);
			});
		},
		[createPeerConnection, initLocalMedia],
	);

	const handlePeerJoined = useCallback(
		async (peerId: string) => {
			logger.info("Peer joined", { peerId });
			await initLocalMedia();
			const pc = createPeerConnection(peerId);
			logger.info("Creating offer for peer", { peerId });
			const offer = await pc.createOffer();
			await pc.setLocalDescription(offer);
			send({ type: "offer", to_user: peerId, sdp: offer });
		},
		[createPeerConnection, initLocalMedia, send],
	);

	const handlePeerLeft = useCallback((peerId: string) => {
		logger.info("Peer left", { peerId });
		const pc = pcsRef.current[peerId];
		if (pc) pc.close();
		delete pcsRef.current[peerId];
		setRemoteStreams((prev) => {
			const next = { ...prev };
			delete next[peerId];
			return next;
		});
	}, []);

	const handleOffer = useCallback(
		async (
			fromUser: string,
			sdp: RTCSessionDescriptionInit,
		) => {
			logger.info("Offer received", { fromUser });
			await initLocalMedia();
			const pc = createPeerConnection(fromUser);
			await pc.setRemoteDescription(
				new RTCSessionDescription(sdp),
			);
			logger.info("Creating answer for offer", {
				fromUser,
			});
			const answer = await pc.createAnswer();
			await pc.setLocalDescription(answer);
			send({
				type: "answer",
				to_user: fromUser,
				sdp: answer,
			});
		},
		[createPeerConnection, initLocalMedia, send],
	);

	const handleAnswer = useCallback(
		async (
			fromUser: string,
			sdp: RTCSessionDescriptionInit,
		) => {
			logger.info("Answer received", { fromUser });
			const pc = pcsRef.current[fromUser];
			if (!pc) {
				logger.warn("Received answer for unknown peer", {
					fromUser,
				});
				return;
			}
			await pc.setRemoteDescription(
				new RTCSessionDescription(sdp),
			);
		},
		[],
	);

	const handleIceCandidate = useCallback(
		async (
			fromUser: string,
			candidate: RTCIceCandidateInit,
		) => {
			logger.debug("ICE candidate received", { fromUser });
			const pc = pcsRef.current[fromUser];
			if (!pc) {
				logger.warn(
					"ICE candidate received for unknown peer",
					{ fromUser },
				);
				return;
			}
			try {
				await pc.addIceCandidate(
					new RTCIceCandidate(candidate),
				);
			} catch (error) {
				logger.error("Failed to add ICE candidate", error);
			}
		},
		[],
	);

	const toggleAudio = useCallback(() => {
		const stream = localStreamRef.current;
		if (!stream) {
			logger.warn("Cannot toggle audio: no local stream");
			return;
		}
		const next = !isAudioEnabled;
		stream.getAudioTracks().forEach((track) => {
			track.enabled = next;
		});
		logger.info("Audio toggled", { enabled: next });
		setIsAudioEnabled(next);
	}, [isAudioEnabled]);

	const toggleVideo = useCallback(() => {
		const stream = localStreamRef.current;
		if (!stream) {
			logger.warn("Cannot toggle video: no local stream");
			return;
		}
		const next = !isVideoEnabled;
		stream.getVideoTracks().forEach((track) => {
			track.enabled = next;
		});
		logger.info("Video toggled", { enabled: next });
		setIsVideoEnabled(next);
	}, [isVideoEnabled]);

	const stopAll = useCallback(() => {
		logger.info("Stopping all WebRTC connections");
		Object.values(pcsRef.current).forEach((pc) =>
			pc.close(),
		);
		pcsRef.current = {};
		setRemoteStreams({});
		if (localStreamRef.current) {
			localStreamRef.current
				.getTracks()
				.forEach((track) => track.stop());
			localStreamRef.current = null;
		}
		setLocalStream(null);
		logger.info("All WebRTC connections stopped");
	}, []);

	useEffect(() => {
		return () => {
			stopAll();
		};
	}, [stopAll]);

	return {
		localStream,
		remoteStreams,
		isAudioEnabled,
		isVideoEnabled,
		initLocalMedia,
		handleRoomState,
		handlePeerJoined,
		handlePeerLeft,
		handleOffer,
		handleAnswer,
		handleIceCandidate,
		toggleAudio,
		toggleVideo,
		stopAll,
	};
}
