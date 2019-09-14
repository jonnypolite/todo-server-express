const express = require('express')
const sqlite = require('sqlite')

const app = express()
const port = process.env.PORT || 3001

const handleError = (res, error) => {
  res.status(500).send(error.message)
}

const isBoolean = thing => thing === true || thing === false

const dbMiddleware  = async (req, res, next) => {
  const dbPromise = sqlite.open('./db/todo.db', { Promise })
  req.db = await dbPromise

  next()
}

const adjustRequestMiddleware = (req, res, next) => {
  if (isBoolean(req.body.complete)) {
    req.body.complete = req.body.complete ? 1 : 0
  }

  next()
}

const adjustResponse = taskJson => {
  let taskArray

  taskArray = (Array.isArray(taskJson) ? taskJson : [taskJson]).map(task => {
    if (task.complete) {
      task.complete = task.complete === 1 ? true : false
    }
    return task
  })

  return (taskArray.length === 1 ? taskArray.pop() : taskArray)
}

const sendTaskJson = (res, json) => {
  res.json(adjustResponse(json))
}

app.use(express.json())
app.use(dbMiddleware)
app.use(adjustRequestMiddleware)

app.delete('/api/todo/:id', async (req, res) => {
  try {
    await req.db.run(
      'DELETE FROM tasks WHERE id = ? AND user = ?',
      req.params.id,
      req.query.user
    )

    sendTaskJson(res, { success: true })
  } catch (err) {
    handleError(res, err)
  }
})

app.get('/api/todo', async (req, res, next) => {
  try {
    let sql = 'SELECT * FROM tasks WHERE user = ?'
    if (req.query.complete === 'true') {
      sql += ' AND complete = 1'
    } else if (req.query.complete === 'false') {
      sql += ' AND complete = 0'
    }

    const tasks = await req.db.all(sql, req.query.user)

    sendTaskJson(res, tasks)

  } catch (err) {
    handleError(res, err)
  }
})

app.get('/api/todo/:id', async (req, res) => {
  try {
    const task = await req.db.get(
      'SELECT * FROM tasks WHERE id = ? AND user = ?',
      req.params.id,
      req.params.user
    )

    if (task) {
      sendTaskJson(res, task)
    } else {
      res.status(404).send()
    }
  } catch (err) {
    handleError(res, err)
  }
})

app.post('/api/todo/', async (req, res) => {
  try {
    const insert = await req.db.run(
      'INSERT INTO tasks (description, user) VALUES(?, ?)',
      req.body.description,
      req.body.user
    )

    const task = await req.db.get('SELECT * FROM tasks WHERE id = ?', insert.stmt.lastID)

    sendTaskJson(res, task)
  } catch (err) {
    handleError(res, err)
  }
})

app.patch('/api/todo/:id', async (req, res) => {
  try {
    let queryParams = []
    const updateSql = 'UPDATE tasks'
    const updateColumns = []
    const { user, ...updates} = req.body;

    Object.keys(updates).forEach(bodyKey => {
      updateColumns.push(`${bodyKey} = ?`)
      queryParams.push(updates[bodyKey])
    })
    queryParams = queryParams.concat([req.params.id, user])

    if (updateColumns.length) {
      await req.db.run(
        `${updateSql} SET ${updateColumns.join(', ')} WHERE id = ? AND user = ?`,
        queryParams
      )
    }

    const select = await req.db.get('SELECT * FROM tasks WHERE id = ?', req.params.id)

    sendTaskJson(res, select)
  } catch (err) {
    handleError(res, err)
  }
})

app.post('/login', async (req, res) => {
  try {
    const user = await req.db.get(
      'SELECT id FROM users WHERE username = ? AND password = ?',
      req.body.username,
      req.body.password
    )

    if (user) {
      res.json({
        success: true,
        id: user.id
      })
    } else {
      res.json({ success: false })
    }
  } catch (err) {
    handleError(res, err)
  }
})

app.listen(port, () => console.log(`server listening on port ${port}`))
