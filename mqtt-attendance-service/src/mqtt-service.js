var config = require('./config');

var options = {
    host: config.HOST,
    username: config.USER,
    password: config.PWD,
    port: config.PORT,
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: false,
    encoding: 'utf8',
}

/* Utility Function
** Converts hexadecimal buffer to string
*/
function hexToString(str) {
    var msg = Buffer.from(str, 'hex');
    return msg.toString('utf8');
}

/* Adds a user to the database and intimates other devices as well
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const AddUser = (request, response) => {
    try {
        var mqtt = require('mqtt')
        options.clientId = 'mqttjs_' + Math.random().toString();
        var { userDetails, deviceIds } = request.body;
        var rfidString = "";
        var fingerString = "";
        for (var user of userDetails) {
            rfidString = user.rfid !== "" ? rfidString + `${user.rfid}-1-${user.empid},` : rfidString;
            fingerString = user.fingerid !== "" ? fingerString + `${user.fingerid}-1-${user.empid},` : fingerString;
        }
        var msgToPublish = `[EMP_ADD]RFID=${rfidString};`;
        msgToPublish = fingerString !== "" ? msgToPublish + `FINGER=${fingerString};` : msgToPublish;

        console.log(msgToPublish);

        var client = mqtt.connect(config.HOST, options)
        var success = false;
        setTimeout(function () {
            if (!success) {
                client.end();
                response.sendStatus(408);
            }
        }, config.TIMEOUT);

        client.on("connect", function () {
            console.log("Connected to the broker")
        });

        client.on("error", function (error) {
            console.log("Can't connect to the broker.\n Error:" + error);
            response.sendStatus(500);
            process.exit(1)
        });

        var topicsToSubscribe = [];

        for (var device of deviceIds) {
            var topicToPublish = `${device}/ServerToDevice`;
            var topicToSubscribe = `${device}/DeviceToServer`;
            client.publish(topicToPublish, msgToPublish);
            topicsToSubscribe.push(topicToSubscribe);
        }

        client.subscribe(topicsToSubscribe, { qos: 2 });

        client.on('message', function (topic, message, packet) {
            messageString = hexToString(message);
            var payload = JSON.parse(messageString);
            console.log(payload);
            var action = payload.CMD;
            var code = payload.CODE;
            var status = payload.STATUS;
            var msg = payload.MSG;

            if (action === "EMP_ADD") {
                success = true
                if (code === 0) {
                    var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                    client.publish(publishingTopic, '[NOP]');
                    console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                    response.sendStatus(200);
                } else {
                    console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                    response.sendStatus(500);
                }
                client.end()
            }
        });
    } catch (error) {
        console.log("[ADD USER]: Error Occured: " + error);
    }
};

/* Deletes a user in the database and intimates other devices as well
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const DeleteUser = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    const { userDetails, deviceIds } = request.body
    var rfidString = "";
    var fingerString = "";
    for (var user of userDetails) {
        rfidString = user.empid !== "" ? rfidString + `${user.empid},` : rfidString;
        fingerString = user.empid !== "" ? fingerString + `${user.empid},` : fingerString;
    }
    var msgToPublish = `[EMP_DEL]RFID=${rfidString};`;
    //INtegrate when you have to do for finger
    //msgToPublish = fingerString !== "" ? msgToPublish + `FINGER=${fingerString};` : msgToPublish;

    console.log(msgToPublish);

    var client = mqtt.connect(config.HOST, options)
    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    var topicsToSubscribe = [];

    for (var device of deviceIds) {
        var topicToPublish = `${device}/ServerToDevice`;
        var topicToSubscribe = `${device}/DeviceToServer`;
        client.publish(topicToPublish, msgToPublish);
        topicsToSubscribe.push(topicToSubscribe);
    }

    client.subscribe(topicsToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "EMP_DEL") {
            success = true;
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                response.sendStatus(200);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                response.sendStatus(500);
            }
        }
        client.end()
    });
};

/* Enable or Disable a user
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const EnableUser = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    const { userDetails, deviceIds, userAction } = request.body;
    var operation = userAction === true ? "[EMP_ACT]" : "[EMP_DACT]";
    var rfidString = "";
    var fingerString = "";
    for (var user of userDetails) {
        rfidString = user.empid !== "" ? rfidString + `${user.empid},` : rfidString;
        fingerString = user.empid !== "" ? fingerString + `${user.empid},` : fingerString;
    }
    var msgToPublish = `${operation}RFID=${rfidString};`;
    //Finger removed as of now
    //msgToPublish = fingerString !== "" ? msgToPublish + `FINGER=${fingerString};` : msgToPublish;

    console.log(msgToPublish);

    var client = mqtt.connect(config.HOST, options)

    client.on("connect", function () {
        console.log("Connected to the broker")
    });
    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    var topicsToSubscribe = [];

    for (var device of deviceIds) {
        var topicToPublish = `${device}/ServerToDevice`;
        var topicToSubscribe = `${device}/DeviceToServer`;
        client.publish(topicToPublish, msgToPublish);
        topicsToSubscribe.push(topicToSubscribe);
    }

    client.subscribe(topicsToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "EMP_ACT" || action === "EMP_DACT") {
            success = true;
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                response.sendStatus(200);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                response.sendStatus(500);
            }
        }
        client.end()
    });
};

/* Enables/Disables a device
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const EnableDevice = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    const { deviceId, flag } = request.body
    console.log(request.body);
    var operation = flag === true ? "1" : "0";
    var msgToPublish = `[DEV_EN]ENABLE=${operation};`;

    console.log(msgToPublish);

    var client = mqtt.connect(config.HOST, options)

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });
    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    var topicToPublish = `${deviceId}/ServerToDevice`;
    var topicToSubscribe = `${deviceId}/DeviceToServer`;

    client.publish(topicToPublish, msgToPublish);

    client.subscribe(topicToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "DEV_EN") {
            success = true;
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                response.sendStatus(200);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                response.sendStatus(200);
            }
        }
        client.end()
    });
}

/* Returns Status of a device as a JSON object
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const GetDeviceStatus = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    const { deviceId } = request.body
    var msgToPublish = "[STAT]";

    var client = mqtt.connect(config.HOST, options)
    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    var topicToPublish = `${deviceId}/ServerToDevice`;
    var topicToSubscribe = `${deviceId}/DeviceToServer`;

    client.publish(topicToPublish, msgToPublish);

    client.subscribe(topicToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var messageJson = JSON.stringify(payload.MSG);

        if (action === "STAT") {
            success = true
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                client.end()
                response.json(messageJson)
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + status);
                response.sendStatus(500);
            }
        }
        client.end()
    });
}

/* Resets a device
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const ResetDevice = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    const { deviceId } = request.body
    var msgToPublish = "[RST]";

    console.log(msgToPublish);

    var client = mqtt.connect(config.HOST, options)
    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    var topicToPublish = `${deviceId}/ServerToDevice`;
    var topicToSubscribe = `${deviceId}/DeviceToServer`;

    client.publish(topicToPublish, msgToPublish);

    client.subscribe(topicToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "RST") {
            success = true
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                response.sendStatus(200);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                response.sendStatus(500);
            }
        }
        client.end()
    });
}

/* Updates a WIFI
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const UpdateWifi = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    const { ssid, password, deviceIds } = request.body
    var msgToPublish = `[WIFI]NET_SSID=${ssid};NET_PASS=${password};`;

    console.log(msgToPublish);

    var client = mqtt.connect(config.HOST, options)

    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    var topicsToSubscribe = [];

    for (var device of deviceIds) {
        var topicToPublish = `${device}/ServerToDevice`;
        var topicToSubscribe = `${device}/DeviceToServer`;
        client.publish(topicToPublish, msgToPublish);
        topicsToSubscribe.push(topicToSubscribe);
    }

    client.subscribe(topicsToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "WIFI") {
            success = true
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                response.sendStatus(200);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                response.sendStatus(500);
            }
        }
        client.end()
    });
}

/* Syncs data from one device to another; 10 records per frame
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
async function SyncDevice(userDetails, deviceIds, currentFrame, totalFrames) {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    return new Promise((res, rej) => {
        var rfidString = "";
        var fingerString = "";
        for (var user of userDetails) {
            rfidString = user.rfid !== "" ? rfidString + `${user.rfid}-1-${user.empid},` : rfidString;
            fingerString = user.fingerid !== "" ? fingerString + `${user.fingerid}-1-${user.empid},` : fingerString;
        }
        var msgToPublish = `[SYNC]Frame=${currentFrame}/${totalFrames};RFID=${rfidString};`;
        msgToPublish = fingerString !== "" ? msgToPublish + `FINGER=${fingerString};` : msgToPublish;

        console.log(msgToPublish);

        var client = mqtt.connect(config.HOST, options)

        client.on("connect", function () {
            console.log("Connected to the broker")
        });

        client.on("error", function (error) {
            console.log("Can't connect to the broker.\n Error:" + error);
            process.exit(1)
        });

        var topicsToSubscribe = [];

        for (var device of deviceIds) {
            var topicToPublish = `${device}/ServerToDevice`;
            var topicToSubscribe = `${device}/DeviceToServer`;
            client.publish(topicToPublish, msgToPublish);
            topicsToSubscribe.push(topicToSubscribe);
        }

        client.subscribe(topicsToSubscribe, { qos: 2 });

        client.on('message', function (topic, message, packet) {
            messageString = hexToString(message);
            var payload = JSON.parse(messageString);
            console.log(payload);
            var action = payload.CMD;
            var code = payload.CODE;
            var status = payload.STATUS;
            var msg = payload.MSG;

            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log(`Frame ${currentFrame}/${totalFrames}` + " - Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                client.end();
                return res(status);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                client.end();
                return rej(status);
            }
        });
    });
};

/* Creates Frames; Records per frame - configurable
** Calls the SyncDevice function for each frame.
*/
async function CreateFrames(userDetails, deviceIds) {
    var recordCount = userDetails.length;
    var totalFrames = Math.ceil(recordCount / config.FRAME_SIZE);
    var resultReceived = true;
    var i = 0;

    while (resultReceived) {
        console.log("Frame " + (i + 1));
        var startIndex = config.FRAME_SIZE * i;
        var endIndex = Math.min(config.FRAME_SIZE * (i + 1), recordCount);
        currentFrameDetails = userDetails.slice(startIndex, endIndex);
        result = await SyncDevice(currentFrameDetails, deviceIds, i + 1, totalFrames);
        i = i + 1;

        if (i >= totalFrames) {
            resultReceived = false;
        }
    }
}

