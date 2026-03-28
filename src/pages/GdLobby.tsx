import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGdLobbySocket } from "../hooks/useGdLobbySocket";
import type {
  GdLobbyWsMessage,
  LobbyUpdateMessage,
  QueueStatusMessage,
} from "../types/gd";
import LobbyStatusCard from "../components/gd/LobbyStatusCard";
import QueueStats from "../components/gd/QueueStats";
import ConnectionBadge from "../components/gd/ConnectionBadge";
import { getMyStatus } from "../services/gdApi";
import createLogger from "../utils/logger";
import {
  RocketOutlined,
  LogoutOutlined,
  WarningOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const logger = createLogger("GdLobby");

export default function GdLobby() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<
    LobbyUpdateMessage | QueueStatusMessage | null
  >(null);
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [blacklistedMessage, setBlacklistedMessage] = useState<string | null>(
    null,
  );

  const baseUrl = useMemo(
    () => String(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    [],
  );

  const onMessage = useCallback(
    (msg: GdLobbyWsMessage) => {
      logger.debug("Lobby message received", { type: msg.type });
      if (msg.type === "lobby_update" || msg.type === "queue_status") {
        setStatus(msg);
        if ("estimated_wait_seconds" in msg && msg.estimated_wait_seconds) {
          setEstimatedWait(msg.estimated_wait_seconds ?? null);
        }
      } else if (msg.type === "room_created") {
        logger.info("Room created from lobby", { roomId: msg.room_id });
        message.success("Match found! Redirecting...");
        navigate(`/gd/room/${msg.room_id}`);
      } else if (msg.type === "blacklisted") {
        setBlacklistedMessage(msg.message);
        message.error(msg.message);
      } else if (msg.type === "error") {
        message.error(msg.message);
      }
    },
    [navigate],
  );

  const { isConnected, close } = useGdLobbySocket({
    httpBaseUrl: baseUrl,
    userId: userId || "",
    enabled: joined && Boolean(userId),
    onMessage,
  });

  useEffect(() => {
    if (!joined || !userId) return;
    const accessToken = String(localStorage.getItem("accessToken") || "");
    if (!accessToken) return;
    let stopped = false;

    const tick = async () => {
      try {
        const status = await getMyStatus(accessToken);
        if (stopped) return;
        if (status.in_room && status.room_id) {
          navigate(`/gd/room/${status.room_id}`);
        }
      } catch {
        /* ignore polling errors */
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 3000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [joined, userId, navigate]);

  const handleJoin = () => {
    if (!userId) {
      message.error("Please sign in to join the lobby.");
      navigate("/signin");
      return;
    }
    setBlacklistedMessage(null);
    setJoined(true);
  };

  const handleLeave = () => {
    close();
    setJoined(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 transition-colors duration-500 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-12.5 h-125 bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-10 relative">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50">
              <UsergroupAddOutlined className="text-indigo-600 dark:text-indigo-400 text-xs" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                Matchmaking Lobby
              </span>
            </div>
            <Title
              level={1}
              className="m-0! font-black! tracking-tighter! text-slate-900! dark:text-white!"
            >
              Group Discussion
            </Title>
            <Text className="text-lg! text-slate-500 dark:text-slate-400 block max-w-xl">
              Connect with peers globally and practice your communication skills
              in a live environment.
            </Text>
          </div>
          <div className="flex items-center gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <ConnectionBadge connected={isConnected} />
          </div>
        </div>

        {/* Warning Notification */}
        {blacklistedMessage && (
          <Card className="rounded-2xl! border-none bg-red-50 dark:bg-red-950/20 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
                <WarningOutlined className="text-xl" />
              </div>
              <div>
                <Text strong className="block text-red-800 dark:text-red-200">
                  Access Restricted
                </Text>
                <Text className="text-red-600 dark:text-red-400/80 text-sm">
                  {blacklistedMessage}
                </Text>
              </div>
            </div>
          </Card>
        )}

        {/* Stats & Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-7">
            <LobbyStatusCard status={status} />
          </div>
          <div className="md:col-span-5">
            <QueueStats
              waitingCount={status?.waiting_count ?? 0}
              needed={status?.needed ?? 0}
              requiredPlayers={status?.required_players ?? 0}
              estimatedWaitSeconds={estimatedWait}
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
          {!joined ? (
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={handleJoin}
              className="h-16 px-12 rounded-2xl! bg-indigo-600! hover:bg-indigo-700! border-none! font-black! text-lg! shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
            >
              Enter Matchmaking Queue
            </Button>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Button
                danger
                size="large"
                icon={<LogoutOutlined />}
                onClick={handleLeave}
                className="h-16 px-10 rounded-2xl! bg-red-500/10! hover:bg-red-500! text-red-500! hover:text-white! border-red-500/20! font-bold! active:scale-95 transition-all"
              >
                Cancel Matchmaking
              </Button>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                </div>
                <Text className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">
                  Searching for suitable peers...
                </Text>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
