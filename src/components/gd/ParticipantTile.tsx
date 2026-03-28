import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Tag } from "antd";

type Props = {
  stream: MediaStream | null;
  label: string;
  isLocal?: boolean;
};

export default function ParticipantTile({ stream, label, isLocal }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);

  const tryPlay = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setPlaybackBlocked(false);
    } catch {
      if (!isLocal) setPlaybackBlocked(true);
    }
  }, [isLocal]);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    void tryPlay();
  }, [stream, tryPlay]);

  return (
    <Card className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="relative overflow-hidden rounded-lg bg-slate-900">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-48 w-full object-cover"
        />
        {playbackBlocked && (
          <button
            type="button"
            className="absolute inset-0 bg-black/55 text-white text-sm font-semibold"
            onClick={() => {
              void tryPlay();
            }}
          >
            Tap to play audio/video
          </button>
        )}
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-200">
            Connecting...
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-2">
          <Tag color={isLocal ? "blue" : "geekblue"}>{label}</Tag>
        </div>
      </div>
    </Card>
  );
}
