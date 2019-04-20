const express = require('express');
const bodyparser = require('body-parser');
const config = require("./config")
const app = express();
const port = 3000;
const mqtt = require('./mqtt-service')

/* For allowing cross domain requests
*/
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}
app.use(allowCrossDomain);

// /* Setting the timeout of the connection as 20 secs
// */
// app.use(function(req, res, next){
//     res.setTimeout(6000, function(){
//         console.log('Request has timed out.');
//             res.sendStatus(408);
//         });

//     next();
// });

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true, }));


app.listen(port, () => {
    console.log(`App is running on port ${port}`);
});

/* Routes assigned to their handlers, Sync Device is pending
*/
app.get('/mqtt/scan/:companyCode', mqtt.ScanHardware)
app.post('/mqtt/add_user', mqtt.AddUser);
app.post('/mqtt/reg_device', mqtt.RegisterDevice)
app.post("/mqtt/del_user", mqtt.DeleteUser)
app.post("/mqtt/enable_user", mqtt.EnableUser)
app.post("/mqtt/enable_dev", mqtt.EnableDevice)
app.post("/mqtt/dev_status", mqtt.GetDeviceStatus)
app.post("/mqtt/reset_dev", mqtt.ResetDevice)
app.post("/mqtt/wifi_update", mqtt.UpdateWifi)
app.post("/mqtt/update_user", mqtt.UpdateUser)

app.get('/', (request, response) => {
    response.json({info: 'Mqtt Service Running'});
});