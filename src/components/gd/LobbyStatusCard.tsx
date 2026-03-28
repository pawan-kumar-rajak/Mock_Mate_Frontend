import { Card, Typography } from "antd";
import type { LobbyUpdateMessage, QueueStatusMessage } from "../../types/gd";

const { Title, Text } = Typography;

type Props = {
  status?: LobbyUpdateMessage | QueueStatusMessage | null;
};

export default function LobbyStatusCard({ status }: Props) {
  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Title level={4} className="m-0! text-slate-900! dark:text-slate-100!">
        Lobby Status
      </Title>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <Text className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Waiting
          </Text>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {status?.waiting_count ?? "--"}
          </div>
        </div>
        <div>
          <Text className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Needed
          </Text>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {status?.needed ?? "--"}
          </div>
        </div>
        <div>
          <Text className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Your Position
          </Text>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {status?.your_position ?? "--"}
          </div>
        </div>
        <div>
          <Text className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Required
          </Text>
          <div className="text-2xl font-semibold text-slate-800 dark:text-slate-100">
            {status?.required_players ?? "--"}
          </div>
        </div>
      </div>
    </Card>
  );
}
