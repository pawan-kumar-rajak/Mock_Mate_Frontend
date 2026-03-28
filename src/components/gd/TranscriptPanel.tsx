import { useEffect, useRef } from "react";
import { Card, Typography, Tag } from "antd";

type TranscriptItem = {
  id: string;
  userId: string;
  text: string;
  timestamp: number;
};

type Props = {
  items: TranscriptItem[];
};

const { Title, Text } = Typography;

export default function TranscriptPanel({ items }: Props) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const localUserId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [items]);

  return (
    <Card className="h-full rounded-2xl border border-slate-100 [&_.ant-card-body]:flex [&_.ant-card-body]:h-full [&_.ant-card-body]:min-h-0 [&_.ant-card-body]:flex-col">
      <div className="flex items-center justify-between">
        <Title level={4} className="m-0!">
          Live Transcript
        </Title>
        <Tag color="green" className="m-0">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500 align-middle" />{" "}
          LIVE
        </Tag>
      </div>
      <div ref={listRef} className="mt-3 h-full min-h-0 overflow-y-auto space-y-3 pr-1">
        {items.length === 0 && (
          <Text className="text-slate-500">No transcript yet.</Text>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex gap-2">
            <Tag color="geekblue">{item.userId === localUserId ? "You" : item.userId}</Tag>
            <div className="flex-1">
              <div className="text-slate-800">{item.text}</div>
              <div className="text-xs text-slate-400">
                {new Date(item.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