/* Updates the rfid, finger id of a user
** Publishes the msg, receives an acknowledgement and sends [NOP]
*/
const UpdateUser = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()

    console.log(request.body);

    const { userDetails, deviceIds } = request.body
    var rfidString = "";
    for (var user of userDetails) {
        rfidString = user.rfid !== "" ? rfidString + `${user.rfid}-${user.empid},` : rfidString;
    }
    var msgToPublish = `[EMP_UPDATE]RFID=${rfidString};`;

    console.log(msgToPublish);

    var client = mqtt.connect(config.HOST, options)
    var success = false;
    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    var topicsToSubscribe = [];

    for (var device of deviceIds) {
        var topicToPublish = `${device}/ServerToDevice`;
        var topicToSubscribe = `${device}/DeviceToServer`;
        client.publish(topicToPublish, msgToPublish);
        topicsToSubscribe.push(topicToSubscribe);
    }

    client.subscribe(topicsToSubscribe, { qos: 1 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "EMP_UPDATE") {
            success = true
            if (code === 0) {
                var publishingTopic = topic.substring(0, 29) + "/ServerToDevice";
                client.publish(publishingTopic, '[NOP]');
                console.log("Transaction Successful for device: " + topic.substring(0, 29) + " with status: " + status);
                response.sendStatus(200);
            } else {
                console.log("Error occurred. Operation Failed!\nError Message: " + msg);
                response.sendStatus(500);
            }
        }
        client.end();
    });
}

