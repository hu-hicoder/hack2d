import { useCallback, useEffect, useState, useRef } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { Hands, Results } from "@mediapipe/hands";
// import { drawCanvas } from "../utils/drawCanvas";
import {
  detectFingerPose,
  FingerTypes,
  FingerType,
  getPitch,
} from "../utils/finger";
import type { Meta } from "../types/type";

const Video = (props: {meta: Meta}) => {
  // video
  // audio
  const audioCtx = useRef<AudioContext | null>(null);
  const oscillator = useRef<OscillatorNode | null>(null);
  const prevFinger = useRef<FingerType>(FingerTypes.REST);
  const prevNote = useRef<FingerType>(FingerTypes.ONE);
  const isAttacked = useRef<Boolean>(false);

  const resultsRef = useRef<Results | null>(null);

  const createOscillator = (fingerType: FingerType) => {
    if (audioCtx.current) {
      oscillator.current = audioCtx.current.createOscillator();
      oscillator.current.type = "sine";
      oscillator.current.frequency.value =
        440 * Math.pow(2, getPitch(fingerType)! / 12);
      oscillator.current.connect(audioCtx.current.destination);
      oscillator.current.start();
    }
  };
  const deleteOscillator = () => {
    if (oscillator.current) {
      if (audioCtx.current) {
        oscillator.current.stop();
        oscillator.current.disconnect(audioCtx.current.destination);
        oscillator.current = null;
      }
    }
  };

  const onResults = useCallback((results: Results) => {
    resultsRef.current = results;

    // Audio
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        const fingerType = detectFingerPose(landmarks);

        const setNote = (fingerType: FingerType) => {
          deleteOscillator();
          createOscillator(fingerType);
          prevNote.current = fingerType;
          isAttacked.current = true;
        };

        if (fingerType !== prevFinger.current) {
          isAttacked.current = false;
        }
        prevFinger.current = fingerType;

        switch (fingerType) {
          case FingerTypes.REST:
            if (oscillator.current !== null) {
              deleteOscillator();
            }
            break;
          case FingerTypes.ONE:
          case FingerTypes.TWO:
          case FingerTypes.THREE:
          case FingerTypes.FOUR:
          case FingerTypes.FIVE:
          case FingerTypes.SIX:
          case FingerTypes.SEVEN:
          case FingerTypes.EIGHT:
          case FingerTypes.NINE:
            if (!isAttacked.current) {
              setNote(fingerType);
            }
            break;
          case FingerTypes.REPEAT:
            if (!isAttacked.current) {
              setNote(prevNote.current);
            }
            break;
          default:
            break;
        }

        console.log(fingerType);
      }
    }
  }, []);

  useEffect(() => {
          // Init audio
          audioCtx.current = new AudioContext();
  }, []);

  useEffect(() => {
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);

    if (
      typeof videoRef.current !== undefined &&
      videoRef.current !== null
    ) {
      console.log('[Video.tsx] videoRef.current = ', videoRef.current)
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await hands.send({ image: videoRef.current! });
        },
      });
      camera.start();
    }
  }, [onResults]);

  const videoRef = useRef<HTMLVideoElement | null>(null)
  console.log('[Video Component]', props);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = props.meta.srcObject;
      videoRef.current.play().catch((e) => console.log(e));
    }
  }, [])

  return (
    <>
      <video
        style={{ width: '240px', height: '200px' }}
        ref={videoRef}
        id={props.meta.id}
        autoPlay
        playsInline
      />
    </>
  )
}

export default Video