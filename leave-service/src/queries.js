﻿const Config = require('./config');

const Pool = require('pg').Pool
const pool = new Pool({
  user: 'postgres',
  host: Config.HOST,
  database: Config.DB,
  password: Config.PWD,
  port: Config.PORT,
})

const getLeaveBalance = (request, response) => {
  console.log(request.body);
  const { companyCode, empid } = request.body;
  var query = `SELECT name, to_char(now(), '01/01/YYYY') as startDate, 
                to_char(now(), '31/12/YYYY') as endDate, entitlement, balance 
               FROM ${companyCode}.ep_leaveBalance A, ${companyCode}.ep_leaveTypes B 
               WHERE A.type_id = B.type_id
               AND emp_id = $1`;
  pool.query(query, [empid], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      console.log(results.rows);
      response.json(results.rows);
    }
  })
};

const getHolidayList = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var query = `SELECT title, to_char(occur_date, 'DD/MM/YYYY') as occur_date, type FROM ${companyCode}.ep_holidaylist order by id`;
  pool.query(query, (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      console.log(results.rows);
      response.json(results.rows)
    }
  })
};

const getLeaveOverview = (request, response) => {
  const { companyCode, empid } = request.body
  var query = `SELECT b.name, to_char(startDate, 'DD/MM/YYYY HH24:MI') as startDate, to_char(endDate, 'DD/MM/YYYY HH24:MI') as endDate, c.title as status, (EXTRACT(EPOCH FROM endDate - startDate)/3600)::Integer 
              as duration FROM ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_leaveTypes b, ep_leaveStatus c
              where a.type = b.type_id
              AND a.status = c.status
              AND emp_id = $1 order by created_on`;
  pool.query(query, [empid], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      response.json(results.rows)
    }
  })
}

/* 0 - Pending | 1 - Approved | -1 - Rejected 
*/
const getLeaveRequests = (request, response) => {
  console.log(request.body);
  const { companyCode, managerid, status } = request.body

  var query = `SELECT a.id, a.emp_id, concat_ws(' ', b.first_name, b.last_name) as fullname, a.type as typeid, c.name as type, to_char(a.startDate, 'DD/MM/YYYY HH24:MI') as startdate, 
              to_char(a.endDate, 'DD/MM/YYYY HH24:MI') as enddate, d.title as reqstatus, (EXTRACT(EPOCH FROM endDate - startDate)/3600)::Integer as duration 
              FROM ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_empDetails b, ${companyCode}.ep_leaveTypes c, ep_leaveStatus d 
              WHERE a.emp_id = b.emp_id
              AND a.type = c.type_id
              AND a.manager_id = $1
              AND a.status = $2
              AND a.status = d.status
              order by created_on`;

  pool.query(query, [managerid, status], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      console.log(results.rows);
      response.send(results.rows)
    }
  })
}

const approveRequest = (request, response) => {
  const { companyCode, id, empid, type } = request.body;

  var query = `UPDATE ${companyCode}.ep_leaveRequests SET status = 1 WHERE id = $1`;

  pool.query(query, [id], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      updateLeaveBalance(empid, type, -1, companyCode)
        .then(updateBalanceRes => {
          if (updateBalanceRes.result === 0) {
            console.log("Couldn't update leave balance for empid: " + empid);
            response.sendStatus(500);
          } else {
            response.sendStatus(200);
          }
        })
        .catch(error => {
          console.log(error);
          res.sendStatus(500)
        })
    }
  })
}

const rejectRequest = (request, response) => {
  const { companyCode, id, empid, type } = request.body;

  var query = `UPDATE ${companyCode}.ep_leaveRequests SET status = -1 WHERE id = $1`;

  getLeaveStatus(companyCode, id)
    .then(requestStatus => {
      if (requestStatus.result === 0) {
        console.log("Couldn't get leave status for id: " + id);
        response.sendStatus(500);
      } else if (requestStatus.data === 1) {
        pool.query(query, [id], (error, results) => {
          if (error) {
            console.log(error);
            response.sendStatus(500);
          } else {
            updateLeaveBalance(empid, type, 1, companyCode)
              .then(updateBalanceRes => {
                if (updateBalanceRes.result === 0) {
                  console.log("Couldn't update leave balance for empid: " + empid);
                  response.sendStatus(500);
                } else {
                  response.sendStatus(200);
                }
              })
              .catch(error => {
                console.log(error);
                res.sendStatus(500)
              })
          }
        })
      } else {
        pool.query(query, [id], (error, results) => {
          if (error) {
            console.log(error);
            response.sendStatus(500);
          } else {
            response.sendStatus(200);
          }
        })
      }
    })
    .catch(error => {
      console.log(error);
      res.sendStatus(500)
    })

}

