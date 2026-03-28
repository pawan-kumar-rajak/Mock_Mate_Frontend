import { Button } from "antd";
import {
  AudioMutedOutlined,
  AudioOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  PhoneOutlined,
} from "@ant-design/icons";

type Props = {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onLeave: () => void;
};

export default function MediaControls(props: Props) {
  const { isAudioEnabled, isVideoEnabled, onToggleAudio, onToggleVideo, onLeave } =
    props;

  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type={isAudioEnabled ? "default" : "primary"}
        icon={isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
        onClick={onToggleAudio}
        className="rounded-xl! font-semibold!"
      >
        {isAudioEnabled ? "Mute" : "Unmute"}
      </Button>
      <Button
        type={isVideoEnabled ? "default" : "primary"}
        icon={isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
        onClick={onToggleVideo}
        className="rounded-xl! font-semibold!"
      >
        {isVideoEnabled ? "Camera Off" : "Camera On"}
      </Button>
      <Button danger icon={<PhoneOutlined />} onClick={onLeave} className="rounded-xl! font-semibold!">
        Leave Room
      </Button>
    </div>
  );
}
