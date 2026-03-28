import { useEffect, useState } from "react";
import { Modal, Select, Input, Typography } from "antd";
import type { ReportRequest } from "../../types/gd";

const { Text } = Typography;

type Props = {
  open: boolean;
  peerId: string | null;
  onCancel: () => void;
  onSubmit: (payload: ReportRequest) => void;
};

export default function ReportModal({ open, peerId, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState("");
  const [category, setCategory] =
    useState<ReportRequest["category"]>("other");

  useEffect(() => {
    if (!open) {
      setReason("");
      setCategory("other");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={() =>
        peerId &&
        onSubmit({
          reported_user_id: peerId,
          reason: reason || "unspecified",
          category,
        })
      }
      okText="Report"
      title="Report participant"
    >
      <div className="space-y-3">
        <Text className="text-slate-600 dark:text-slate-300">Reporting: {peerId || "-"}</Text>
        <Select
          value={category}
          onChange={(value) => setCategory(value)}
          className="w-full"
          options={[
            { label: "Abusive Language", value: "abusive_language" },
            { label: "Misconduct", value: "misconduct" },
            { label: "Spam", value: "spam" },
            { label: "Other", value: "other" },
          ]}
        />
        <Input.TextArea
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain the issue..."
          className="rounded-xl!"
        />
      </div>
    </Modal>
  );
}
