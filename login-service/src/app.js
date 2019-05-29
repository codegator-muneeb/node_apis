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
    ssl: true
})

var signOptions = {
    expiresIn: config.EXPIRE_TIME,
    algorithm: config.ALGO
};

var verifyOptions = {
    expiresIn: config.EXPIRE_TIME,
    algorithm: [config.ALGO]
};

var privateKEY = fs.readFileSync('./src/private.key', 'utf8');
var publicKEY = fs.readFileSync('./src/public.key', 'utf8');

/* status = 0, internal error
** status = 1, not found
** status = 2, password not matching
** status = 3, success 
*/

class HandlerGenerator {

    static sendEmail(toEmail, sub, body) {
        return new Promise((res, rej) => {

            const mailgun = require("mailgun-js");
            const mg = mailgun({ apiKey: config.SMTP_API_KEY, domain: config.SMTP_DOMAIN });
            const data = {
                from: config.FROM_EMAIL,
                to: toEmail,
                subject: sub,
                html: body
            };
            mg.messages().send(data, function (error, body) {
                if (error) {
                    console.log(error)
                    return rej({
                        success: false
                    })
                }
                console.log(body)
                    return res({
                        success: true
                    })
            });
        })
    }

    requestPassword(req, res) {
        const { email } = req.body

        var query = `SELECT * FROM ep_masterLogin where email = '${email}'`;

        pool.query(query, (error, results) => {
            if (error) {
                res.sendStatus(500)
            } else {
                if (results.rowCount === 0) {
                    res.sendStatus(401)
                } else {
                    var json = results.rows[0];
                    let token = jwt.sign(json, privateKEY, signOptions);
                    let tokenBase64 = new Buffer(token).toString('base64');
                    var link = `${config.RESET_PWD_REDIRECT_URI}${encodeURIComponent(tokenBase64)}`

                    /*
                        let buff = new Buffer(data, 'base64');  
                        let text = buff.toString('ascii');
                    */

                    var subject = "Syncme Admin: Link for resetting your password";

                    var body = `Hi,<br><br>
                                To update your syncme account password, please click on this link:<br><br>
                                <a href="${link}">${link}</a>
                                <br><br>
                                In case you did not ask for this, no action is required.<br><br>
                                Regards,<br>
                                Synceme Team.`

                    HandlerGenerator.sendEmail(email, subject, body)
                        .then(response => {
                            if (response.success === true) {
                                res.json({ success: true, message: "Email sent successfully" });
                            } else {
                                res.sendStatus(200);
                            }
                        })
                        .catch(error => {
                            console.log(`[Reset Password Mail Error]: ${error}`);
                            res.sendStatus(500)
                        })
                }
            }
        })

    }

    resetPassword(req, res) {
        const { token, password } = req.body;

        var decodedToken = decodeURIComponent(token);

        let buff = new Buffer(decodedToken, 'base64');
        let tokenBase64 = buff.toString('ascii');

        jwt.verify(tokenBase64, publicKEY, verifyOptions, (err, tokenPayload) => {
            if (err) {
                console.log("Invalid Token");
                res.sendStatus(500);
            } else {
                var companyCode = tokenPayload.company_code;
                var email = tokenPayload.email;
                var query = `UPDATE ${companyCode}.ep_login SET password = $1 WHERE email = $2`

                pool.query(query, [password, email], (error, results) => {
                    if (error) {
                        console.log(error)
                        res.sendStatus(500);
                    } else {
                        res.status(200);
                        res.json({
                            success: true
                        })
                    }
                })
            }
        });
    }

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
                    console.log(error)

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
                console.log(companyCode)
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
                console.log(error);
                console.log("[LOGIN SERVICE] Error occured for email: " + email);
                res.sendStatus(500)
            })
        //

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
    let https = require('https');
    let fs = require('fs')
    let app = express(); // Export app for other routes to use
    let handlers = new HandlerGenerator();
    const port = config.API_PORT;
    app.use(bodyParser.urlencoded({ // Middleware
        extended: true
    }));
    app.use(bodyParser.json());

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

    // Routes & Handlers
    app.post('/login', handlers.login);
    app.post('/request-pwd', handlers.requestPassword);
    app.post('/reset-pwd', handlers.resetPassword);
    app.get('/', middleware.checkToken, handlers.index);
    
    // app.listen(port, () => console.log(`Server is listening on port: ${port}`));

    var server = https.createServer(options, app);

    server.listen(port, () => {
        console.log(`App is running on port ${port}`);
    });
}

main();