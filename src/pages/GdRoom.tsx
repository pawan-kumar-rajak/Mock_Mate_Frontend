import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Typography, message, Space, Divider, Alert } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGdRoomSocket } from "../hooks/useGdRoomSocket";
import { useGdWebRtc } from "../hooks/useGdWebRtc";
import { useGdTranscription } from "../hooks/useGdTranscription";
import type { GdRoomWsMessage } from "../types/gd";
import ParticipantGrid from "../components/gd/ParticipantGrid";
import MediaControls from "../components/gd/MediaControls";
import TopicPanel from "../components/gd/TopicPanel";
import ConnectionBadge from "../components/gd/ConnectionBadge";
import ReportModal from "../components/gd/ReportModal";
import TranscriptPanel from "../components/gd/TranscriptPanel";
import {
  reportPeer as reportPeerRest,
  leaveRoom as leaveRoomRest,
} from "../services/gdApi";
import createLogger from "../utils/logger";
import {
  InfoCircleOutlined,
  UsergroupAddOutlined,
  LogoutOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const logger = createLogger("GdRoom");

export default function GdRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { userId } = useAuth();

  const [topic, setTopic] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[] | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeerId, setReportPeerId] = useState<string | null>(null);
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [transcripts, setTranscripts] = useState<
    { id: string; userId: string; text: string; timestamp: number }[]
  >([]);
  const [sttSupported, setSttSupported] = useState(true);
  const [sttActive, setSttActive] = useState(false);
  const recentTranscriptMapRef = useRef<Map<string, number>>(new Map());

  const appendTranscript = useCallback(
    (item: { id: string; userId: string; text: string; timestamp: number }) => {
      const text = item.text.trim();
      if (!text) return;
      const nowMs = Date.now();
      const dedupeKey = `${item.userId}:${text.toLowerCase()}`;
      const seenAt = recentTranscriptMapRef.current.get(dedupeKey) ?? 0;
      if (nowMs - seenAt < 1500) return;
      recentTranscriptMapRef.current.set(dedupeKey, nowMs);
      setTranscripts((prev) => {
        const next = [...prev, { ...item, text }];
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
    },
    [],
  );

  const normalizePeerIds = useCallback(
    (ids: string[]): string[] => {
      const unique = new Set<string>();
      ids.forEach((id) => {
        if (id && id !== userId) unique.add(id);
      });
      return [...unique];
    },
    [userId],
  );

  const baseUrl = useMemo(
    () => String(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    [],
  );

  const setTopicFromRoomState = useCallback((msg: GdRoomWsMessage) => {
    if (msg.type !== "room_state") return;
    const raw = msg as Record<string, any>;
    setTopic(msg.topic ?? raw.topic_title ?? null);
    setContext(msg.context ?? raw.topic_context ?? null);
    setKeyPoints(msg.key_points ?? raw.key_points ?? null);
  }, []);

  const { isConnected, send, close } = useGdRoomSocket({
    httpBaseUrl: baseUrl,
    roomId: roomId || "",
    userId: userId || "",
    enabled: Boolean(roomId && userId),
    onMessage: (msg: GdRoomWsMessage) => {
      if (msg.type === "room_state") {
        setTopicFromRoomState(msg);
        setPeerIds(normalizePeerIds(msg.peers.map((p) => p.user_id)));
        void handleRoomState(msg.peers, msg.reconnected);
      } else if (msg.type === "peer_joined") {
        if (msg.peer_id !== userId) {
          setPeerIds((prev) =>
            prev.includes(msg.peer_id) ? prev : [...prev, msg.peer_id],
          );
          void handlePeerJoined(msg.peer_id);
        }
      } else if (msg.type === "peer_left") {
        setPeerIds((prev) => prev.filter((id) => id !== msg.peer_id));
        handlePeerLeft(msg.peer_id);
      } else if (msg.type === "offer" && msg.from_user) {
        void handleOffer(msg.from_user, msg.sdp);
      } else if (msg.type === "answer" && msg.from_user) {
        void handleAnswer(msg.from_user, msg.sdp);
      } else if (msg.type === "ice_candidate" && msg.from_user) {
        void handleIceCandidate(msg.from_user, msg.candidate);
      } else if (msg.type === "transcript" && msg.text?.trim()) {
        const nowMs = Date.now();
        appendTranscript({
          id: `${msg.from_user || "peer"}-${msg.timestamp || nowMs}`,
          userId: msg.from_user || "peer",
          text: msg.text!,
          timestamp: msg.timestamp || nowMs / 1000,
        });
      } else if (msg.type === "room_ended" || msg.type === "blacklisted") {
        message.info(msg.message || "Session ended.");
        navigate("/gd");
      }
    },
  });

  const {
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
  } = useGdWebRtc({ send });

  const handleTranscript = useCallback(
    (text: string) => {
      const now = Date.now();
      const senderId = userId || "local";
      appendTranscript({
        id: `${senderId}-${now}`,
        userId: senderId,
        text,
        timestamp: now / 1000,
      });
      send({
        type: "transcript",
        text: text.trim(),
        timestamp: now / 1000,
      });
    },
    [appendTranscript, send, userId],
  );

  useEffect(() => {
    if (roomId && userId) void initLocalMedia();
  }, [roomId, userId, initLocalMedia]);

  useGdTranscription({
    enabled: Boolean(isConnected && userId && isAudioEnabled),
    onTranscript: handleTranscript,
    onStatusChange: (status) => {
      setSttSupported(status.supported);
      setSttActive(status.active);
    },
  });

  const handleLeave = async () => {
    send({ type: "leave_room" });
    close();
    stopAll();
    const accessToken = localStorage.getItem("accessToken");
    if (accessToken)
      try {
        await leaveRoomRest(accessToken);
      } catch {}
    navigate("/gd");
  };

  if (!roomId || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md rounded-3xl! border-none bg-slate-900 text-center">
          <InfoCircleOutlined className="mb-4 text-4xl text-indigo-500" />
          <Title level={4} className="text-white!">
            Session Unavailable
          </Title>
          <Text className="text-slate-400">
            Please sign in and provide a valid Room ID to join the discussion.
          </Text>
          <Button
            type="primary"
            block
            className="mt-8 h-12 rounded-xl! bg-indigo-600! border-none"
            onClick={() => navigate("/signin")}
          >
            Sign In to Join
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-slate-950 p-2 md:p-4 transition-colors duration-500">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-4xl border border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-md">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <Space size="large">
            <div>
              <Title
                level={4}
                className="m-0! font-black! tracking-tight! text-white! flex items-center gap-2"
              >
                <UsergroupAddOutlined className="text-indigo-500" /> GD Session
              </Title>
              <Text className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                Room: {roomId}
              </Text>
            </div>
          </Space>

          <Space size="middle">
            <div className="hidden md:flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              <Text className="text-xs text-slate-300 font-bold">
                {peerIds.length + 1} Active
              </Text>
            </div>
            <ConnectionBadge connected={isConnected} />
          </Space>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Main Stage */}
          <section className="flex flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <ParticipantGrid
                localStream={localStream}
                remoteStreams={remoteStreams}
                remotePeerIds={peerIds}
              />

              {/* Mobile Sidebar Fallback */}
              <div className="mt-6 grid gap-4 lg:hidden">
                <TopicPanel
                  topic={topic}
                  context={context}
                  keyPoints={keyPoints}
                />
                <Card className="rounded-2xl! border-slate-800 bg-slate-900/80">
                  <Title
                    level={5}
                    className="text-slate-300! mb-4! flex items-center gap-2"
                  >
                    <WarningOutlined className="text-amber-500" /> Moderation
                  </Title>
                  <div className="flex flex-wrap gap-2">
                    {peerIds.map((id) => (
                      <Button
                        key={id}
                        ghost
                        size="small"
                        className="rounded-lg! border-slate-700 text-slate-400 hover:text-red-400!"
                        onClick={() => {
                          setReportPeerId(id);
                          setReportOpen(true);
                        }}
                      >
                        Report {id.slice(0, 6)}...
                      </Button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {/* Transcript Area */}
            <div className="shrink-0 border-t border-slate-800 bg-slate-950/50 px-4 py-2">
              <div className="h-[22vh] min-h-40 max-h-70">
                {!sttSupported && (
                  <Alert
                    className="mb-2"
                    type="warning"
                    showIcon
                    message="Live transcription is not supported in this browser. Audio/video still works."
                  />
                )}
                {sttSupported && !sttActive && isAudioEnabled && (
                  <Alert
                    className="mb-2"
                    type="info"
                    showIcon
                    message="Transcription is reconnecting. It will resume automatically."
                  />
                )}
                <TranscriptPanel items={transcripts} />
              </div>
            </div>

            {/* Floating Style Media Controls */}
            <div className="border-t border-slate-800 bg-slate-900 px-6 py-4">
              <MediaControls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onLeave={handleLeave}
              />
            </div>
          </section>

          {/* Sidebar - Desktop Only */}
          <aside className="hidden w-95 flex-col border-l border-slate-800 bg-slate-900/30 lg:flex">
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
              <TopicPanel
                topic={topic}
                context={context}
                keyPoints={keyPoints}
              />

              <Divider className="border-slate-800" />

              <Card className="rounded-2xl! border-slate-800 bg-indigo-500/5 backdrop-blur-sm p-2">
                <Title
                  level={5}
                  className="text-white! mb-4! text-sm! uppercase tracking-widest opacity-70"
                >
                  Moderation Tools
                </Title>
                <div className="space-y-2">
                  {peerIds.length === 0 ? (
                    <Text className="text-slate-600 italic block text-center py-4">
                      Waiting for peers...
                    </Text>
                  ) : (
                    peerIds.map((peerId) => (
                      <div
                        key={peerId}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50"
                      >
                        <Text className="text-slate-300 font-mono text-xs">
                          {peerId.slice(0, 12)}...
                        </Text>
                        <Button
                          danger
                          type="text"
                          size="small"
                          icon={<WarningOutlined />}
                          onClick={() => {
                            setReportPeerId(peerId);
                            setReportOpen(true);
                          }}
                        >
                          Report
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="p-6 border-t border-slate-800">
              <Button
                block
                danger
                icon={<LogoutOutlined />}
                className="h-12 rounded-xl! border-red-500/30! bg-red-500/10! hover:bg-red-500! font-bold"
                onClick={handleLeave}
              >
                Leave Room
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        peerId={reportPeerId}
        onCancel={() => setReportOpen(false)}
        onSubmit={async (p) => {
          setReportOpen(false);
          if (!send({ type: "report", ...p })) {
            const token = localStorage.getItem("accessToken");
            if (token && roomId) await reportPeerRest(token, roomId, p);
          }
          message.success("User reported to moderators.");
        }}
      />
    </div>
  );
}

