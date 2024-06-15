const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
let db = null
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log('DB Error:${e.message}')
    process.exit(1)
  }
}
initializeDbAndServer()
function authenticateToken(request, response, next) {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  // const hasedPassword = await bcrypt.hash(password, 10)
  const selectQuery = `select * from user where username='${username}'`
  const dbuser = await db.get(selectQuery)
  if (dbuser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbuser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid Password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const selectStateQuery = `
  select * from state `
  const result = await db.all(selectStateQuery)
  const convertSankeCaseToCamel = state => {
    return {
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    }
  }
  response.send(result.map(state => convertSankeCaseToCamel(state)))
})
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const stateQuery = ` 
  select * from state where state_id=${stateId};`
  const output = await db.get(stateQuery)
  const convertSankeCaseToCamel = state => {
    return {
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    }
  }
  response.send(convertSankeCaseToCamel(output))
})
app.post('/districts/', authenticateToken, async (request, response) => {
  // const{districtId}=request.params,
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const dbQuery = `
  INSERT INTO district(district_name,state_id,cases,cured,active,deaths) 
  values('${districtName}',
  ${stateId},
  ${cases},
  ${cured},
  ${active},
  ${deaths})`
  await db.run(dbQuery)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const districtQuery = ` 
  select * from district where district_id=${districtId};`
    const output = await db.get(districtQuery)
    const convertSankeCaseToCamel = district => {
      return {
        districtId: district.district_id,
        districtName: district.district_name,
        stateId: district.state_id,
        cases: district.cases,
        cured: district.cured,
        active: district.active,
        deaths: district.deaths,
      }
    }
    response.send(convertSankeCaseToCamel(output))
  },
)
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteQUery = `
  delete from district where district_id=${districtId};`
    await db.run(deleteQUery)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQuery = `
  update district 
  set  
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths} 
  where district_id=${districtId}`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getQuery = `
  select
  SUM(cases),
  SUM(cured),
  SUM(active),
  SUM(deaths) 
  from district 
  where state_id=${stateId}`
    const stats = await db.get(getQuery)
    response.send({
      totalCases: stats['SUM(cases)'],
      totalCured: stats['SUM(cured)'],
      totalActive: stats['SUM(active)'],
      totalDeaths: stats['SUM(deaths)'],
    })
  },
)
module.exports = app
