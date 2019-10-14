const Config = require('./config');
const moment = require('moment');

const Pool = require('pg').Pool
const pool = new Pool({
  user: Config.USER,
  host: Config.HOST,
  database: Config.DB,
  password: Config.PWD,
  port: Config.PORT,
  ssl: Config.SSL
})

const getLeaveTypes = (request, response) => {
  const companyCode = String(request.params.companyCode);
  var query = `SELECT type_id as id, name FROM ${companyCode}.ep_leaveTypes order by id`;
  pool.query(query, (error, results) => {
    if (error) {
      response.sendStatus(500);
    } else {
      response.json(results.rows)
    }
  })
}

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
  var query = `SELECT a.id as id, a.type as typeid, b.name, to_char(startDate, 'DD/MM/YYYY HH24:MI') as startDate, (select string_agg(email, ';') from ${companyCode}.ep_empDetails z where z.emp_id in (select manager_id from ${companyCode}.ep_leaveRequestManager lrm where lrm.id = a.id)) as email, to_char(endDate, 'DD/MM/YYYY HH24:MI') as endDate, c.title as status, (EXTRACT(EPOCH FROM endDate - startDate)/3600)::Integer 
              as duration, a.modified_by FROM ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_leaveTypes b, ep_leaveStatus c
              where a.type = b.type_id
              AND a.status = c.status
              AND emp_id = $1 order by created_on desc`;
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

  var query = `SELECT a.id, a.emp_id, concat_ws(' ', b.first_name, b.last_name) as fullname, b.email as email, a.type as typeid, c.name as type, to_char(a.startDate, 'DD/MM/YYYY HH24:MI') as startdate, 
              to_char(a.endDate, 'DD/MM/YYYY HH24:MI') as enddate, d.title as reqstatus, (EXTRACT(EPOCH FROM endDate - startDate)/3600)::Integer as duration 
              FROM ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_empDetails b, ${companyCode}.ep_leaveTypes c, ep_leaveStatus d, ${companyCode}.ep_leaveRequestManager e 
              WHERE a.emp_id = b.emp_id
              ANd a.id = e.id
              AND a.type = c.type_id
              AND e.manager_id = $1
              AND a.status = $2
              AND a.status = d.status
              order by created_on desc`;

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
  const { companyCode, id, empid, type, days, managerid } = request.body;

  var query = `UPDATE ${companyCode}.ep_leaveRequests SET status = 1, modified_by = '${managerid}' WHERE id = $1`;

  pool.query(query, [id], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      updateLeaveBalance(empid, type, -days, companyCode)
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
  const { companyCode, id, empid, type, days, managerid } = request.body;

  var query = `UPDATE ${companyCode}.ep_leaveRequests SET status = -1, modified_by = '${managerid}' WHERE id = $1`;

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
            updateLeaveBalance(empid, type, days, companyCode)
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
  const { companyCode, type, empid, startDate, endDate, managerids } = request.body;

  var query = `INSERT INTO ${companyCode}.ep_leaveRequests (type, emp_id, startDate, endDate)
              VALUES ($1, $2, $3, $4) RETURNING id`;

  pool.query(query, [type, empid, startDate, endDate], (error, results) => {
    if (error) {
      console.log(error);
      response.sendStatus(500);
    } else {
      console.log(results);
      var id = results.rows[0].id
      

      var managerList = "";
      for (var managerid of managerids) {
        managerList += `(${id}, '${managerid}'),`;
      }
      managerList = managerList.slice(0, -1)

      var managerQuery = `INSERT INTO ${companyCode}.ep_leaveRequestManager (id, manager_id) VALUES${managerList}`;

      pool.query(managerQuery, (managerError, magResults) => {
        if(error){
          console.log(managerError)
          response.sendStatus(500);
        } else {
          response.sendStatus(200);
        }
      })
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

    // var selectQuery = `SELECT * from ${companyCode}.ep_leaveBalance where emp_id = $1 and type_id = $2`

    // pool.query(selectQuery, [empid, typeid], (err, selectResults) => {
    //   if (selectResults.rowCount !== 0) {
    //     var query = `UPDATE ${companyCode}.ep_leaveBalance SET balance = balance  + ${days}
    //             where emp_id = $1 and type_id = $2`;
    //     pool.query(query, [empid, typeid], (error, results) => {
    //       if (error) {
    //         return rej({ result: 0 });
    //       } else {
    //         return res({ result: 1 })
    //       }
    //     })
    //   } else {
    //     var insertQuery = `INSERT into ${companyCode}.ep_leaveBalance `
    //   }
    // })

    return res({ result: 1 })
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
  var { companyCode, empid, date } = request.body
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

              var time_query = `select 'Working' as category, SUBSTRING(action, 10) as type, to_char(time, 'HH24:MI:SS') as hours, b.name as device
                from ${companyCode}.ep_entryLogs a, ep_deviceDetails b 
                where a.device_id = b.deviceId
                AND emp_id = $1
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

/*startDate and endDate in YYYYMMDD*/
const getOverAPeriodStatus = (request, response) => {
  var { companyCode, empid, startDate, endDate } = request.body

  var empids = [empid];

  // var query = `select startdate, enddate, category, type, time FROM
  //               (select to_char(occur_date, 'DD-MM-YYYY') as startDate, to_char(occur_date, 'DD-MM-YYYY') as endDate, 'Holiday' as category, title as type, 'Full Day' as time from ${companyCode}.ep_holidayList 
  //               where to_date(to_char(occur_date, 'YYYYMMDD'), 'YYYYMMDD') in
  //               (SELECT date_trunc('day', dd):: date
  //               FROM generate_series
  //                       ( '${startDate}'::timestamp 
  //                       , '${endDate}'::timestamp
  //                       , '1 day'::interval) dd
  //                       )
  //               and type = 'Mandatory'

  //               UNION

  //               select to_char(GREATEST(startdate, '${startDate}'::timestamp),'DD-MM-YYYY') as startdate, to_char(LEAST(enddate, '${endDate}'::timestamp), 'DD-MM-YYYY') as endDate, 
  //               'Leave' as category, b.name as type, text(DATE_PART('day',enddate-startdate)) || ' day(s)' as time 
  //               from ${companyCode}.ep_leaveRequests a, ${companyCode}.ep_leaveTypes b
  //               where emp_id = '${empid}'
  //               and a.type = b.type_id
  //               and status = 1
  //               and to_date(to_char(startdate, 'YYYYMMDD'), 'YYYYMMDD') in
  //               (SELECT date_trunc('day', dd):: date
  //               FROM generate_series('${startDate}'::timestamp , '${endDate}'::timestamp, '1 day'::interval) dd)

  //               UNION

  //               select to_char(tseries.dateObj, 'DD-MM-YYYY') as startDate, to_char(tseries.dateObj, 'DD-MM-YYYY') as enddate, 'Working' as category, 'IN OFFICE' as type, text((select sum(b.time - a.time) from
  //               (select time, row_number() over (order by time) as index from ${companyCode}.ep_entryLogs where action = 'EMP_CHECKIN'
  //               and to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = tseries.dateObj and emp_id = '${empid}' order by time) a,
  //               (select time, row_number() over (order by time) as index from ${companyCode}.ep_entryLogs where action = 'EMP_CHECKOUT'
  //               and to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = tseries.dateObj and emp_id = '${empid}' order by time) b
  //               where a.index = b.index
  //               and a.time < b.time
  //               group by to_date(to_char(a.time, 'YYYYMMDD'), 'YYYYMMDD'))) || ' hours' as time
  //               FROM (SELECT date_trunc('day', dd):: date as dateObj
  //               FROM generate_series
  //                       ( '${startDate}'::timestamp 
  //                       , '${endDate}'::timestamp
  //                       , '1 day'::interval) dd
  //                       ) tseries) MASTER
  //               ORDER BY to_date(startdate, 'DD-MM-YYYY')`




  // pool.query(query, (error, results) => {
  //   if (error) {
  //     console.log(error);
  //     response.sendStatus(500);
  //   } else {
  //     response.json(results.rows)
  //   }
  // })

  getWorkingTimeForEachDay(startDate, endDate, companyCode, empids)
    .then(result => {

      console.log(result);

      if (result.success === true) {
        var dataObj = result.data;
        var jsonToReturn = [];

        var dataRow = dataObj.find(obj => {
          return obj.empid === empid.substring(7)
        });

        if (typeof dataRow !== "undefined") {
          for (var entry of dataRow.data) {
            var category = entry.hours == 0 ? "-" : "Working";
            var type = entry.hours == 0 ? "-" : "In Office";
            var obj = {
              startdate: entry.date,
              enddate: entry.date,
              category: category,
              type: type,
              time: convertToHrsMinFormat(entry.hours) //`${entry.hours} hours`
            }
            jsonToReturn.push(obj);
          }
        } else {
          var obj = {
            startdate: moment(parseDate(startDate)).format('DD-MM-YYYY'),
            enddate: moment(parseDate(endDate)).format('DD-MM-YYYY'),
            category: "-",
            type: "-",
            time: "No data found"
          }
          jsonToReturn.push(obj);
        }

        response.json(jsonToReturn);
      }
    }
      , err => {
        console.log(err)
        response.sendStatus(500)
      })
}

function parseDate(str) {
  var y = str.substr(0, 4),
    m = str.substr(4, 2),
    d = str.substr(6, 2);
  return new Date(y, m, d);
}

const getManagerReportData = (request, response) => {

  const { startDate, endDate, empids, companyCode } = request.body;

  getWorkingTimeForEachDay(startDate, endDate, companyCode, empids)
    .then(result => {

      console.log(result);

      if (result.success === true) {
        var empIdList = "";
        for (var empid of empids) {
          empIdList += `'${empid}',`;
        }
        empIdList = empIdList.slice(0, -1)

        var query = `select SUBSTRING(A.emp_id, 8) as "Employee_ID", A.first_name || ' ' || A.last_name as "Name"
                  from ${companyCode}.ep_empDetails A
                  where A.emp_id in (${empIdList})`;

        pool.query(query, (error, names) => {
          if (error) {
            console.log(error);
            response.sendStatus(500);
          } else {
            var namesObj = names.rows;
            var dataObj = result.data;

            for (var row of namesObj) {
              var dataRow = dataObj.find(obj => {
                return obj.empid === row.Employee_ID
              });

              var data = typeof dataRow !== "undefined" ? dataRow.data : [];

              var totalHours = 0;

              if (data !== []) {
                for (var entry of data) {
                  totalHours = totalHours + Number(entry.hours);
                }
              }

              row.Total_Hours = convertToHrsMinFormat(totalHours);
            }

            response.json(namesObj);
          }
        })

      } else {
        response.sendStatus(500);
      }
    }
      , err => {
        console.log(err)
        response.sendStatus(500)
      })
}

const getManagerComprehensiveReport = (request, response) => {

  const { startDate, endDate, empids, companyCode } = request.body;

  console.log(`Request Body: ${startDate}, ${endDate}, ${empids}, ${companyCode}`);

  getWorkingTimeForEachDay(startDate, endDate, companyCode, empids)
    .then(result => {

      console.log(result);

      if (result.success === true) {
        var empIdList = "";
        for (var empid of empids) {
          empIdList += `'${empid}',`;
        }
        empIdList = empIdList.slice(0, -1)

        var query = `select SUBSTRING(A.emp_id, 8) as empid, A.first_name || ' ' || A.last_name as name
                  from ${companyCode}.ep_empDetails A
                  where A.emp_id in (${empIdList})`;

        pool.query(query, (error, names) => {
          if (error) {
            console.log(error);
            response.sendStatus(500);
          } else {
            var namesObj = names.rows;
            var dataObj = result.data;

            for (var row of namesObj) {
              var dataRow = dataObj.find(obj => {
                return obj.empid === row.empid
              });
              var data = typeof dataRow !== "undefined" ? dataRow.data : [];
              console.log(data);
              row.data = data;
            }

            response.json(namesObj);
          }
        })

      } else {
        response.sendStatus(500);
      }
    }
      , err => {
        console.log("Some Error occured: " + err)
        response.sendStatus(500)
      })
}


//const { startDate, endDate, companyCode, empids } = req.body;
const getWorkingTimeForEachDay = (startDate, endDate, companyCode, empids) => {
  return new Promise((res, rej) => {

    var empIdList = "";
    for (var empid of empids) {
      empIdList += `'${empid}',`;
    }
    empIdList = empIdList.slice(0, -1)

    var query = `select SUBSTRING(emp_id, 8) as empid, to_char(time, 'DD-MM-YYYY') as date, (time) as time, action from ${companyCode}.ep_entryLogs where 
                to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') in (SELECT date_trunc('day', dd):: date as dateObj
                FROM generate_series
                ( '${startDate}'::timestamp 
                , '${endDate}'::timestamp
                , '1 day'::interval) dd
                ) and emp_id IN (${empIdList}) order by time`

    // var query = `select SUBSTRING(emp_id, 8) as empid, to_char(time AT TIME ZONE 'Asia/Kolkata', 'DD-MM-YYYY') as date, (time AT TIME ZONE 'Asia/Kolkata') as time, action from ${companyCode}.ep_entryLogs where 
    // to_date(to_char(time AT TIME ZONE 'Asia/Kolkata', 'YYYYMMDD'), 'YYYYMMDD') in (SELECT date_trunc('day', dd):: date as dateObj
    // FROM generate_series
    // ( '${startDate}'::timestamp 
    // , '${endDate}'::timestamp
    // , '1 day'::interval) dd
    // ) and emp_id IN (${empIdList}) order by time`

    pool.query(query, (error, results) => {
      if (error) {
        //res.sendStatus(500);
        console.log(`[Daily Hour Calculation]: ` + error);
        return rej({ success: false });
      } else {

        var rawData = results.rows;
        console.log(results.rows);

        var groupDataByEmpId = new Map();
        for (var record of rawData) {
          if (groupDataByEmpId.has(record.empid)) {
            groupDataByEmpId.get(record.empid).push(record);
          } else {
            groupDataByEmpId.set(record.empid, [record]);
          }
        }

        var maserEmpMap = [];

        for (var empid of groupDataByEmpId.keys()) {

          var data = groupDataByEmpId.get(empid);

          var groupByData = new Map();
          for (var record of data) {
            console.log(record.date);
            if (groupByData.has(record.date)) {
              groupByData.get(record.date).push(record);
            } else {
              groupByData.set(record.date, [record]);
            }
          }

          var dateHoursMap = [];

          for (var key of groupByData.keys()) {
            var recordSet = groupByData.get(key);
            var time = 0;
            for (i = 0; i < recordSet.length - 1; i++) {

              // if (i === recordSet.length - 1 && recordSet[i].action === "EMP_CHECKIN") {

              //   var time1 = new Date(recordSet[i].time);
              //   var time2 = new Date(recordSet[i].time);
              //   time2.setUTCHours(23); time2.setUTCMinutes(59); time2.setUTCSeconds(59);
              //   var difference = (time2 - time1) / (1000 * 60 * 60);
              //   time += difference;
              //   console.log(`${time1} ${time2} ${difference} ${time}`);
              // }

              // else if (i === 0 && recordSet[i].action === "EMP_CHECKOUT") {

              //   var time2 = new Date(recordSet[i].time);
              //   var time1 = new Date(recordSet[i].time);
              //   time1.setUTCHours(0); time1.setUTCMinutes(0); time1.setUTCSeconds(0);
              //   var difference = (time2 - time1) / (1000 * 60 * 60);
              //   time += difference;
              //   console.log(`${time1} ${time2} ${difference} ${time}`)
              // }

              // else 
              if (recordSet[i].action === "EMP_CHECKIN" && recordSet[i + 1].action === "EMP_CHECKOUT") {
                var time2 = new Date(recordSet[i + 1].time);
                var time1 = new Date(recordSet[i].time);
                var difference = (time2 - time1) / (1000 * 60 * 60);
                time += difference;
                console.log(`${time1} ${time2} ${difference} ${time}`)
              }
            }
            dateHoursMap.push({ date: key, hours: time.toFixed(2) });

          }

          var currentDate = moment(startDate);
          var stopDate = moment(endDate);

          while (currentDate <= stopDate) {

            var tempDate = moment(currentDate).format('DD-MM-YYYY');
            var recordIfAvailable = dateHoursMap.findIndex(obj => {
              return obj.date === tempDate
            })

            if (recordIfAvailable < 0) {
              dateHoursMap.push({ date: tempDate, hours: "0" });
            }
            currentDate = moment(currentDate).add(1, 'days');
          }

          dateHoursMap.sort(function (a, b) {
            var dateA = a.date.toLowerCase(), dateB = b.date.toLowerCase()
            if (dateA < dateB) //sort string ascending
              return -1;
            if (dateA > dateB)
              return 1;
            return 0;
          })

          maserEmpMap.push({ empid: empid, data: dateHoursMap });
        }

        console.log(maserEmpMap);

        return res({
          success: true,
          data: maserEmpMap
        })

      }
    })
  })
}

const sendEmail = (request, response) => {
  const { toEmail, sub, body } = request.body;

  const mailgun = require("mailgun-js");
  const mg = mailgun({ apiKey: Config.SMTP_API_KEY, domain: Config.SMTP_DOMAIN });
  const data = {
    from: Config.FROM_EMAIL,
    to: toEmail,
    subject: sub,
    html: body
  };

  mg.messages().send(data, function (error, body) {
    if (error) {
      console.log(error)
      response.sendStatus(500);
    }
    console.log(body)
    response.json({
      success: true,
      message: "Email sent successfully"
    })
  });
}

function convertToHrsMinFormat(time){
  var hour = Math.floor(time);
  var min = Math.round((time - hour) * 60);

  var strToReturn = `${hour} h ${min} min`;
  return strToReturn;
}

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
  getDayInfo,
  getOverAPeriodStatus,
  getManagerReportData,
  getManagerComprehensiveReport,
  getWorkingTimeForEachDay,
  getLeaveTypes,
  sendEmail
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

//Old Methods for hour calculation
// const getManagerReportData = (request, response) => {

//   const { startDate, endDate, empids, companyCode } = request.body;

//   var empIdList = "";
//   for (var empid of empids) {
//     empIdList += `'${empid}',`;
//   }
//   empIdList = empIdList.slice(0, -1)

//   var query = `select SUBSTRING(A.emp_id, 8) as "Employee_ID", A.first_name || ' ' || A.last_name as "Name", text((select sum((select sum(b.time - a.time) from
//               (select emp_id, time, row_number() over (order by time) as index from ${companyCode}.ep_entryLogs where action = 'EMP_CHECKIN'
//               and to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = tseries.dateObj and emp_id = A.emp_id order by time) a,
//               (select emp_id, time, row_number() over (order by time) as index from ${companyCode}.ep_entryLogs where action = 'EMP_CHECKOUT'
//               and to_date(to_char(time, 'YYYYMMDD'), 'YYYYMMDD') = tseries.dateObj and emp_id = A.emp_id order by time) b
//               where a.index = b.index
//               and a.time < b.time
//               group by to_date(to_char(a.time, 'YYYYMMDD'), 'YYYYMMDD')))
//               FROM (SELECT date_trunc('day', dd):: date as dateObj
//               FROM generate_series
//                   ( '${startDate}'::timestamp 
//                   , '${endDate}'::timestamp
//                   , '1 day'::interval) dd
//                   ) tseries)) as "Total_Hours"
//               from ${companyCode}.ep_empDetails A
//               where A.emp_id in (${empIdList})`

//   pool.query(query, (error, results) => {
//     if (error) {
//       console.log(error);
//       response.sendStatus(500);
//     } else {
//       response.json(results.rows)
//     }
//   })
// }