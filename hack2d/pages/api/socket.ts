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
      console.log('[message] ',message.from,' -> ', message.sendto, ' : ', message.type)
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
  });
  return res.end();
};

export default SocketHandler;