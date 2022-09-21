import { useRouter } from 'next/router';
import { createRef, RefObject, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useSocket from '../../hooks/useSocket';

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
  // const userVideoRef: any = useRef();
  // const peerVideoRef: any = useRef();
  // const remotes = useRef([])
  // const remoteVideoRef = useRef<RefObject<HTMLVideoElement | null>[]>(null);
  // const rtcConnectionRef: any = useRef(null);
  const socketRef: any = useRef();
  // const userStreamRef: any = useRef();
  // const hostRef = useRef(false);
  const { id: roomName } = router.query;
  const [remoteVideos, setRemoteVideos] = useState<any>([]);
  let peerConnections: any = [];
  let localStream: any = null;
  const MAX_CONNECTIONS = 8;
  const localVideoRef: any = useRef(null);

  function messageToRoom(message: any) {
    socketRef.current.emit('message', message);
  }
  function callMe() {
    messageToRoom({ type: 'call me' });
  }
  function getConnectionCount() {
    return peerConnections.length;
  }

  function canConnect() {
    return getConnectionCount() < MAX_CONNECTIONS;
  }

  function isConnected(id: string) {
    return peerConnections[id] ? true : false;
  }

  function addConnection(id: string, peer: any) {
    peerConnections[id] = peer;
  }

  function getConnection(id: string) {
    if (isConnected(id)) {
      return peerConnections[id];
    } else {
      return null;
    }
  }
  function sendSdp(id: string, sessionDescription: any) {
    // sending server.
    let message = { type: sessionDescription.type, sdp: sessionDescription.sdp };
    messageToOne(id, message);
  }
  function makeAnswer(id: string) {
    let peerConnection = getConnection(id);
    if (!peerConnection) {
      return;
    }

    peerConnection.createAnswer()
      .then(function (sessionDescription: any) {
        console.log('createAnswer() succsess in promise');
        return peerConnection.setLocalDescription(sessionDescription);
      }).then(function () {
        console.log('setLocalDescription() succsess in promise');

        // Trickle ICE > 初期SDPを送る.
        sendSdp(id, peerConnection.localDescription);

        // Vanilla ICE > まだSDPを送らない.
      }).catch(function (error: any) {
        console.log(error);
      });
  }
  function createVideoElement(id: string) {
    let videoRef: any = useRef(null);
    videoRef.current.width = 160;
    videoRef.current.height = 120;
    videoRef.current.id = `video-tag-${id}`;

    setRemoteVideos([...remoteVideos, videoRef])

    return videoRef;
  }

  function attachRemoteVideo(id: string, stream: any) {
    const userVideoRef = createVideoElement(id)
    userVideoRef.current.srcObject = stream;
    userVideoRef.current.onloadedmetadata = () => {
      userVideoRef.current.play();
    };
  }
  function isRemoteVideoAttached(id: string) {
    return remoteVideos[id]===undefined ? true : false;
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
        if (isRemoteVideoAttached(id)) {
          // video と audioで２回届くので２回目を無視する.
          console.log('already stream attached.')
        } else {
          console.log('[prepareNewConnection] attachRemoteVideo')
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
    return localStream ? true : false;
  }
  function startConnection(from: any) {
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
      peer.close();
      delete peerConnections[id];
    }
  }
  function detachRemoteVideo(id: string) {
    // let remoteVideo = getRemoteVideoElement(id);
    // if (remoteVideo) {
    //   remoteVideo.pause();
    //   remoteVideo.srcObject = null;
    //   deleteRemoteVideoElement(id);
    // }
  }
  function stopConnection(id: string) {
    detachRemoteVideo(id);
    deleteConnection(id);
  }
  function stopAllConnection() {
    for (let id in peerConnections) {
      stopConnection(id);
    }
  }

  function hangUp() {
    messageToRoom({ type: 'bye' });
    stopAllConnection();
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
        case 'bye':
          console.log('--- bye from ' + from);
          // stopConnection(from);
          break;
      }
    });

    socketRef.current.on('user disconnected', (event: any) => {
      // stopConnection(event.id);
    });
    // clear up after
    return () => socketRef.current.disconnect();
  }, [roomName]);

  function startVideo() {
    navigator.mediaDevices.getUserMedia({
      video: {
        width: { min: 320, ideal: 640 },
        height: { min: 240, ideal: 480 }
      },
      audio: false
    })
      .then(function (stream:any) {
        localStream = stream;
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current.play();
        };
        console.log(stream.getAudioTracks()[0].getSettings());
        return localVideoRef;
      }).catch(function (error) {
        console.error('mediaDevice.getUserMedia() error:', error);
        return;
      });
  }

  function stopVideo() {
    if (localStream == null) {
      return;
    }
    for (let track of localStream.getTracks()) {
      track.stop();
    }
    localStream = null;

    // kill local video.
    localVideoRef.current.pause();
    localVideoRef.current.srcObject = null;
  }

  function connect() {
    if (!isReadyToConnect()) {
      return;
    }
    if (!canConnect()) {
      return;
    }
    callMe();
  }
  // const handleRoomJoined = () => {
  //   navigator.mediaDevices
  //     .getUserMedia({
  //       audio: false,
  //       video: { width: 500, height: 500 },
  //     })
  //     .then((stream) => {
  //       /* use the stream */
  //       userStreamRef.current = stream;
  //       userVideoRef.current.srcObject = stream;
  //       userVideoRef.current.onloadedmetadata = () => {
  //         userVideoRef.current.play();
  //       };
  //       socketRef.current.emit('ready', roomName);
  //     })
  //     .catch((err) => {
  //       /* handle the error */
  //       console.log('error', err);
  //     });
  // };



  // const handleRoomCreated = () => {
  //   hostRef.current = true;
  //   navigator.mediaDevices
  //     .getUserMedia({
  //       audio: false,
  //       video: { width: 500, height: 500 },
  //     })
  //     .then((stream) => {
  //       /* use the stream */
  //       userStreamRef.current = stream;
  //       userVideoRef.current.srcObject = stream;
  //       userVideoRef.current.onloadedmetadata = () => {
  //         userVideoRef.current.play();
  //       };
  //     })
  //     .catch((err) => {
  //       /* handle the error */
  //       console.log(err);
  //     });
  // };

  // const initiateCall = () => {
  //   if (hostRef.current) {
  //     rtcConnectionRef.current = createPeerConnection();
  //     rtcConnectionRef.current.addTrack(
  //       userStreamRef.current.getTracks()[0],
  //       userStreamRef.current,
  //     );
  //     rtcConnectionRef.current.addTrack(
  //       userStreamRef.current.getTracks()[1],
  //       userStreamRef.current,
  //     );
  //     rtcConnectionRef.current
  //       .createOffer()
  //       .then((offer: any) => {
  //         rtcConnectionRef.current.setLocalDescription(offer);
  //         socketRef.current.emit('offer', offer, roomName);
  //       })
  //       .catch((error: any) => {
  //         console.log(error);
  //       });
  //   }
  // };

  // const onPeerLeave = () => {
  //   // This person is now the creator because they are the only person in the room.
  //   hostRef.current = true;
  //   if (peerVideoRef.current.srcObject) {
  //     peerVideoRef.current.srcObject
  //       .getTracks()
  //       .forEach((track: any) => track.stop()); // Stops receiving all track of Peer.
  //   }

  //   // Safely closes the existing connection established with the peer who left.
  //   if (rtcConnectionRef.current) {
  //     rtcConnectionRef.current.ontrack = null;
  //     rtcConnectionRef.current.onicecandidate = null;
  //     rtcConnectionRef.current.close();
  //     rtcConnectionRef.current = null;
  //   }
  // }

  // /**
  //  * Takes a userid which is also the socketid and returns a WebRTC Peer
  //  *
  //  * @param  {string} userId Represents who will receive the offer
  //  * @returns {RTCPeerConnection} peer
  //  */

  // const createPeerConnection = () => {
  //   // We create a RTC Peer Connection
  //   const connection = new RTCPeerConnection(ICE_SERVERS);

  //   // We implement our onicecandidate method for when we received a ICE candidate from the STUN server
  //   connection.onicecandidate = handleICECandidateEvent;

  //   // We implement our onTrack method for when we receive tracks
  //   connection.ontrack = handleTrackEvent;
  //   return connection;

  // };

  // const handleReceivedOffer = (offer: any) => {
  //   if (!hostRef.current) {
  //     rtcConnectionRef.current = createPeerConnection();
  //     rtcConnectionRef.current.addTrack(
  //       userStreamRef.current.getTracks()[0],
  //       userStreamRef.current,
  //     );
  //     rtcConnectionRef.current.addTrack(
  //       userStreamRef.current.getTracks()[1],
  //       userStreamRef.current,
  //     );
  //     rtcConnectionRef.current.setRemoteDescription(offer);

  //     rtcConnectionRef.current
  //       .createAnswer()
  //       .then((answer: any) => {
  //         rtcConnectionRef.current.setLocalDescription(answer);
  //         socketRef.current.emit('answer', answer, roomName);
  //       })
  //       .catch((error: any) => {
  //         console.log(error);
  //       });
  //   }
  // };

  // const handleAnswer = (answer: any) => {
  //   rtcConnectionRef.current
  //     .setRemoteDescription(answer)
  //     .catch((err: any) => console.log(err));
  // };

  // const handleICECandidateEvent = (event: any) => {
  //   if (event.candidate) {
  //     socketRef.current.emit('ice-candidate', event.candidate, roomName);
  //   }
  // };

  // const handlerNewIceCandidateMsg = (incoming: any) => {
  //   // We cast the incoming candidate to RTCIceCandidate
  //   const candidate = new RTCIceCandidate(incoming);
  //   console.log(candidate);
  //   rtcConnectionRef.current
  //     .addIceCandidate(candidate)
  //     .catch((e: any) => console.log(e));
  // };

  // const handleTrackEvent = (event: any) => {
  //   // eslint-disable-next-line prefer-destructuring
  //   peerVideoRef.current.srcObject = event.streams[0];
  // };

  // const toggleMediaStream = (type: any, state: any) => {
  //   userStreamRef.current.getTracks().forEach((track: any) => {
  //     if (track.kind === type) {
  //       // eslint-disable-next-line no-param-reassign
  //       track.enabled = !state;
  //     }
  //   });
  // };

  // // const toggleMic = () => {
  // //   toggleMediaStream('audio', micActive);
  // //   setMicActive((prev) => !prev);
  // // };

  // const toggleCamera = () => {
  //   toggleMediaStream('video', cameraActive);
  //   setCameraActive((prev) => !prev);
  // };

  // const leaveRoom = () => {
  //   socketRef.current.emit('leave', roomName); // Let's the server know that user has left the room.

  //   if (userVideoRef.current.srcObject) {
  //     userVideoRef.current.srcObject.getTracks().forEach((track: any) => track.stop()); // Stops receiving all track of User.
  //   }
  //   if (peerVideoRef.current.srcObject) {
  //     peerVideoRef.current.srcObject
  //       .getTracks()
  //       .forEach((track: any) => track.stop()); // Stops receiving audio track of Peer.
  //   }

  //   // Checks if there is peer on the other side and safely closes the existing connection established with the peer.
  //   if (rtcConnectionRef.current) {
  //     rtcConnectionRef.current.ontrack = null;
  //     rtcConnectionRef.current.onicecandidate = null;
  //     rtcConnectionRef.current.close();
  //     rtcConnectionRef.current = null;
  //   }
  //   router.push('/')
  // };

  return (
    <div>
      <div id="main-container">
        <button onClick={() => startVideo()} className="outlined-button">Start</button>
        <button onClick={() => stopVideo()} className="outlined-button">Stop</button>
        <button type="button" onClick={() => connect()} className="outlined-button">Connect</button>
        <button type="button" onClick={() => hangUp()} className="outlined-button">Hang Up</button>
        <section className="video">
          <video id="local-video" autoPlay ref={localVideoRef}></video>
          <div id="remote-videos">
            {
              remoteVideos.map((vRef: any) => {
                return <video autoPlay ref={vRef}></video>
              })
            }
          </div>
        </section>
      </div>
    </div>
  );
};

export default Room;