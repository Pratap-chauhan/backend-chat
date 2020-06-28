// Setup basic express server
var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

var numUsers = 0;
const connectionInfo = [];
allMessages = [];
io.on('connection', (socket) => {
  console.log("connected");
  var addedUser = false;

  socket.on('newMessage', (data) => {
    const { to, from, message } = data;
    allMessages.push(data);
    socket.broadcast.emit(`${String(to.id)}`, {
      event: 'newMessage',
      data
    });
  });

  socket.on('add user', (username) => {
    if (addedUser) return;
    socket.username = username;
    socket.id = Math.floor(Math.random() * (1000 - 10 + 1) + 10);
    const connectionId = Math.floor(Math.random() * (1000 - 10 + 1) + 10);
    const newUserInfo = {
      id: socket.id,
      name: username,
      connection: [{
        connectionId: connectionId,
        participants: [{
          id: socket.id,
          name: username,
        }]
      }],
    };
    const firstMessage = {
      from: {
        id: 0,
        name: 'Admin'
      },
      to: {
        id: connectionId,
        name: username
      },
      message: `Welcome onboard!, Your id is ${socket.id}`
    }
    allMessages.push(firstMessage);
    const sendUserInfo = { ...newUserInfo };
    sendUserInfo.messages = [firstMessage];
    connectionInfo.push(newUserInfo);
    ++numUsers;
    addedUser = true;
    socket.emit('login', sendUserInfo);
    socket.broadcast.emit('user joined', {
      username: socket.username,
      id: socket.id,
      numUsers: numUsers
    });
  });


  socket.on('searchUser', (data) => {
    const { searchId, from } = data;
    let eventData = [];
    if (!searchId) {
      const searchedData = connectionInfo.find((item) => item.id === from);
      eventData = searchedData.connection;
    } else {
      const findConnection = connectionInfo.find((item) => item.id == searchId);
      if (findConnection) {
        eventData.push({
          id: findConnection.id,
          name: findConnection.name
        });
      }
    }
    socket.emit(`${from}`, {
      event: 'searchUser',
      data: eventData
    });
  });

  socket.on('addParticipants' , (data) =>{
    const {from , groupId , participantId} = data;
    const checkParticipantId = connectionInfo.findIndex((item)=> item.id == participantId);
    console.log("addParticipantsStatusstart" , checkParticipantId , groupId);
    if(checkParticipantId === -1) {
      socket.emit(`${from}` ,{
        event : 'addParticipantsStatus',
        data : {
          status :404
        }, 
      });
      return;
    } 
    const {id , name } = connectionInfo[checkParticipantId];
    const senderIndex = connectionInfo.findIndex((item)=> item.id == from);
    const { connection } = connectionInfo[senderIndex];
    console.log("connection" , connection , senderIndex);
    const groupIdIndex = connection.findIndex((item)=> item.connectionId == groupId);
    socket.broadcast.emit(`${id}` , {
      event : 'newConnectionAdded',
      data : {
        connectionId : groupId,
        participants : connectionInfo[senderIndex].connection[groupIdIndex].participants
      }
    });
    connectionInfo[checkParticipantId].connection.push({
      connectionId : groupId , 
      participants : connectionInfo[senderIndex].connection[groupIdIndex].participants
    })
    connectionInfo[senderIndex].connection[groupIdIndex].participants.push({
      id , 
      name
    });
    socket.emit(`${groupId}` , {
      event : 'addParticipantsStatus',
      data : {
        status : 200 ,
        groupId , 
        participant:{
          id , name
        }
      }
    });
    console.log("addParticipantsStatusend")
  });

  socket.on('all data', (data) => {
    const { from, to } = data;
    const filterData = connectionInfo.find((item) => item.id == from);
    const sendUserInfo = { ...filterData };
    const filterMessage = allMessages.filter((item) => (item.to.id == to) || (item.to.id == to && item.from.id == 0));
    sendUserInfo.messages = filterMessage;
    socket.emit(`${from}`, {
      event: 'all data',
      data: sendUserInfo
    });
  });

  socket.on('selectConnection', (data) => {
    const { id, name, from } = data;
    const findConnectionIndex = connectionInfo.findIndex((item) => item.id == from);
    const connection = connectionInfo[findConnectionIndex].connection;
    const connectionExist = connection.findIndex((item) => item.id == id);
    const connectionId = Math.floor(Math.random() * (1000 - 10 + 1) + 10);
    const findReceiverIndex = connectionInfo.findIndex((item) => item.id == id);
    const newReceiverConnection = {
      connectionId,
      participants: [{
        id: from,
        name: connectionInfo[findConnectionIndex].name
      }]
    };
    connectionInfo[findReceiverIndex].connection.push(newReceiverConnection);
    const newCreatorConnection = {
      connectionId,
      participants: [{
        id: id,
        name: connectionInfo[findReceiverIndex].name
      }]
    };
    connectionInfo[findConnectionIndex].connection.push(newCreatorConnection);
    socket.broadcast.emit(`${id}`, {
      event: 'newConnectionAdded',
      data: newReceiverConnection
    });
    socket.emit(`${from}`, {
      event: 'newConnectionRequest',
      data: [newCreatorConnection]
    });
  });

  socket.on('connectionMessage', (data) => {
    const { connectionId, from } = data;
    const messages = fetchAllMessages(connectionId);
    socket.emit(`${from}`, {
      event: 'selectedConnMessage',
      data: messages
    });
  })


});


function fetchAllMessages(to) {
  let filterMessage = []
  filterMessage = allMessages.filter((data) => (data.to.id == to));
  return filterMessage;
}