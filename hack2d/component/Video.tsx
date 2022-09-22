import { Props } from "next/script";
import { useEffect, useRef } from "react"

const Video = (props: any) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  console.log('[Video Component]', props);
  useEffect(() => {
    videoRef.current!.srcObject = props.props.srcObject;
  }, [])

  return (
    <>
      <video
        style={{ width: '120px', height: '100px' }}
        ref={videoRef}
        id={props.props.id}
        autoPlay
        playsInline
      />
    </>
  )
}

export default Video