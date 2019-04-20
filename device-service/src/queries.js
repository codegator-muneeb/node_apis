const Config = require('./config');

const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: Config.HOST,
  database: Config.DB,
  password: Config.PWD,
  port: Config.PORT,
})

const getRegDevices = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var query = `SELECT deviceId, name from ep_deviceDetails
               where company_code = $1 and registered = 1`;
  pool.query(query, [companyCode], (error, results) => {
    if (error) {
      response.sendStatus(500)
    }
    response.json(results.rows)
  })
};

const getUnRegDevices = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var query = `SELECT deviceId, name from ep_deviceDetails
               where company_code = $1 and registered = 0`;
  pool.query(query, [companyCode], (error, results) => {
    if (error) {
      response.sendStatus(500)
    }
    response.json(results.rows)
  })
};

const addNewDevice = (request, response) => {
    const { deviceId, alias, type, companyCode } = request.body;
    var query = `INSERT into ep_deviceDetails(deviceId, name, type, company_code)
                 VALUES($1, $2, $3, $4)`;
    pool.query(query, [deviceId, alias, type, companyCode], (error, results) => {
        if (error) {
            response.sendStatus(500)
        } else{
            response.sendStatus(200)
        }     
    })
}

const registerDevice = (request, response) => {
    const deviceId = String(request.params.deviceId);
    console.log(deviceId);
    var query = `UPDATE ep_deviceDetails SET registered = 1 
                 WHERE deviceId = $1`;
    pool.query(query, [deviceId], (error, results) => {
        if (error) {
            console.log(error);
            response.sendStatus(500)
        } else{
            response.sendStatus(200)
        }
    })
}

module.exports = {
    getRegDevices,
    addNewDevice,
    registerDevice,
    getUnRegDevices
}