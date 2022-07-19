// Websocket mantains open channels.
// Info via JSON messages

// calls maps callcode to {
//                           caller: connection,
//                           receiver: connection,
// }

const calls = new Map();
const port = process.env.PORT || 3000;

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

  // ping
  setInterval(
    () =>
      wss.clients.forEach((client) =>
        sendMessage(client, {
          type: "ping",
        })
      ),
    5000
  );

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
      do var generatedCode = generateCode();
      while (calls.has(generatedCode));

      // create a new call
      calls.set(generatedCode, { caller: connection });

      // send to the caller the generated call code
      let toSend = { type: "callCreated", callCode: generatedCode };
      sendMessage(connection, toSend);

      break;
    }
    // receiver
    case "searchCall": {
      let callData = calls.get(data.callCode);

      if (callData !== undefined) {
        // set the receiver of the calls only if no receiver is already present
        if (callData["receiver"] == undefined) {
          callData["receiver"] = connection;

          // advise the caller that someone want to partecipate
          let toSend = {
            type: "callJoined",
            callCode: data.callCode,
          };

          sendMessage(callData["caller"], toSend);
        }
      } else {
        // advise the receiver the call with that code is not found
        let toSend = {
          type: "callNotFound",
          callCode: data.callCode,
        };

        sendMessage(connection, toSend);
      }
      break;
    }
    // caller
    case "offer": {
      // get the receiver of the call
      let receiver = calls.get(data.callCode)["receiver"];

      // forward the offer
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

    // receiver
    case "answer": {
      // get the caller of the call
      let caller = calls.get(data.callCode)["caller"];

      // forward the answer
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

    // caller send its ICEs via this
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

    // receiver send its ICEs via this
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
  console.log("connection closed");
}

function errorHandler() {
  console.log("Some error occured");
}

function sendMessage(conn, jsonMsg) {
  if (jsonMsg.type != "ping") console.log(`SENDING ${JSON.stringify(jsonMsg)}`);
  conn.send(JSON.stringify(jsonMsg));
}

function generateCode() {
  return (Math.random() + 1).toString(36).substring(2, 7).toUpperCase();
}

init();
