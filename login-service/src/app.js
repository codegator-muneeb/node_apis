const express = require('express');
const bodyParser = require('body-parser');
let jwt = require('jsonwebtoken');
let config = require('./config');
let middleware = require('./verify');
const fs = require('fs');
const Pool = require('pg').Pool
const pool = new Pool({
    user: 'doadmin',
    host: config.HOST,
    database: config.DB,
    password: config.PWD,
    port: config.PORT,
})

var signOptions = {
    expiresIn: config.EXPIRE_TIME,
    algorithm: config.ALGO
};

var privateKEY = fs.readFileSync('./src/private.key', 'utf8');

/* status = 0, internal error
** status = 1, not found
** status = 2, password not matching
** status = 3, success 
*/

class HandlerGenerator {
    static checkCredentials(username, companyCode, password) {
        return new Promise((res, rej) => {
            var query = `SELECT username, email, password, company_code, emp_id, role from ${companyCode}.ep_login WHERE username = $1`;
            pool.query(query, [username], (error, results) => {
                if (error) {
                    console.error(error)
                    return rej({ status: 0 });
                } else {
                    if (results.rowCount === 0) {
                        return rej({ status: 1 })
                    }
                    else {
                        if (results.rows[0].password === password) {
                            var dataFromDb = results.rows[0];
                            var dataToReturn = {
                                username: dataFromDb.username,
                                email: dataFromDb.email,
                                companyCode: dataFromDb.company_code,
                                empid: dataFromDb.emp_id,
                                role: dataFromDb.role
                            }
                            return res({ status: 3, data: dataToReturn })
                        }
                        else {
                            return rej({ status: 2 })
                        }
                    }
                }
            })
        })
    }

    static getCompanyCode(email) {
        return new Promise((res, rej) => {
            var query_cCode = `select company_code from ep_masterLogin where email = $1`

            pool.query(query_cCode, [email], (error, results) => {
                if (error) {
                    return rej("")
                } else {
                    if (results.rowCount === 0) {
                        return rej("")
                    } else {
                        return res(results.rows[0].company_code)
                    }
                }
            })
        })
    }

    login(req, res) {
        let email = req.body.email;
        let password = req.body.password;
        var username = email;
        //let role = "admin";
        // For the given username fetch user from DB

        HandlerGenerator.getCompanyCode(email)
            .then(companyCode => {
                if (username && password && companyCode !== "") {
                    HandlerGenerator.checkCredentials(username, companyCode, password)
                        .then(result => {
                            console.log(result)
                            if (result.status === 3) {
                                let token = jwt.sign(result.data, privateKEY, signOptions);
                                // return the JWT token for the future API calls
                                res.json({
                                    success: true,
                                    message: 'Authentication successful!',
                                    token: token
                                });
                            } else {
                                res.sendStatus(403)
                            }
                        })
                        .catch(error => {
                            console.log(error);
                            res.sendStatus(500)
                        })
                }
            })
            .catch(error => {
                console.log("[LOGIN SERVICE] Error occured for email: " + email);
                res.sendStatus(500)
            })
    }

    index(req, res) {
        res.json({
            success: true,
            message: 'Login Service Running'
        });
    }
}

// Starting point of the server
function main() {
    let app = express(); // Export app for other routes to use
    let handlers = new HandlerGenerator();
    const port = config.API_PORT;
    app.use(bodyParser.urlencoded({ // Middleware
        extended: true
    }));
    app.use(bodyParser.json());

    var allowCrossDomain = function (req, res, next) {
        res.header('Access-Control-Allow-Origin', "*");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
    }
    app.use(allowCrossDomain);

    // Routes & Handlers
    app.post('/login', handlers.login);
    app.get('/', middleware.checkToken, handlers.index);
    app.listen(port, () => console.log(`Server is listening on port: ${port}`));
}

main();