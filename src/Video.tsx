import { useCallback, useEffect, useRef } from "react";

interface VideoProps {
  stream: MediaStream | null;
}

const Video = (props: VideoProps) => {
  const videoRef = (video: HTMLVideoElement | null) => {
    if (!video) {
      video!.srcObject = props.stream;
    }
  };

  return (
    <video
      style={{ width: "320px" }}
      autoPlay
      playsInline
      ref={videoRef}
    ></video>
  );
};

export default Video;
