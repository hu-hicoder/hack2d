import { useCallback, useEffect, useState, useRef } from "react";
import type { Meta } from "../types/type";

const RemoteVideo = (props: { meta: Meta }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const audioCtx = new AudioContext()

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.meta.srcObject;
      videoRef.current.play().catch((e) => console.log(e));
    }
  }, [])

  useEffect(() => {
    if (sourceRef.current) {
      sourceRef.current = audioCtx.createMediaStreamSource(props.meta.srcObject)
      sourceRef.current.connect(audioCtx.destination)
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

      <div>{props.meta.srcObject && props.meta.srcObject.getAudioTracks().length}</div>
    </>
  )
}

export default RemoteVideo