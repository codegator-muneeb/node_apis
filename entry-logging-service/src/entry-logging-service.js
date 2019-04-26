var mqtt = require('mqtt')
var config = require('./config');
var topics = require('./TopicList');
const Pool = require('pg').Pool;

const pool = new Pool({
  user: 'doadmin',
  host: config.DBHOST,
  database: config.DB,
  password: config.DBPWD,
  port: config.DBPORT,
  ssl: true
})

var options = {
    host: config.HOST,
    clientId: 'mqttjs02',
    username: config.USER,
    password: config.PWD,
    port: config.PORT,
    protocolId: 'MQIsdp',
    protocolVersion: 3,
    clean: false,
    encoding: 'utf8',
    reconnectPeriod: 1000 * 1
}

function hexToString(str){
  var msg = Buffer.from(str, 'hex');
  return msg.toString('utf8');
}

var client = mqtt.connect(config.HOST, options)

client.on("connect", function(){
    console.log("Connected to the broker")
    client.subscribe(topics.TOPIC_TO_SUBCRIBE, { qos: config.QOS });
});

client.on("error", function(error){
    console.log("Can't connect to the broker.\n Error:" + error);
});

client.on('offline', function() {
    console.log("Register Device Service is offline");
});

client.on('reconnect', function() {
    console.log("Reconnecting to broker...");
});

client.on('message', function(topic, message, packet){
  try {
    messageString = hexToString(message);
    var payload = JSON.parse(messageString);
    var cmd = payload.CMD;
    if(cmd === "EMP_CHECKIN" || cmd === "EMP_CHECKOUT"){
      console.log("[Entry Logging Service]: Payload received: " + payload);
      var empid = payload.EMPID;
      var time = payload.TIME;
      makeDatabaseEntry(cmd, empid, time);
    }
  } catch(error){
    console.log("Error in json received:" + error);
  }

});

function makeDatabaseEntry(cmd, empid, timestamp){
  var schema = empid.substring(0,7);
  var query = `INSERT INTO ${schema}.ep_entryLogs values(DEFAULT, $1, $2, $3)`
  pool.query(query, [empid, cmd, timestamp], (error, results) => {
    if (error) {
      console.log("Error for " + empid + " " + error);
    }
    console.log("Entry Successful for EMP: " + empid);
  })
  
};

