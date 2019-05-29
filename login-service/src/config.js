const HOST = 'syncme-db-do-user-5083956-0.db.ondigitalocean.com';
const DB = 'entry_point_db';
const PWD = 'x00suokhtm4xo568';
const PORT = 25060;
const API_PORT = 3005;
const EXPIRE_TIME = "4h"
const ALGO = "RS256"
const FROM_EMAIL = "no-reply@syncme.io";
const RESET_PWD_REDIRECT_URI = "https://www.syncme.io/#/auth/reset-password?token=";
const SMTP_DOMAIN = "syncme.io";
const SMTP_API_KEY = "key-a412b40b697ec30e8553f239a38c1246";


module.exports = {
    HOST,
    DB,
    PWD,
    PORT,
    API_PORT,
    EXPIRE_TIME,
    ALGO,
    FROM_EMAIL,
    RESET_PWD_REDIRECT_URI,
    SMTP_DOMAIN,
    SMTP_API_KEY
};