const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const jsonGraphqlServer = require('json-graphql-server')
const { ApolloServer } = require('apollo-server-express')
const jwt = require('jsonwebtoken')
const axios = require('axios').default
const data = require('./db')
const { typeDefs, resolvers } = require('./schema')

require('dotenv').config()
const PORT = process.env.PORT || 3000
const APOLLOSERVER = process.env.APOLLOSERVER
const JSONSERVER = process.env.JSONSERVER
const JWTSECRET = process.env.JWTSECRET

const app = express()
const jsonGraphqlExpress = jsonGraphqlServer.default

async function startApolloServer() {
   
    app.use(cors())

    function getUser(token) {
        try {
            if(token) {
                return jwt.verify(token, JWTSECRET)
            }
            return null
        } catch(err) {
            return null
        }
    }

    function getUserFromReq(req) {
        const token = req.get('Authorization') || ''
        return getUser(token.replace('Bearer ', ''))
    }

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => {
            const userToken = getUserFromReq(req)
            const user = userToken 
                ? data.users.find(value => Number(userToken.id) === value.id) 
                : null
            return { user , data }
        },
        introspection: true
    })

    await server.start()
    server.applyMiddleware({ app, path: '/apollo' })

    app.use('/graphql', function(req, res, next) {
        const user = getUserFromReq(req)
        const apollo = req.get('apollo')
        if (!user && Number(apollo) !== 1) {
            return res.json({"errors":[{"message":"Unauthorizated", "extensions":{"code":"UNAUTHENTICATED"}}], "data": null})
        }
        next()
    }, jsonGraphqlExpress(data))

    app.use('/gql', 
        bodyParser.json(), 
        async function(req, res) {
            const headers = {}
            const auth = req.get('Authorization')
            if (auth) {
                headers.Authorization = auth
            }
            let statusCode = 200
            
            try {
                const resp = await axios.post(APOLLOSERVER, req.body, {
                    headers
                })
                statusCode = resp.status
                return res.status(statusCode).json(resp.data)
        
            } catch(err) {
                
                const data = err.response.data
                statusCode = err.response.status
                const error = data.errors[0] 
                
                if (String(error.message).includes('Cannot query field')
                 && error.extensions.code === 'GRAPHQL_VALIDATION_FAILED') {

                  let respData = null
                  
                  try {
                    const resp = await axios.post(JSONSERVER, req.body, {
                        headers
                    })
                    statusCode = resp.status
                    respData = resp.data
                                  
                  } catch(err2) {
                    const data = err2.response.data
                    statusCode = err2.response.status
                    respData = data
    
                  } finally {
                    return res.status(statusCode).json(respData)
                  }

                } 
                    
                return res.status(statusCode).json(data)
                
            }
    })

    const listener = app.listen(PORT, () => {
        const address = listener.address()
        console.log(`GraphQL server running with your data on port ${address.port}`)
    })
}

startApolloServer()

