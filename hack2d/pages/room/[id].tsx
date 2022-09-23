import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import Video from '../../component/Video';
import RemoteVideo from '../../component/RemoteVideo';
import useSocket from '../../hooks/useSocket';
import type { Meta, PeerConnection } from '../../types/type';
import { useCallback, useEffect, useState, useRef } from "react";
import { Camera } from "@mediapipe/camera_utils";
import { Hands, Results } from "@mediapipe/hands";
// import { drawCanvas } from "../utils/drawCanvas";
import {
  detectFingerPose,
  FingerTypes,
  FingerType,
  getPitch,
} from "../../utils/finger";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    }
  ],
};

const Room = () => {
  useSocket();

  const router = useRouter();
  const socketRef: any = useRef();
  const { id: roomName } = router.query;
  const [remotes, setRemotes] = useState<Meta[]>([]);
  const peerConnections = useRef<PeerConnection[]>([]);
  let localStream = useRef<MediaStream | null>(null);
  const MAX_CONNECTIONS = 8;

  function messageToRoom(message: any) {
    socketRef.current.emit('message', message);
  }
  function callMe() {
    console.log('[callMe]')
    messageToRoom({ type: 'call me' });
  }
  function getConnectionCount() {
    return peerConnections.current.length;
  }

  function canConnect() {
    return getConnectionCount() < MAX_CONNECTIONS;
  }

  function isConnected(id: string) {
    console.log('[isConnected] peer = ', peerConnections.current, ' id = ', id)
    for (const peer of peerConnections.current) {
      if (peer.id === id) return true;
    }
    return false;
  }

  function addConnection(id: string, peer: RTCPeerConnection) {
    peerConnections.current.push({id, peer});
  }

  function getConnection(id: string): RTCPeerConnection | null {
    if (isConnected(id)) {
      for (const peer of peerConnections.current) {
        if (peer.id === id) return peer.peer;
      }
    }
    return null;
  }

  function sendSdp(id: string, sessionDescription: any) {
    // sending server.
    let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
    console.log('[sendSdp]', id, message)
    messageToOne(id, message);
  }
  function makeAnswer(id: string) {
    let peerConnection = getConnection(id);
    if (peerConnection !== null) {
      let rtcPeerConnection: RTCPeerConnection = peerConnection
    rtcPeerConnection.createAnswer()
      .then(function (sessionDescription: any) {
        console.log('createAnswer() succsess in promise');
        return rtcPeerConnection.setLocalDescription(sessionDescription);
      }).then(function () {
        console.log('setLocalDescription() succsess in promise');

        // Trickle ICE > 初期SDPを送る.
        sendSdp(id, rtcPeerConnection.localDescription);

        // Vanilla ICE > まだSDPを送らない.
      }).catch(function (error: any) {
        console.log(error);
      });
    }
  }

  function attachRemoteVideo(id: string, stream: MediaStream) {
    console.log('[attachRemoteVideo]', stream);
    const metadata = {
      id: `video-tag-${id}`,
      srcObject: stream
    }
    console.log('[attachRemoteVideo]', metadata)
    console.log('attachRemoteVideo::[array] = ', [...remotes, metadata])
    setRemotes(prev => {
      for (const meta of prev) {
        if (meta.id === metadata.id) return prev;
      }
      return [...prev, metadata];
    });
  }
  function isRemoteVideoAttached(id: string) {
    console.log('[isRemoteVideoAttached]', remotes, id);
    for (const remote of remotes) {
      if (remote.id === id) return true;
    }
    return false;
  }
  function messageToOne(id: string, message: any) {
    message.sendto = id;
    socketRef.current.emit('message', message);
  }
  function sendIceCandidate(id: string, candidate: any) {
    let message = { type: 'candidate', ice: candidate };
    if (isConnected(id)) {
      messageToOne(id, message);
    } else {
      console.error('[sendIceCandidate]: not connected')
    }
  }
  function prepareNewConnection(id: string) {
    let peer = new RTCPeerConnection(ICE_SERVERS);

    if ('ontrack' in peer) {
      console.log('-- ontrack');
      peer.ontrack = function (event) {
        console.log('[peer.ontrack]');
        if (isRemoteVideoAttached(id)) {
          // video と audioで２回届くので２回目を無視する.
          console.log('already stream attached.')
        } else {
          console.log('[prepareNewConnection] attachRemoteVideo', event)
          let stream = event.streams[0];
          attachRemoteVideo(id, stream);
        }
      };
    } else {
      console.log('-- onaddstream');
      // peer.onaddstream = function (event: any) {
      //   let stream = event.stream;
      //   attachRemoteVideo(id, stream);
      // }
    }

    peer.onicecandidate = function (event) {
      console.log('[peer.onicecandidate] ', event)
      if (event.candidate) {
        // Trickle ICE > ICE candidateを送る.
        sendIceCandidate(id, event.candidate);

        // Vanilla ICE > 何もしない.
      } else {
        // Trickle ICE > 何もしない.

        // Vanilla ICE > candidateを含んだSDPを送る.
        //sendSdp(id, peer.localDescription);
      }
    }

    peer.oniceconnectionstatechange = function () {
      switch (peer.iceConnectionState) {
        case 'closed':
        case 'failed':
          stopConnection(id);
          break;
        case 'disconnected':
          break;
      }
    };

    // localStreamの追加.
    if (localStream.current !== null) {
      localStream.current.getTracks().forEach((track: any) => {
        peer.addTrack(track, localStream.current!);
      })
      // if (streamAudioDest.current) {
      //   console.log('add_tracks',streamAudioDest.current.stream.getAudioTracks().length)
      //   streamAudioDest.current.stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
      //     peer.addTrack(track, streamAudioDest.current!.stream);
      //   })
      // }
    }

    return peer;
  }

  const setOffer = (id: string, sessionDescription: RTCSessionDescription) => {
    let peerConnection = prepareNewConnection(id);
    addConnection(id, peerConnection);

    peerConnection.setRemoteDescription(sessionDescription)
      .then(function () {
        makeAnswer(id);
      }).catch(function (error: any) {
        console.error('setRemoteDescription(offer) ERROR: ', error);
      });
  }
  function setAnswer(id: string, sessionDescription: any) {
    let peerConnection = getConnection(id);
    if (!peerConnection) {
      return;
    }
    peerConnection.setRemoteDescription(sessionDescription)
      .then(function () {
        console.log('setRemoteDescription(answer) succsess in promise');
      }).catch(function (error: any) {
        console.error('setRemoteDescription(answer) ERROR: ', error);
      });
  }
  function addIceCandidate(id: string, candidate: any) {
    if (!isConnected(id)) {
      console.warn('Not connected or already closed. id=' + id);
      return;
    }

    let peerConnection = getConnection(id);
    if (!peerConnection) {
      console.error('PeerConnection is not exist');
      return;
    }
    peerConnection.addIceCandidate(candidate);
  }
  function makeOffer(id: any) {
    let peerConnection = prepareNewConnection(id);
    addConnection(id, peerConnection);

    peerConnection.createOffer()
      .then(function (sessionDescription) {
        console.log('-- createOffer() succsess in promise');
        return peerConnection.setLocalDescription(sessionDescription);
      }).then(function () {
        console.log('-- setLocalDescription() succsess in promise');

        // Trickle ICE > 初期SDPを送る.
        sendSdp(id, peerConnection.localDescription);

        // Vanilla ICE > まだSDPを送らない.
      }).catch(function (error) {
        console.error(error);
      });
  }
  function isReadyToConnect() {
    return localStream.current ? true : false;
  }
  function startConnection(from: string) {
    if (!isReadyToConnect()) {
      console.log('Not ready connecting.');
      return;
    }
    if (!canConnect()) {
      console.warn('Too many connections.');
      return;
    }
    if (isConnected(from)) {
      console.log('already connecting.');
      return;
    }
    makeOffer(from);
  }
  function deleteConnection(id: string) {
    if (isConnected(id)) {
      let peer = getConnection(id);
      if (peer === null) {
        console.error('[deleteConnection] not found peer, id: ', id);
        return
      }
      peer.close();
      peerConnections.current.forEach((peer, index) => {
        if (peer.id === id) {
          peerConnections.current.splice(0, index);
          return;
        }
      })
    }
  }

  function stopConnection(id: string) {
    console.log('[stopConnection]', id);
    setRemotes(prev => prev.filter((remote) => remote.id !== id))
    deleteConnection(id)
  }

  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on('connect', (_event: any) => {
      socketRef.current.emit('enter', roomName);
    });

    socketRef.current.on('message', (message: any) => {
      console.log('message.from: ', message.from)
      let from: string = message.from;

      // 厳密比較. {} で変数スコープ指定.
      switch (message.type) {
        case 'offer': {
          console.log('--- offer from ' + from)
          let offer = new RTCSessionDescription(message);
          setOffer(from, offer);
          break;
        }
        case 'answer': {
          console.log('--- answer from' + from)
          let answer = new RTCSessionDescription(message);
          setAnswer(from, answer);
          break;
        }
        case 'candidate': {
          console.log('--- candidate from ' + from)
          let candidate = new RTCIceCandidate(message.ice);
          addIceCandidate(from, candidate);
          break;
        }
        case 'call me':
          console.log('--- call me from ' + from);
          startConnection(from);
          break;
      }
    });

    socketRef.current.on('user disconnected', (event: any) => {
      stopConnection(event.id);
    });
    // clear up after
    return () => socketRef.current.disconnect();
  }, [roomName]);

  function connect() {
    navigator.mediaDevices.getUserMedia({
      video: {
        width: { min: 320, ideal: 640 },
        height: { min: 240, ideal: 480 }
      },
      audio: false
    })
      .then(function (stream: MediaStream) {
        localStream.current = stream;

        if (streamAudioDest.current) {

          console.log('add_tracks',streamAudioDest.current.stream.getAudioTracks().length)
          streamAudioDest.current.stream.getAudioTracks().forEach((track: MediaStreamTrack) => {
            localStream.current!.addTrack(track);
          })
        }

        console.log('[startVideo] ', stream.getTracks()[0].getSettings());
        console.log('[connect] remotes = ', remotes);
        console.log('[connect] localStream.current = ', localStream.current);
        if (!isReadyToConnect()) {
          return;
        }
        if (!canConnect()) {
          return;
        }
        callMe();
      }).catch(function (error) {
        console.error('mediaDevice.getUserMedia() error:', error);
      });
  }




  


    // video
  // audio
  const audioCtx = useRef<AudioContext | null>(null);
  const streamAudioDest = useRef<MediaStreamAudioDestinationNode | null>(null);
  const oscillator = useRef<OscillatorNode | null>(null);
  const prevFinger = useRef<FingerType>(FingerTypes.REST);
  const prevNote = useRef<FingerType>(FingerTypes.ONE);
  const isAttacked = useRef<Boolean>(false);

  const resultsRef = useRef<Results | null>(null);

  const createOscillator = (fingerType: FingerType) => {
    if (audioCtx.current &&streamAudioDest.current) {
      oscillator.current = audioCtx.current.createOscillator();
      oscillator.current.type = "sine";
      oscillator.current.frequency.value =
        440 * Math.pow(2, getPitch(fingerType)! / 12);
      oscillator.current.connect(audioCtx.current.destination);
      oscillator.current.connect(streamAudioDest.current)
      oscillator.current.start();
    }
  };
  const deleteOscillator = () => {
    if (oscillator.current) {
      if (audioCtx.current &&streamAudioDest.current) {
        oscillator.current.stop();
        oscillator.current.disconnect(audioCtx.current.destination);
        oscillator.current.disconnect(streamAudioDest.current)
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
          streamAudioDest.current = audioCtx.current.createMediaStreamDestination()
          if (audioCtx.current.state === 'suspended') {
            audioCtx.current.resume().then(() => {
              console.log('音声の再生を開始しました')
            })
          }
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
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = localStream.current;
      videoRef.current.play().catch((e) => console.log(e));
    }
  }, [])

  return (
    <>
      <div>
        <div id="main-container">
          <button type="button" onClick={connect} className="outlined-button">Connect</button>
          <section className="video">
            <video
              style={{ width: '240px', height: '200px' }}
              ref={videoRef}
              autoPlay
              playsInline
            />
            <div id="remote-videos">
              {
                remotes.map(meta => {
                  return <RemoteVideo key={meta.id} meta={meta}></RemoteVideo>
                })
              }
            </div>
          </section>
        </div>
      </div>
    </>);
};

export default Room;