/* Scans the RFID/Fingerprint for the MQTT screens
** From Topic/DesktopToServer
*/
const ScanHardware = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    var companyCode = String(request.params.companyCode)
    var client = mqtt.connect(config.HOST, options)
    var success = false;

    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    client.on("close", function () {
        console.log("Closed connection");
    })

    var topicToSubscribe = `${companyCode}/DesktopToServer`;


    client.subscribe(topicToSubscribe, { qos: 0 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var rfid = payload.RFID;
        var finger = payload.FINGER;

        if (action === "DEV_SCAN") {
            success = true
            var responseJson = rfid !== "" ? { "rfid": rfid, "finger": "" } : { "rfid": "", "finger": finger }
            response.json(responseJson)
        }
        client.end();
    });
}

const RegisterDevice = (request, response) => {
    var mqtt = require('mqtt')
    options.clientId = 'mqttjs_' + Math.random().toString()
    console.log(request.body);
    const { deviceId, name } = request.body

    var client = mqtt.connect(config.HOST, options)

    var success = false;

    setTimeout(function () {
        if (!success) {
            client.end();
            response.sendStatus(408);
        }
    }, config.TIMEOUT);

    var msgToPublish = `[REG]DEVICE_NAME=${name};`;
    console.log(msgToPublish);

    client.on("connect", function () {
        console.log("Connected to the broker")
    });

    client.on("error", function (error) {
        console.log("Can't connect to the broker.\n Error:" + error);
        process.exit(1)
    });

    client.on("close", function () {
        console.log("Closed connection");
    })

    var topicToPublish = `${deviceId}/ServerToDevice`
    client.publish(topicToPublish, msgToPublish);

    var topicToSubscribe = `${deviceId}/DeviceToServer`;
    client.subscribe(topicToSubscribe, { qos: 2 });

    client.on('message', function (topic, message, packet) {
        messageString = hexToString(message);
        var payload = JSON.parse(messageString);
        console.log(payload);
        var action = payload.CMD;
        var code = payload.CODE;
        var status = payload.STATUS;
        var msg = payload.MSG;

        if (action === "REG") {
            success = true;
            if (code === 0) {
                client.publish(topicToPublish, '[NOP]')
                response.sendStatus(200);
            } else {
                console.log(status + msg);
                response.sendStatus(500);
            }
        }
        client.end();
    });
}

