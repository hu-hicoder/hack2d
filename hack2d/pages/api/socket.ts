import { Server } from 'socket.io';

const SocketHandler = (req: any, res: any) => {
  if (res.socket.server.io) {
    console.log('Socket is already attached');
    return res.end();
  }

  const io = new Server(res.socket.server);
  res.socket.server.io = io;

  io.on("connection", (socket: any) => {
    console.log(`User Connected :${socket.id}`);

    socket.on('enter', function (roomName: string) {
      socket.join(roomName);
      console.log('id=' + socket.id + ', enter room:' + roomName);
      socket.roomname = roomName;
    });

    function broadcastMessage(type: any, message: any) {
      if (socket.roomname) {
        // ルーム内全員に送る
        socket.broadcast.to(socket.roomname).emit(type, message);
      } else {
        // ルーム未入室の場合は、全体に送る.
        socket.broadcast.emit(type, message);
      }
    }

    socket.on('message', function (message: any) {
      message.from = socket.id;

      let target = message.sendto;
      if (target) {
        // 特定の相手に送る場合.
        socket.to(target).emit('message', message);
        return;
      }

      broadcastMessage('message', message);
    });

    socket.on('disconnect', function () {
      console.log('id=' + socket.id + ' disconnect');
      broadcastMessage('user disconnected', { id: socket.id });

      if (socket.roomname) {
        socket.leave(socket.roomname);
      }
    });

  //   // Triggered when a peer hits the join room button.
  //   socket.on("join", (roomName) => {
  //     const { rooms } = io.sockets.adapter;
  //     const room = rooms.get(roomName);

  //     // room == undefined when no such room exists.
  //     if (room === undefined) {
  //       socket.join(roomName);
  //       socket.emit("created");
  //     } else {
  //       // room.size >= 1 when one person is inside the room.
  //       socket.join(roomName);
  //       socket.emit("joined");
  //     }
  //     console.log(rooms);
  //   });

  //   // Triggered when the person who joined the room is ready to communicate.
  //   socket.on("ready", (roomName) => {
  //     socket.broadcast.to(roomName).emit("ready"); // Informs the other peer in the room.
  //   });

  //   // Triggered when server gets an icecandidate from a peer in the room.
  //   socket.on("ice-candidate", (candidate: RTCIceCandidate, roomName: string) => {
  //     console.log(candidate);
  //     socket.broadcast.to(roomName).emit("ice-candidate", candidate); // Sends Candidate to the other peer in the room.
  //   });

  //   // Triggered when server gets an offer from a peer in the room.
  //   socket.on("offer", (offer, roomName) => {
  //     socket.broadcast.to(roomName).emit("offer", offer); // Sends Offer to the other peer in the room.
  //   });

  //   // Triggered when server gets an answer from a peer in the room.
  //   socket.on("answer", (answer, roomName) => {
  //     socket.broadcast.to(roomName).emit("answer", answer); // Sends Answer to the other peer in the room.
  //   });

  //   socket.on("leave", (roomName) => {
  //     socket.leave(roomName);
  //     socket.broadcast.to(roomName).emit("leave");
  //   });
  //   // socket.on("getIds", (roomName) => {
  //   //   const { rooms } = io.sockets.adapter;
  //   //   const room = rooms.get(roomName);
  //   //   console.log('emit', Array.from(room!))
  //   //   socket.broadcast.to(roomName).emit("sendIds",Array.from(room!))
  //   // })
  });
  return res.end();
};

export default SocketHandler;