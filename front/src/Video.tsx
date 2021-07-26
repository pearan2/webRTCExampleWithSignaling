import React from "react";

interface VideoProps {
  stream: MediaStream | null;
}

const Video = (props: VideoProps) => {
  console.log("Video compoent called", props);
  const videoRef = (video: HTMLVideoElement | null) => {
    if (video) {
      video!.srcObject = props.stream;
    }
  };

  return props.stream === null || props.stream === undefined ? (
    <div>Loading...</div>
  ) : (
    <video
      style={{ width: "180px" }}
      autoPlay
      playsInline
      ref={videoRef}
    ></video>
  );
};

export default React.memo(Video);
