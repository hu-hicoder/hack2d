import { useRouter } from 'next/router';
import { createRef, forwardRef, RefObject, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Video from '../../component/Video';
import useSocket from '../../hooks/useSocket';

const ICE_SERVERS = {
  iceServers: [
    {
      urls: 'stun:stun.l.google.com:19302',
    }
  ],
};

type Meta = {
  id: string,
  srcObject: MediaStream
}

const Room = () => {
  useSocket();

  const router = useRouter();
  const socketRef: any = useRef();
  const { id: roomName } = router.query;
  // const [remoteVideos, setRemoteVideos] = useState<Meta[]>([]);
  // const [remotes,setRemotes] = useState(0);
  const remoteVideos = useRef<Meta[]>([]);
  remoteVideos.current = [];
  const [remotes, setRemotes] = useState(remoteVideos.current);
  let peerConnections: any = [];
  let localStream: any = null;
  const MAX_CONNECTIONS = 8;
  const localVideoRef: any = useRef(null);

  function messageToRoom(message: any) {
    socketRef.current.emit('message', message);
  }
  function callMe() {
    console.log('[callMe]')
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
    console.log('[sendSdp]', id, message)
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

  function attachRemoteVideo(id: string, stream: MediaStream) {
    console.log('[attachRemoteVideo]', stream);
    const metadata = {
      id: `video-tag-${id}`,
      srcObject: stream
    }
    console.log('[attachRemoteVideo]', metadata)
    console.log('[attachRemoteVideo]::before', remoteVideos.current)
    // setRemotes(prev => prev+1)
    remoteVideos.current.push(metadata)
    console.log('attachRemoteVideo::[array] = ', [...remotes, metadata])
    setRemotes(prev => { return [...prev, metadata] });
    console.log('[attachRemoteVideo]::after', remoteVideos.current)
    // console.log('[attachRemoteVideo]::[remotes]', remotes)
  }
  function isRemoteVideoAttached(id: string) {
    console.log('[isRemoteVideoAttached]', remoteVideos.current, id)
    remoteVideos.current.forEach(e => {
      Object.keys(e).forEach(key => {
        if (key === id) return true;
      })
    })
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
    localStream.getTracks().forEach((track: any) => {
      peer.addTrack(track, localStream);
    })

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
          stopConnection(from);
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
      .then(function (stream: any) {
        localStream = stream;
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.onloadedmetadata = () => {
          localVideoRef.current.play();
        };
        console.log('[startVideo] ', stream.getTracks()[0].getSettings());
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
    localStream.getTracks().forEach((track: any) => {
      track.stop();
    })
    localStream = null;

    // kill local video.
    localVideoRef.current.pause();
    localVideoRef.current.srcObject = null;
  }

  function connect() {
    console.log('[connect] ', remoteVideos.current);
    if (!isReadyToConnect()) {
      return;
    }
    if (!canConnect()) {
      return;
    }
    callMe();
  }

  return (
    <>
      {console.log('[remoteVideos] = ',remoteVideos)}
      {console.log('[remotes] = ',remotes)}
      <div>
        <div id="main-container">
          <button onClick={() => startVideo()} className="outlined-button">Start</button>
          <button onClick={() => stopVideo()} className="outlined-button">Stop</button>
          <button type="button" onClick={connect} className="outlined-button">Connect</button>
          <button type="button" onClick={() => hangUp()} className="outlined-button">Hang Up</button>
          {/* <button type="button" onClick={() => setRemotes(p => p+1)} className="outlined-button">Test {remotes}</button> */}
          <section className="video">
            <video id="local-video" autoPlay ref={localVideoRef}></video>
            {/* <video id="local-video-x" autoPlay ref={videoRef}></video> */}
            <div id="remote-videos">
              {
                remoteVideos.current.map(meta => {
                  return <Video props={meta}></Video>
                })
              }
            </div>
            <div id="remote-videos-remotes">
              {
                remotes.map(meta => {
                  return <Video props={meta}></Video>
                })
              }
            </div>
          </section>
        </div>
      </div>
    </>);
};

export default Room;