module.exports = {
    AddUser,
    DeleteUser,
    EnableUser,
    EnableDevice,
    GetDeviceStatus,
    ResetDevice,
    UpdateWifi,
    CreateFrames,
    UpdateUser,
    ScanHardware,
    RegisterDevice
}

//ScanHardware("C0001");
// AddUser([{empid:"123", rfid:"123", fingerid:"123"}, {empid:"456", rfid:"456", fingerid:"456"}],["ZWINPL-0003-00001-0001-032019"]);
// DeleteUser([{empid:"123"}, {empid:"456"}],["ZWINPL-0003-00001-0001-032019"]);
// EnableUser([{empid:"123"}, {empid:"456"}],["ZWINPL-0003-00001-0001-032019"], true);
// EnableUser([{empid:"123"}, {empid:"456"}],["ZWINPL-0003-00001-0001-032019"], false);
// EnableDevice("ZWINPL-0003-00001-0001-032019",true);
// EnableDevice("ZWINPL-0003-00001-0001-032019",false);
// GetDeviceStatus("ZWINPL-0003-00001-0001-032019");
// ResetDevice("ZWINPL-0003-00001-0001-032019");
// UpdateWifi("123456","SalmanGandu",["ZWINPL-0003-00001-0001-032019"]);
// CreateFrames([{empid:"123", rfid:"123", fingerid:"123"}, {empid:"456", rfid:"456", fingerid:"456"}, {empid:"789", rfid:"789", fingerid:"789"}, {empid:"123", rfid:"123", fingerid:"123"}, {empid:"456", rfid:"456", fingerid:"456"}, {empid:"789", rfid:"789", fingerid:"789"}], ["ZWINPL-0003-00001-0001-032019"]);
// UpdateUser([{empid:"123", rfid:"123"}, {empid:"456", rfid:"456"}], ["ZWINPL-0003-00001-0001-032019"]);
