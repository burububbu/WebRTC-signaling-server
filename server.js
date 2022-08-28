// Websocket keeps the channels open
// Messages are in JSON format.

// calls contains the calls that are active right now and maps
// the CALL CODE to the dict {caller: connection, receiver: connection}
const calls = new Map();

const port = process.env.PORT || 3000;

// The format of sent and received message is
//     {
//         type;
//         callCode;
//         answer;
//         offer;
//         candidate;
//         sdpMid;
//         sdpMLineIndex;
//     }

function init() {
  const WebSocketServer = require("ws").Server;

  const wss = new WebSocketServer({ port: port });
  console.log(`Websocket server is running on port ${port}`);

  // set a ping interval in order to keep alive the connection
  setInterval(
    () =>
      wss.clients.forEach((client) =>
        sendMessage(client, {
          type: "ping",
        })
      ),
    5000
  );

  // when a new client connects to the server, add event listeners to the connection object
  wss.on("connection", (connection) => connectionHandler(connection));
}

function connectionHandler(connection) {
  console.log("New client connected!");

  // all connections have the same handlers
  connection.on("message", (msg) => messageHandler(connection, msg));
  connection.on("close", closeHandler);
  connection.on("error", errorHandler);
}

// parse messages received and do actions based on Type field
function messageHandler(connection, msg) {
  var data = {};

  // check that the message is in a valid JSON format
  try {
    data = JSON.parse(msg);
  } catch (err) {
    console.log(` Invalid JSON received from a client.\nERROR:\n${err}`);
  }

  // switch based on the Type field of the received JSON
  switch (data.type) {
    // msg sent by the CALLER in order to get a call CODE from the server
    case "startCall": {
      do var generatedCode = generateCode();
      while (calls.has(generatedCode));

      // create a new call
      calls.set(generatedCode, { caller: connection });

      // send to the CALLER the generated call CODE
      let toSend = { type: "callCreated", callCode: generatedCode };
      sendMessage(connection, toSend);

      break;
    }

    // msg sent by the RECEIVER in order to join a call with a specific CODE
    case "searchCall": {
      let callData = calls.get(data.callCode);

      if (callData !== undefined) {
        // set the receiver of the calls only if no receiver is already present
        if (callData["receiver"] == undefined) {
          callData["receiver"] = connection;

          // warn the caller that someone is joining the call
          let toSend = {
            type: "callJoined",
            callCode: data.callCode,
          };

          sendMessage(callData["caller"], toSend);
        }
      } else {
        // advise the receiver the call with a specific code is not found
        let toSend = {
          type: "callNotFound",
          callCode: data.callCode,
        };

        sendMessage(connection, toSend);
      }
      break;
    }
    // msg sent by the CALLER to communicate its SDP offer to the RECEIVER.
    // SDP is the standard describing a peer-to-peer connection.
    case "offer": {
      // get the connection server-RECEIVER of the call
      let receiver = calls.get(data.callCode)["receiver"];

      // forward the offer to the receiver
      if (receiver !== undefined) {
        let toSend = {
          type: "offer",
          callCode: data.callCode,
          offer: data.offer,
        };

        sendMessage(receiver, toSend);
      }

      break;
    }

    // msg sent by the RECEIVER to communicate its SDP answer to the CALLER.
    case "answer": {
      // get the server-caller connection of the call
      let caller = calls.get(data.callCode)["caller"];

      // forward the answer to the caller
      if (caller !== undefined) {
        let toSend = {
          type: "answer",
          callCode: data.callCode,
          answer: data.answer,
        };

        sendMessage(caller, toSend);
      }

      break;
    }

    // msg sent by CALLER to communicate a ICE candidate to the RECEIVER
    case "ICECaller": {
      let receiver = calls.get(data.callCode)["receiver"];

      if (receiver != undefined) {
        let toSend = {
          type: "ICECaller",
          callCode: data.callCode,
          candidate: data.candidate,
          sdpMid: data.sdpMid,
          sdpMLineIndex: data.sdpMLineIndex,
        };

        sendMessage(receiver, toSend);
      }

      break;
    }

    // msg sent by RECEIVER to communicate a ICE candidate to the CALLER
    case "ICEReceiver": {
      let caller = calls.get(data.callCode)["caller"];

      let toSend = {
        type: "ICEReceiver",
        callCode: data.callCode,
        candidate: data.candidate,
        sdpMid: data.sdpMid,
        sdpMLineIndex: data.sdpMLineIndex,
      };

      sendMessage(caller, toSend);

      break;
    }

    default: {
      break;
    }
  }
}

function closeHandler() {
  console.log("Connection closed");
}

function errorHandler() {
  console.log("Some error occured");
}

function sendMessage(conn, jsonMsg) {
  // if (jsonMsg.type != "ping") console.log(`SENDING ${JSON.stringify(jsonMsg)}`);
  conn.send(JSON.stringify(jsonMsg));
}

function generateCode() {
  // generate a random call CODE
  return (Math.random() + 1).toString(36).substring(2, 7).toUpperCase();
}

init();
