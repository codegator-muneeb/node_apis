const express = require('express');
const bodyparser = require('body-parser');
const config = require("./config")
const app = express();
const port = config.API_PORT;
const db = require('./queries')
const https = require('https');
const fs = require('fs')

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true, }));

var key = fs.readFileSync('../ssl/syncme.key', 'utf8');
var cert = fs.readFileSync('../ssl/syncme.crt', 'utf8');
var options = {
    key: key,
    cert: cert
};

var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}
app.use(allowCrossDomain);

// app.listen(port, () => {
//     console.log(`App is running on port ${port}`);
// });

var server = https.createServer(options, app);

server.listen(port, () => {
    console.log(`App is running on port ${port}`);
});

app.get('/devices/get/reg/:companyCode', db.getRegDevices)
app.get('/devices/get/unreg/:companyCode', db.getUnRegDevices)
app.post('/devices/add', db.addNewDevice)
app.get('/devices/register/:deviceId', db.registerDevice)

app.get('/', (request, response) => {
    response.json({ info: 'Zerowav Device Service Running' });
});

