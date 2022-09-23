import { useCallback, useEffect, useState, useRef } from "react";
import type { Meta } from "../types/type";

const RemoteVideo = (props: { meta: Meta }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.meta.srcObject;
      videoRef.current.play().catch((e) => console.log(e));
    }
  }, [])

  return (
    <>
      <video
        style={{ width: '120px', height:'100px' }}
        ref={videoRef}
        id={props.meta.id}
        autoPlay
        playsInline
      />
    </>
  )
}

export default RemoteVideo