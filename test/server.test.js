'use strict'

const chai = require('chai')
const sinon = require('sinon')
const sinonChai = require('sinon-chai')
chai.should()
chai.use(sinonChai)
const request = require('supertest')

const server = require('../server')
const sqlite = require('sqlite')

const dbOpenStub = sinon.stub(sqlite, 'open')
const dbRunStub = sinon.stub()
dbOpenStub.resolves({
  run: dbRunStub
})

describe('server.js', function() {
  it('deletes a task', function(done) {
    request(server)
      .delete('/api/todo/42')
      .expect(200)
      .then(response => {
        // console.log(response)
        done();
      })
  })

  it('handles an error while deleting a task')
})