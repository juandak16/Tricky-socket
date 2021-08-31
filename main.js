// express for creating the server
import express from "express";
// enable http communcation
import http from "http";
// create and manage sockets
import io from "socket.io";

import uuidv1 from "uuid/v1";

const app = express();

const httpServer = http.createServer(app);

const socketIo = io(httpServer);

let count_o = 0;
let count_x = 0;
let caract = '';
let users = {};
let game = {  
  playerWaiting: undefined,
  playerOne: undefined,
  playerOneAddress: undefined,
  PlayerOneStatus: undefined,
  playerTwo: undefined,
  playerTwoAddress: undefined,
  PlayerTwoStatus: undefined,
  tablero : [
    [
      null,
      null,
      null,
    ],
    [
      null,
      null,
      null,
    ],
    [
      null,
      null,
      null,
    ]
  ],
  turn: 1,
  end: false,
  gameStatus: {
    status: "waiting players"
  }
};

var count_user = 0;

app.get("/", (req, res) => {
  res.send("<h1>Hello im the socket sever, I'm runing happily</h1>");
});

socketIo.on("connection", socket => {
  var address = socket.request.connection.remoteAddress.substr(7);
  console.log('New connection from:    ' + address);
  
  // update users array adding the new user
  users = { ...users, [socket.id]: { 
    name: "",
    address: address
 } };
  // broadcast users to all clients
  socketIo.emit("user_update", users);
  checkReconnection(address,socket.id);
  // broadcast games to current users
  socketIo.emit("game_update", game);

  socket.on("disconnect", function() {
    console.log(`user have disconnected: ${socket.id}`);
    // removing the user that is disconnecting
    if( game.playerOne === socket.id){
      game = {
        playerWaiting: game.playerOneAddress,
        playerOne: undefined,
        playerOneAddress: undefined,
        PlayerOneStatus: 'waiting',
        playerTwo: game.playerTwo,
        playerTwoAddress: game.playerTwoAddress,
        PlayerTwoStatus: 'playing',
        tablero : game.tablero,
        turn: game.turn,
        end: game.end,
        gameStatus: {
          status: "waiting player one"
        }};
    }
    if( game.playerTwo === socket.id){
      game = {  
        playerWaiting: game.playerTwoAddress,
        playerOne: game.playerOne,
        playerOneAddress: game.playerOneAddress,
        PlayerOneStatus: 'playing',
        playerTwo: undefined,
        playerTwoAddress: undefined,
        PlayerTwoStatus: 'waiting',
        tablero : game.tablero,
        turn: game.turn,
        end: game.end,
        gameStatus: {
          status: "waiting player one"
        }};
    }
    

    delete users[socket.id];

    count_user--;

    // broadcast games to current users
    socketIo.emit("game_update", game);

    // broadcast users to all clients
    socketIo.emit("user_update", users);
  });

  socket.on("name_update", user_name => {
    // update user name
    users = {
      ...users,
      [socket.id]: {
        ...users[socket.id],
        name: user_name,
        userStatus: {
          status: "waiting"
        }
      }
    };

    // broadcast users to all clients
    socketIo.emit("user_update", users);
  });

  socket.on("new_client", (socket) => {
    check_ip(socket);
  });

  socket.on('join_game', data => {
    if(game.playerOne !== undefined){
      game = {
        ...game,
        playerTwo: data.userKey,
        playerTwoAddress: users[data.userKey].address,
        PlayerTwoStatus: 'playing',
      }
    }else{
      game = {
        ...game,
        playerOne: data.userKey,
        playerOneAddress: users[data.userKey].address,
        PlayerOneStatus: 'playing',
      }
    }
    // broadcast games to current users
    socketIo.emit("game_update", game);
  });

  socket.on('leave_game', data => {
    if(data.game.playerOne === data.userKey){
      delete game.playerOne;
    }
    if(data.game.playerTwo === data.userKey){
      delete game.playerTwo;
    }
    delete_game();
    // broadcast games to current users
    socketIo.emit("game_update", game);
  });

  socket.on('move_game', data => {
    counting_moves();
    if(game.turn === 1){
      if(game.tablero[data.posi][data.posj] === null){
        if(count_x < 3){
          game.tablero[data.posi][data.posj] = {jugador: 'X'};
          checkVictory(data.posi,data.posj);
          game.turn = 2;
        }
      }else{
        if(game.tablero[data.posi][data.posj].jugador === 'X'){
          if(count_x === 3){
            game.tablero[data.posi][data.posj] = null;
          }
        }
      }
    }else{
      if(game.tablero[data.posi][data.posj] === null){
        if(count_o < 3){
          game.tablero[data.posi][data.posj] = {jugador: 'O'};
          checkVictory(data.posi,data.posj);
          game.turn = 1;
        }
      }else{
        if(game.tablero[data.posi][data.posj].jugador === 'O'){
          if(count_o === 3 ){
            game.tablero[data.posi][data.posj] = null;
          }
        }
      }
    }
    socketIo.emit("game_update", game);
  });

  socket.on('rest_game', () => {
    game = {  
      playerWaiting: undefined,
      playerOne: game.playerOne,
      playerOneAddress: game.playerOneAddress,
      PlayerOneStatus: 'playing',
      playerTwo: game.playerTwo,
      playerTwoAddress: game.playerTwoAddress,
      PlayerTwoStatus: 'playing',
      tablero : [
        [
          null,
          null,
          null,
        ],
        [
          null,
          null,
          null,
        ],
        [
          null,
          null,
          null,
        ]
      ],
      turn: 1,
      end: false,
      gameStatus: {
        status: "playing"
      }};
    socketIo.emit("game_update", game);
  });


});

