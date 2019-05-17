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

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}
app.use(allowCrossDomain);

var key = fs.readFileSync('../ssl/syncme.key', 'utf8');
var cert = fs.readFileSync('../ssl/syncme.crt', 'utf8');
var options = {
    key: key,
    cert: cert
};

// app.listen(port, () => {
//     console.log(`App is running on port ${port}`);
// });

var server = https.createServer(options, app);

server.listen(port, () => {
    console.log(`App is running on port ${port}`);
});

app.post('/user/add/:companyCode', db.addUser)
app.get('/user/getAll/:companyCode', db.getAllUsers)
app.post('/user/delete', db.deleteUsers)
app.post('/user/deviceList', db.getUserDeviceList)
app.post('/user/update', db.updateUser)
app.post('/user/enable', db.enableUser)
app.get('/user/empTypes/:companyCode', db.getEmpTypes)
app.get('/user/account/:companyCode', db.getAccounts)
app.get('/user/division/:companyCode', db.getDivisions)
app.get('/user/unit/:companyCode', db.getUnits)
app.get('/user/dept/:companyCode', db.getDepts)
app.get('/user/permission/:companyCode', db.getPermissions)
app.post('/user/team', db.getTeamMembers)
app.get('/user/teams/:companyCode', db.getTeams);
app.post('/user/assignManager', db.assignManager)

app.get('/', (request, response) => {
    response.json({info: 'Zerowav User Service Running'});
});

