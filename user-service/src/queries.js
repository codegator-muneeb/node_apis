const Config = require('./config');

const Pool = require('pg').Pool
const pool = new Pool({
    user: 'postgres',
    host: Config.HOST,
    database: Config.DB,
    password: Config.PWD,
    port: Config.PORT,
})

const addUser = (request, response) => {
    //console.log(request.body);
    const { empid, rfid, finger, firstName, lastName, email, phone1,
        phone2, dob, gender, bloodGroup, city, country, pincode,
        employeeType, account, division, unit, team, department,
        permission, deviceList, address } = request.body

    //console.log(deviceList);
    const companyCode = String(request.params.companyCode);

    var deviceListString = `INSERT INTO ${companyCode}.ep_empDeviceRel(emp_id, device_id) VALUES`
    for (var device of deviceList) {
        deviceListString += ` ('${empid}', '${device}'),`;
    }
    deviceListString = deviceListString.slice(0, -1)

    var query = `INSERT INTO ${companyCode}.ep_empDetails(emp_id,rfid,fingerprint_id,first_name,last_name,email,phone_1,phone_2,
                dob,gender,blood_group,city,country,pin_code,emp_type,account_id,
                unit_id,division_id,dept_id,team_id,permissions_id,address) VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, to_date($9,'YYYYMMDD'), $10, $11, $12, $13, $14,
                $15, $16, $17, $18, $19, $20, $21, $22)`;
    pool.query(query, [empid, rfid, finger, firstName, lastName, email, phone1,
        phone2, dob, gender, bloodGroup, city, country, pincode,
        employeeType, account, unit, division, department, team,
        permission, address], (error, results) => {
            if (error) {
                //console.log(error);
                response.sendStatus(500);
            } else {
                addUserDeviceRel(deviceListString)
                    .then(result => {

                        addToLoginTable(empid, email, dob, companyCode)
                            .then(result1 => {

                                addToMasterLogin(email, companyCode)
                                    .then(result2 => {
                                        //console.log(result2);
                                        response.sendStatus(200)
                                    },
                                        err2 => {
                                            //console.log("Master: " + err2);
                                            response.sendStatus(500)
                                        })
                            },
                                err1 => {
                                    //console.log("Login Table: " + err1);
                                    response.sendStatus(500)
                                })

                    },
                        err => {
                            //console.log("EmpDev: " +err);
                            response.sendStatus(500)
                        }
                    )
            }
        })
}

function addToLoginTable(empid, email, dob, companyCode) {
    return new Promise((res, rej) => {
        var query = `INSERT INTO ${companyCode}.ep_login (emp_id, username, password, email, company_code)
        VALUES($1, $2, $3, $2, $4)`

        pool.query(query, [empid, email, dob, companyCode], (error, results) => {
            if (error) {
                return rej("Failed");
            } else {
                return res("Passed");
            }
        })
    })
}

function addToMasterLogin(email, companyCode) {
    return new Promise((res, rej) => {
        var query = `INSERT INTO ep_masterLogin (email, company_code)
        VALUES($1, $2)`

        pool.query(query, [email, companyCode], (error, results) => {
            if (error) {
                return rej("Failed");
            } else {
                return res("Passed");
            }
        })
    })
}

function addUserDeviceRel(query) {
    return new Promise((res, rej) => {
        //console.log(query);
        pool.query(query, (error, results) => {
            if (error) {
                return rej("Failed");
            } else {
                return res("Passed");
            }
        })
    });
}

const deleteUsers = (request, response) => {
    //console.log(request.body);
    const { companyCode, users } = request.body;
    var userListString = "";
    for (var user of users) {
        userListString += `'${user}',`;
    }
    userListString = userListString.slice(0, -1)

    var query = `DELETE FROM ${companyCode}.ep_empDetails where emp_id IN (${userListString})`;
    pool.query(query, (error, results) => {
        if (error) {
            response.sendStatus(500);
        } else {
            deleteUserDeviceRel(userListString, companyCode)
                .then(result => {
                    //console.log(result);
                    response.sendStatus(200)
                },
                    err => {
                        //console.log(err);
                        response.sendStatus(500)
                    }
                )
        }
    })
};

function deleteUserDeviceRel(userListString, companyCode) {
    return new Promise((res, rej) => {
        var query = `DELETE FROM ${companyCode}.ep_empDeviceRel where emp_id IN (${userListString})`;
        //console.log(query);
        pool.query(query, (error, results) => {
            if (error) {
                return rej("Failed");
            } else {
                return res("Passed");
            }
        })
    });
}

const updateUser = (request, response) => {
    const { companyCode, empid, rfid } = request.body;
    var query = `UPDATE ${companyCode}.ep_empDetails SET rfid = $1 WHERE emp_id = $2`;
    pool.query(query, [rfid, empid], (error, results) => {
        if (error) {
            response.sendStatus(500);
        } else {
            response.sendStatus(200);
        }
    })
};

const enableUser = (request, response) => {
    const { companyCode, empid, flag } = request.body;
    var query = `UPDATE ${companyCode}.ep_empDetails SET enabled = $1 WHERE emp_id = $2`;
    pool.query(query, [flag, empid], (error, results) => {
        if (error) {
            response.sendStatus(500);
        } else {
            response.sendStatus(200);
        }
    })
};

const getUserDeviceList = (request, response) => {
    const { companyCode, empid } = request.body;
    var query = `SELECT name, A.device_id from ${companyCode}.ep_empDeviceRel A, ep_deviceDetails B
                 WHERE A.device_id = B.deviceId
                 AND emp_id = $1`;
    pool.query(query, [empid], (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getAllUsers = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT C.emp_id, C.first_name, C.last_name 
                FROM ${companyCode}.ep_empDetails C`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getEmpTypes = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_empTypes`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getAccounts = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_accounts`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getDivisions = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_divisions`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getUnits = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_units`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getDepts = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_depts`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getPermissions = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_permissions`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getTeams = (request, response) => {
    const companyCode = String(request.params.companyCode);
    var query = `SELECT id, name FROM ${companyCode}.ep_teams`;
    pool.query(query, (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

const getTeamMembers = (request, response) => {
    const { companyCode, managerid } = request.body
    var query = `SELECT C.emp_id, C.first_name, C.last_name 
                FROM ${companyCode}.ep_empDetails C, ${companyCode}.ep_empManager D
                WHERE C.emp_id = D.emp_id AND D.manager_id = $1`;
    pool.query(query, [managerid], (error, results) => {
        if (error) {
            console.error(error)
            response.sendStatus(500);
        } else {
            response.json(results.rows);
        }
    })
};

module.exports = {
    deleteUsers,
    updateUser,
    enableUser,
    getUserDeviceList,
    getAllUsers,
    addUser,
    getAccounts,
    getEmpTypes,
    getDivisions,
    getUnits,
    getDepts,
    getPermissions,
    getTeamMembers
}