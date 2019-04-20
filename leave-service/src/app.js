const express = require('express');
const bodyparser = require('body-parser');
const config = require("./config")
const app = express();
const port = config.API_PORT;
const db = require('./queries')
const https = require('https');
const fs = require('fs')

var key = fs.readFileSync('../ssl/syncme.key', 'utf8');
var cert = fs.readFileSync('../ssl/syncme.crt', 'utf8');
var options = {
    key: key,
    cert: cert
};

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true, }));

var allowCrossDomain = function(req, res, next) {
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

app.post('/leaves/balance', db.getLeaveBalance)
app.get('/leaves/holiday/:companyCode', db.getHolidayList)
app.post('/leaves/overview', db.getLeaveOverview);
app.post('/leaves/teamRequests', db.getLeaveRequests)
app.post('/leaves/approve', db.approveRequest)
app.post('/leaves/reject', db.rejectRequest)
app.post('/leaves/submit', db.submitRequest)
app.get('/leaves/abbr/:companyCode', db.getAbbreviations)
app.get('/leaves/legend/:companyCode', db.getLegend)
app.post('/leaves/dayStatus/:date', db.getDayInfo);

app.get('/', (request, response) => {
    response.json({info: 'Zerowav Leave Service Running'});
});

