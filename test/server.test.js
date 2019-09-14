'use strict'

process.env.PORT = '9001'

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.should()
chai.use(sinonChai)
const request = require('supertest')

const server = require('../server')
const sqlite = require('sqlite')

const task1 = {
  id: 1,
  description: 'task 1 desc',
  complete: 0,
  user: 1
}
const task2 = {
  id: 2,
  description: 'task 2 desc',
  complete: 1,
  user: 1
}
const newTask = {
  id: 3,
  description: 'task 3 desc',
  complete: 0,
  user: 1
}

const dbOpenStub = sinon.stub(sqlite, 'open')
const dbAllStub = sinon.stub()
const dbGetStub = sinon.stub()
const dbRunStub = sinon.stub()
setResolves()

function setResolves() {
  dbAllStub.resolves([
    Object.assign({}, task1),
    Object.assign({}, task2)
  ])
  dbGetStub.resolves(
    Object.assign({}, task1)
  )
  dbRunStub.resolves({
    stmt: { lastID: 1 }
  })
  dbOpenStub.resolves({
    all: dbAllStub,
    get: dbGetStub,
    run: dbRunStub
  })
}

function checkMiddleware() {
    dbOpenStub.should.have.been.calledOnceWith(
      './db/todo.db',
      { Promise }
    )
}

describe('server.js', function() {
  afterEach(function() {
    dbAllStub.resetHistory()
    dbGetStub.resetHistory()
    dbOpenStub.resetHistory()
    dbRunStub.resetHistory()

    setResolves()
  })

  it('deletes a task', function(done) {
    request(server)
      .delete('/api/todo/1/42')
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbRunStub.should.have.been.calledOnceWith(
          'DELETE FROM tasks WHERE id = ? AND user = ?',
          '42',
          '1'
        )
        response.body.should.deep.equal({success: true})

        done();
      })
  })

  it('handles an error while deleting a task', function(done) {
    dbRunStub.rejects('bah humbug')

    request(server)
      .delete('/api/todo/1/42')
      .expect(500)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)
        done()
      })
  })

  it('gets all the tasks', function(done) {
    request(server)
      .get('/api/todo/1')
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbAllStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE user = ?',
          '1'
        )
        response.body.should.deep.equal([
          Object.assign(task1, { complete: false }),
          Object.assign(task2, { complete: true }),
        ])

        done()
      })
  })

  it('gets all complete tasks', function(done) {
    request(server)
      .get('/api/todo/1?complete=true')
      .expect(200)
      .then(() => {
        checkMiddleware()
        dbAllStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE user = ? AND complete = 1',
          '1'
        )

        done()
      })
  })

  it('gets all incomplete tasks', function(done) {
    request(server)
      .get('/api/todo/1?complete=false')
      .expect(200)
      .then(() => {
        checkMiddleware()
        dbAllStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE user = ? AND complete = 0',
          '1'
        )

        done()
      })
  })

  it('handles an error getting all the tasks', function(done) {
    dbAllStub.rejects('bah humbug')

    request(server)
      .get('/api/todo/1')
      .expect(500)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)
        done()
      })
  })

  it('gets a specific task', function(done) {
    request(server)
      .get('/api/todo/1/1')
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbGetStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE id = ? AND user = ?',
          '1',
          '1'
        )
        response.body.should.deep.equal(
          Object.assign(task1, { complete: false })
        )

        done()
      })
  })

  it('handles not finding a task', function(done) {
    dbGetStub.resolves('')

    request(server)
      .get('/api/todo/1/1')
      .expect(404)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)

        done()
      })
  })

  it('handles an error finding a task', function(done) {
    dbGetStub.rejects('OH NO')

    request(server)
      .get('/api/todo/1/1')
      .expect(500)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)

        done()
      })
  })

  it('creates a task', function(done) {
    const description = 'new task description'

    request(server)
      .post('/api/todo/1')
      .send({ description })
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbRunStub.should.have.been.calledOnceWith(
          'INSERT INTO tasks (description, user) VALUES(?, ?)',
          description,
          '1'
        )
        dbGetStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE id = ?',
          1
        )
        response.body.should.deep.equal(
          Object.assign(task1, { complete: false })
        )

        done()
      })
  })

  it('handles an error creating a task', function(done) {
    dbRunStub.rejects('aw man')

    request(server)
      .post('/api/todo/1')
      .send({ description: 'whatever' })
      .expect(500)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)

        done()
      })
  })

  it('updates a task', function(done) {
    const updates = {
      description: 'new desc',
      complete: true
    }
    request(server)
      .patch('/api/todo/1/1')
      .send(updates)
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbRunStub.should.have.been.calledOnceWith(
          'UPDATE tasks SET description = ?, complete = ? WHERE id = ? AND user = ?',
          ['new desc', 1, '1', '1']
        )
        dbGetStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE id = ?',
          '1'
        )
        response.body.should.deep.equal(
          Object.assign(task1, { complete: false })
        )

        done()
      })
  })

  it("doesn't update if no updates are sent", function(done) {
    const updates = { }
    request(server)
      .patch('/api/todo/1/1')
      .send(updates)
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbRunStub.should.not.have.been.called
        dbGetStub.should.have.been.calledOnceWith(
          'SELECT * FROM tasks WHERE id = ?',
          '1'
        )
        response.body.should.deep.equal(
          Object.assign(task1, { complete: false })
        )

        done()
      })
  })

  it('handles an error updating a task', function(done) {
    dbRunStub.rejects('dang')

    request(server)
      .patch('/api/todo/1/1')
      .send({ foo: 'bar' })
      .expect(500)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)

        done()
      })
  })

  it("accepts someone's credentials", function(done) {
    const userId = 70
    dbGetStub.resolves({
      id: userId
    })
    const username = 'user'
    const password = 'pass'

    request(server)
      .post('/login')
      .send({ username, password })
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbGetStub.should.have.been.calledOnceWith(
          'SELECT id FROM users WHERE username = ? AND password = ?',
          username,
          password
        )
        response.body.should.deep.equal({
          success: true,
          id: userId
        })

        done()
      })
  })

  it("rejects someone's credentials", function(done) {
    dbGetStub.resolves('')
    const username = 'user'
    const password = 'pass'

    request(server)
      .post('/login')
      .send({ username, password })
      .expect(200)
      .then(response => {
        checkMiddleware()
        dbGetStub.should.have.been.calledOnceWith(
          'SELECT id FROM users WHERE username = ? AND password = ?',
          username,
          password
        )
        response.body.should.deep.equal({ success: false })

        done()
      })
  })

  it('handles an error while logging in', function(done) {
    dbGetStub.rejects('whoops')

    request(server)
      .post('/login')
      .expect(500)
      .then(response => {
        checkMiddleware()
        response.error.should.not.equal(false)

        done()
      })
  })
})