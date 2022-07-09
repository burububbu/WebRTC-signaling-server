// Websocket mantains open channels.
// Info via JSON messages

// calls maps callcode to {
//                           caller: connection,
//                           receiver: connection,
// }

const calls = new Map();
const port = 8080;

// struct Message
//     {
//         string type;
//         string callCode;
//         string answer;
//         string offer;
//         string candidate;
//         string sdpMid;
//         int sdpMLineIndex;
//     }

function init() {
  const WebSocketServer = require("ws").Server;

  const wss = new WebSocketServer({ port: port });
  console.log(`Websocket server is running on port ${port}`);

  // create a new connection for each connected user, each connection is a different object
  wss.on("connection", (connection) => connectionHandler(connection));
}

function connectionHandler(connection) {
  console.log("New client connected!");

  // all connections have the same handlers
  connection.on("message", (msg) => messageHandler(connection, msg));
  connection.on("close", closeHandler);
  connection.on("error", errorHandler);
}

function messageHandler(connection, msg) {
  var data = {};

  // server accepts only JSON messages
  try {
    data = JSON.parse(msg);
  } catch (err) {
    console.log(` Invalid JSON received from a client.\nERROR:\n${err}`);
  }

  // switch based on the type of the received json
  switch (data.type) {
    // caller
    case "startCall": {
      do {
        var generatedCode = generateCode();
      } while (calls.has(generatedCode));

      calls.set(generatedCode, { caller: connection });

      // send to the caller the generated call code
      sendMessage(connection, { type: "callCreated", callCode: generatedCode });
      break;
    }
    // receiver
    case "searchCall": {
      const callData = calls.get(data.callCode);

      if (callData != undefined) {
        // set the receiver of the calls
        calls.get(data.callCode)["receiver"] = connection;

        // advise the caller that someone want to partecipate
        const caller = calls.get(data.callCode)["caller"];

        sendMessage(caller, { type: "callJoined", callCode: data.callCode });
      } else {
        // advise the receiver the call with that code is not found
        sendMessage(connection, {
          type: "callNotFound",
          callCode: data.callCode,
        });
      }
      break;
    }
    // caller
    case "offer": {
      // get the receiver of the call
      const receiver = calls.get(data.callCode)["receiver"];

      // forward the offer
      if (receiver !== undefined)
        sendMessage(receiver, {
          type: "offer",
          callCode: data.callCode,
          offer: data.offer,
        });

      break;
    }

    // receiver
    case "answer": {
      // get the caller of the call
      const caller = calls.get(data.callCode)["caller"];

      // forward the answer
      if (caller !== undefined)
        sendMessage(caller, {
          type: "answer",
          callCode: data.callCode,
          answer: data.answer,
        });

      break;
    }

    // caller send its ICEs via this
    case "ICECaller": {
      let receiver = calls.get(data.callCode)["receiver"];
      sendMessage(receiver, {
        type: "ICECaller",
        callCode: data.callCode,
        candidate: data.candidate,
        sdpMid: data.sdpMid,
        sdpMLineIndex: data.sdpMLineIndex,
      });

      break;
    }

    // receiver send its ICEs via this
    case "ICEReceiver": {
      let caller = calls.get(data.callCode)["caller"];

      sendMessage(caller, {
        type: "ICEReceiver",
        callCode: data.callCode,
        candidate: data.candidate,
        sdpMid: data.sdpMid,
        sdpMLineIndex: data.sdpMLineIndex,
      });

      break;
    }

    default: {
      break;
    }
  }
}

function closeHandler() {
  console.log("connection closed");
}

function errorHandler() {
  console.log("Some error occured");
}

function sendMessage(conn, jsonMsg) {
  console.log(`SENDING ${JSON.stringify(jsonMsg)}`);
  conn.send(JSON.stringify(jsonMsg));
}

function generateCode() {
  return (Math.random() + 1).toString(36).substring(2, 7).toUpperCase();
}

init();