/* dateFormat : yyyy-mm-dd hh:mm:ss
*/
const submitRequest = (request, response) => {
  const { companyCode, type, empid, startDate, endDate, managerid } = request.body;

  var query = `INSERT INTO ${companyCode}.ep_leaveRequests (type, emp_id, startDate, endDate, manager_id)
              VALUES ($1, $2, $3, $4, $5)`;

  pool.query(query, [type, empid, startDate, endDate, managerid], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      response.sendStatus(200);
    }
  })
}

/* Utility Function
** Returns status of a leave
*/
const getLeaveStatus = (companyCode, id) => {
  return new Promise((res, rej) => {
    var query = `select status from ${companyCode}.ep_leaveRequests where id = ${id}`;
    console.log(query);
    pool.query(query, (error, results) => {
      console.log(results.rows);
      if (error) {
        return rej({ result: 0 });
      } else {
        if (results.rowCount === 0) {
          return rej({ result: 0 })
        } else {
          return res({ result: 1, data: results.rows[0].status })
        }
      }
    })
  })
}

const getAbbreviations = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var query = `SELECT short_name, long_name FROM ${companyCode}.ep_abbr`;
  pool.query(query, (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      response.json(results.rows)
    }
  })
}

const getLegend = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var query = `SELECT color, description FROM ${companyCode}.ep_legend`;
  pool.query(query, (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      response.json(results.rows)
    }
  })
}

/* Utility Function
** updates leave balance in case of approve/reject request
*/
const updateLeaveBalance = (empid, typeid, days, companyCode) => {
  return new Promise((res, rej) => {

    var query = `UPDATE ${companyCode}.ep_leaveBalance SET balance = balance  + ${days}
                where emp_id = $1 and type_id = $2`;
    pool.query(query, [empid, typeid], (error, results) => {
      if (error) {
        return rej({ result: 0 });
      } else {
        return res({ result: 1 })
      }
    })
  })
}

const getDayStatus = (request, response) => {
  
  var { companyCode, empid } = request.body
  const date = String(request.params.date);
  var holiday_query = `select title from ${companyCode}.ep_holidayList 
                        where to_date(to_char(occur_date, 'YYYYMMDD'), 'YYYYMMDD') = to_date($1, 'YYYYMMDD')
                        and type = 'Mandatory'`

  pool.query(holiday_query, [date], (error, results) => {
    if (error) {
      response.sendStatus(500);
    } else {
      if (results.rowCount > 0) {
        response.json({
          category: "Holiday",
          type: results.rows[0].title,
          hours: 0
        })
      } else {

        var leave_query = `select b.name from ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_leaveTypes b
        where emp_id = $1
        and a.type = b.type_id
        and to_date(to_char(startdate, 'YYYYMMDD'), 'YYYYMMDD') <= to_date($2, 'YYYYMMDD')
        and to_date(to_char(enddate, 'YYYYMMDD'), 'YYYYMMDD') >= to_date($2, 'YYYYMMDD')
        and status = 1`;

        pool.query(leave_query, [empid, date], (error, results) => {
          if (error) {
            nextStep = false
            response.sendStatus(500);
          } else {
            if (results.rowCount > 0) {
              nextStep = false
              response.json({
                category: "Leave",
                type: results.rows[0].name,
                hours: 0
              })
            } else {

              var time_query = `select (EXTRACT(EPOCH FROM b.time - a.time)/3600)::decimal(9,2) as duration from (select time from ${companyCode}.ep_entryLogs
                where emp_id = $1 AND action = 'EMP_CHECKIN'
                AND to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = to_date($2, 'YYYYMMDD')
                order by time
                FETCH FIRST 1 ROW ONLY) a
                ,
                (select time from ${companyCode}.ep_entryLogs
                where emp_id = $1 AND action = 'EMP_CHECKOUT'
                AND to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = to_date($2, 'YYYYMMDD')
                order by time desc
                FETCH FIRST 1 ROW ONLY) b`;

              pool.query(time_query, [empid, date], (error, results) => {
                if (error) {
                  response.sendStatus(500);
                } else {
                  if (results.rowCount > 0) {
                    nextStep = false
                    response.json({
                      category: "Working",
                      type: "",
                      hours: results.rows[0].duration
                    })
                  } else {
                    response.sendStatus(404);
                  }
                }
              })
            }
          }
        })
      }
    }
  })
}
 
