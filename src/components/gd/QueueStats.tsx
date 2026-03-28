import { Card, Progress, Typography } from "antd";

const { Text } = Typography;

export default function QueueStats(props: {
  waitingCount: number;
  needed: number;
  requiredPlayers: number;
  estimatedWaitSeconds?: number | null;
}) {
  const { waitingCount, needed, requiredPlayers, estimatedWaitSeconds } = props;
  const progress = Math.min(
    100,
    Math.round((waitingCount / Math.max(1, requiredPlayers)) * 100),
  );

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <Text className="text-xs uppercase text-slate-500 dark:text-slate-400">
          Queue Progress
        </Text>
        <Text className="text-xs text-slate-400 dark:text-slate-500">
          Est. wait: {estimatedWaitSeconds ? `${estimatedWaitSeconds}s` : "-"}
        </Text>
      </div>
      <div className="mt-3">
        <Progress percent={progress} showInfo={false} />
      </div>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Waiting: {waitingCount} - Needed: {needed} - Required: {requiredPlayers}
      </div>
    </Card>
  );
}
