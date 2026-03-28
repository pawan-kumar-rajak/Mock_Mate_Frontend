import { Card, Typography, Tag } from "antd";

const { Title, Text, Paragraph } = Typography;

type Props = {
  topic?: string | null;
  context?: string | null;
  keyPoints?: string[] | null;
};

export default function TopicPanel({ topic, context, keyPoints }: Props) {
  return (
    <Card className="rounded-2xl border border-slate-100 overflow-hidden">
      <div className="space-y-3 p-4">
        <Title level={4} className="!m-0 break-words">
          Topic
        </Title>

        <Paragraph className="mb-0! text-slate-700 break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
          {topic || "Waiting for topic..."}
        </Paragraph>

        {context && (
          <Paragraph className="mb-0! text-slate-600 break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
            <Text strong>Context:</Text> {context}
          </Paragraph>
        )}

        {keyPoints && keyPoints.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {keyPoints.map((kp) => (
              <Tag
                key={kp}
                color="blue"
                className="m-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere] h-auto py-1"
              >
                {kp}
              </Tag>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