const counting_moves = () => {
  count_x = 0;
  count_o = 0;
  game.tablero.map(
    function(linea, i) {
      linea.map(
        function (casilla, j) {
          if(game.tablero[i][j] !== null){
            if(game.tablero[i][j].jugador === 'X'){
              count_x++;
            }
            if(game.tablero[i][j].jugador === 'O'){
              count_o++;
            }
          }
        }
      )
    }
  )
};

const check_ip = (socket) => {
  var cont =0;
  Object.keys(users).map(key => {
    if(users[key].address == users[socket].address){
      cont++
    }
  });
  //permite 1 conexiones por ip
  if(cont > 1){
    console.log('repetido');
    socketIo.emit("disconnect",socket);
  }
}
const checkReconnection = (address,socket) => {
  if(game.playerWaiting === address){
    if(game.PlayerOneStatus === 'waiting'){
      game = {  
        playerOne: socket,
        playerOneAddress: address,
        playerTwo: game.playerTwo,
        playerTwoAddress: game.playerTwoAddress,
        tablero : game.tablero,
        turn: game.turn,
        end: game.end,
        gameStatus: {
          status: "playing"
        }};
    }
    if(game.PlayerTwoStatus === 'waiting'){
      game = {  
        playerOne: game.playerOne,
        playerOneAddress: game.playerOneAddress,
        playerTwo: socket,
        playerTwoAddress: address,
        tablero : game.tablero,
        turn: game.turn,
        end: game.end,
        gameStatus: {
          status: "playing"
        }};
    }
    socketIo.emit("game_update", game);
  }
}
const checkVictory= (posi,posj) => {
  caract = '';
  caract = game.turn === 1 ? 'X' : 'O';

  for(let i=-1; i<2; i++){
    for(let j=-1; j<2; j++){
      if(posi+i >=0 && posj+j >= 0 && posi+i<=2 && posj+j <= 2){
        if(i !== 0 || j !== 0){
          if(game.tablero[posi+i][posj+j] !== null){
            if(game.tablero[posi+i][posj+j].jugador === caract){


              //reviso la misma direccion
              if(posi+i+i >=0 && posj+j+j >= 0 && posi+i+i<=2 && posj+j+j <= 2){
                if(game.tablero[posi+i+i][posj+j+j] !== null){
                  if(game.tablero[posi+i+i][posj+j+j].jugador === caract){
                    if(game.turn === 1){
                      game.end = true;
                    }else{
                      game.end = true;
                    }
                  }
                }
              }
              //reviso direccion contraria
              if(posi-i >=0 && posj-j >= 0 && posi-i <=2 && posj-j <= 2){
                if(game.tablero[posi-i][posj-j] !== null){
                  if(game.tablero[posi-i][posj-j].jugador === caract){
                    if(game.turn === 1){
                      game.end = true;
                    }else{
                      game.end = true;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  socketIo.emit("game_update", game);

}

const delete_game= () => {
  game = {  
    playerWaiting: undefined,
    playerOne: undefined,
    playerOneAddress: undefined,
    PlayerOneStatus: undefined,
    playerTwo: undefined,
    playerTwoAddress: undefined,
    PlayerTwoStatus: undefined,
    tablero : [
      [
        null,
        null,
        null,
      ],
      [
        null,
        null,
        null,
      ],
      [
        null,
        null,
        null,
      ]
    ],
    turn: 1,
    end: false,
    gameStatus: {
      status: "waiting players"
    }};
}

const PORT = 8000;
httpServer.listen(PORT, () => {
  console.log(`listening on port ${PORT}`);
});
