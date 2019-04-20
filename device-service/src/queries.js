const Config = require('./config');

const Pool = require('pg').Pool
const pool = new Pool({
  user: 'doadmin',
  host: Config.HOST,
  database: Config.DB,
  password: Config.PWD,
  port: Config.PORT,
})

const getRegDevices = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var accountCode = companyCode.substr(0, 5);
  console.log(accountCode);
  var query = `SELECT a.deviceId, name from ep_deviceDetails a, ep_devCompanyRel b
               where a.deviceId = b.deviceId and b.company_code LIKE '${accountCode}%' and registered = 1`;
  pool.query(query, (error, results) => {
    if (error) {
      response.sendStatus(500)
    }
    response.json(results.rows)
  })
};

const getUnRegDevices = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var accountCode = companyCode.substr(0, 5);
  var query = `SELECT a.deviceId, name from ep_deviceDetails a, ep_devCompanyRel b
               where a.deviceId = b.deviceId and b.company_code LIKE '${accountCode}%' and registered = 0`;
  pool.query(query, (error, results) => {
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
    } else {
      addInDevCompanyRel(deviceId, companyCode)
        .then((result) => {
          response.sendStatus(200)
        },
          err => response.sendStatus(500))
    }
  })
}

const addInDevCompanyRel = (deviceId, companyCode) => {
  return new Promise((res, rej) => {
    var query = `INSERT INTO ep_devCompanyRel VALUES($1, $2)`
    pool.query(query, [deviceId, companyCode], (error, results) => {
      if (error) {
        return rej("Failed")
      } else {
        return res("Passed")
      }
    })
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
    } else {
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