const getDayInfo = (request, response) => {
  
  var { companyCode, empid } = request.body
  const date = String(request.params.date);
  var holiday_query = `select title from ${companyCode}.ep_holidayList 
                        where to_date(to_char(occur_date, 'YYYYMMDD'), 'YYYYMMDD') = to_date($1, 'YYYYMMDD')
                        and type = 'Mandatory'`

  pool.query(holiday_query, [date], (error, results) => {
    if (error) {
      response.sendStatus(500);
    } else {
      if (results.rowCount > 0) {
        response.json({
          category: "Holiday",
          type: results.rows[0].title,
          hours: []
        })
      } else {

        var leave_query = `select b.name from ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_leaveTypes b
        where emp_id = $1
        and a.type = b.type_id
        and to_date(to_char(startdate, 'YYYYMMDD'), 'YYYYMMDD') <= to_date($2, 'YYYYMMDD')
        and to_date(to_char(enddate, 'YYYYMMDD'), 'YYYYMMDD') >= to_date($2, 'YYYYMMDD')
        and status = 1`;

        pool.query(leave_query, [empid, date], (error, results) => {
          if (error) {
            nextStep = false
            response.sendStatus(500);
          } else {
            if (results.rowCount > 0) {
              nextStep = false
              response.json({
                category: "Leave",
                type: results.rows[0].name,
                hours: []
              })
            } else {

              var time_query = `select 'Working' as category, action as type, to_char(time, 'HH24:MI:SS') as hours from ${companyCode}.ep_entryLogs
                where emp_id = $1
                AND to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = to_date($2, 'YYYYMMDD')
                order by time`;

              pool.query(time_query, [empid, date], (error, results) => {
                if (error) {
                  response.sendStatus(500);
                } else {
                  if (results.rowCount > 0) {
                    nextStep = false
                    response.json({
                      category: "Working",
                      type: "",
                      hours: results.rows
                    })
                  } else {
                    response.sendStatus(404);
                  }
                }
              })
            }
          }
        })
      }
    }
  })
}

  // console.log("exited");

  // if (nextStep === true) {
  //   console.log("entered Here");
  //   var leave_query = `select b.name from ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_leaveTypes b
  //                     where emp_id = $1
  //                     and a.type = b.type_id
  //                     and to_date(to_char(startdate, 'YYYYMMDD'), 'YYYYMMDD') <= to_date($2, 'YYYYMMDD')
  //                     and to_date(to_char(enddate, 'YYYYMMDD'), 'YYYYMMDD') >= to_date($2, 'YYYYMMDD')
  //                     and status = 1`;

  //   pool.query(leave_query, [empid, date], (error, results) => {
  //     if (error) {
  //       nextStep = false
  //       response.sendStatus(500);
  //     } else {
  //       if (results.rowCount > 0) {
  //         nextStep = false
  //         response.json({
  //           category: "Leave",
  //           type: results.rows[0].name,
  //           hours: 0
  //         })
  //       } else {
  //         nextStep = true;
  //       }
  //     }
  //   })

  // }

  // if (nextStep) {
  //   console.log("Here aswell")
  //   var time_query = `select (EXTRACT(EPOCH FROM b.time - a.time)/3600)::decimal(9,2) as duration from (select time from ${companyCode}.ep_entryLogs
  //                     where emp_id = $1 AND action = 'EMP_CHECKIN'
  //                     AND to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = to_date($2, 'YYYYMMDD')
  //                     order by time
  //                     FETCH FIRST 1 ROW ONLY) a
  //                     ,
  //                     (select time from ${companyCode}.ep_entryLogs
  //                     where emp_id = $1 AND action = 'EMP_CHECKOUT'
  //                     AND to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = to_date($2, 'YYYYMMDD')
  //                     order by time desc
  //                     FETCH FIRST 1 ROW ONLY) b`;

  //   pool.query(time_query, [empid, date], (error, results) => {
  //     if (error) {
  //       response.sendStatus(500);
  //     } else {
  //       if (results.rowCount > 0) {
  //         nextStep = false
  //         response.json({
  //           category: "Working",
  //           type: "",
  //           hours: results.rows[0].duration
  //         })
  //       } else {
  //         response.sendStatus(404);
  //       }
  //     }
  //   })

  // }


module.exports = {
  getLeaveBalance,
  getHolidayList,
  getLeaveOverview,
  getLeaveRequests,
  approveRequest,
  rejectRequest,
  submitRequest,
  getAbbreviations,
  getLegend,
  getDayInfo
}