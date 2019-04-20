
let jwt = require('jsonwebtoken');
let config = require("./config")
const fs   = require('fs');

var verifyOptions = {
    expiresIn:  config.EXPIRE_TIME,
    algorithm:  [config.ALGO]
};

var publicKEY  = fs.readFileSync('./src/public.key', 'utf8');

let checkToken = (req, res, next) => {
  let token = req.headers['x-access-token'] || req.headers['authorization']; // Express headers are auto converted to lowercase
  if (token.startsWith('Bearer ')) {
    // Remove Bearer from string
    token = token.slice(7, token.length);
  }

  if (token) {
    jwt.verify(token, publicKEY, verifyOptions, (err, decoded) => {
      if (err) {
        return res.json({
          success: false,
          message: 'Token is not valid'
        });
      } else {
        req.decoded = decoded;
        next();
      }
    });
  } else {
    return res.json({
      success: false,
      message: 'Auth token is not supplied'
    });
  }
};

module.exports = {
  checkToken: checkToken
}