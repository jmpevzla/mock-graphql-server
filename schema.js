const { gql, AuthenticationError, ValidationError } = require('apollo-server-express')
const Axios = require('axios')
const jwt = require('jsonwebtoken')

require('dotenv').config()
const axiosDef = Axios.default
const JSONSERVER = process.env.JSONSERVER
const JWTSECRET = process.env.JWTSECRET

/**
 * @type Axios.AxiosInstance
 */
const axios = new axiosDef.create({
    headers: {
        apollo: 1
    }
})

function checkAuth(args) {
    const { user } = args['2']
    if (!user) {
        throw new AuthenticationError('Unauthorizated')
    }
}

async function getUser(email, password = undefined) {
    const res = await axios.post(JSONSERVER, {
        query: `
            query search($email: String!, $password: String) {
                allUsers(filter: { email: $email, password: $password }) {
                    id,
                    name,
                    email
                }
            }
        `,
        variables: {
            email,
            password
        }
    })

    return res.data.data.allUsers[0] 
}

module.exports = {
    typeDefs: gql`
        type User {
            id: ID!
            name: String!,
            email: String!,
            password: String!
        }
        
        type AuthPayload {
            token: String!
            user: User!,
            message: String
        }

        type Query {
            users(id: ID!): [User!]!
            me: User!
        }

        type Mutation {
            login(email: String!, password: String!): AuthPayload!
            register(name: String!, email: String!, password: String!): AuthPayload!
        }
    `,
    resolvers: {
        Query: {
            async users(_, { id }, __) {
                //console.log(id)
                const res = await axios.post(JSONSERVER, {
                    query: `
                  {
                    allUsers {
                        id,
                        name
                    }
                  }
                `
                })
                const { data } = res.data
                //console.log(JSON.stringify(data.allUsers))
                return data.allUsers
            },
            async me(_, __, { user }) {
                checkAuth(arguments)
                return user
            }
        },
        Mutation: {
            async login(_, { email, password }) {
                const user = await getUser(email, password)
                
                if (!user) {
                    throw new AuthenticationError('No user with those credentials')
                }

                // return jwt
                const token = jwt.sign({ id: user.id }, JWTSECRET, { expiresIn: '7d' })

                return {
                    token,
                    user,
                    message: 'Login successful!'
                }
            },
            async register(_, { name, email, password }) {
                const user = await getUser(email)

                if (user) {
                    throw new ValidationError('email or user already exists')
                    // await axios.post(JSONSERVER, {
                    //     query: `
                    //         mutation remove($id: ID!) {
                    //             removeUser(id: $id) {
                    //                 id
                    //             }
                    //         }
                    //     `,
                    //     variables: {
                    //         id: user.id
                    //     }
                    // })
                }
                
                const res = await axios.post(JSONSERVER, {
                    query: `
                        mutation create($name: String!, $email: String!, $password: String!) {
                            createUser(name: $name, email: $email, password: $password) {
                                id,
                                name,
                                email
                            }
                        }
                    `,
                    variables: {
                        name,
                        email,
                        password
                    }
                })

                const createdUser = res.data.data.createUser

                const token = jwt.sign(
                    { id: createdUser.id },
                    JWTSECRET,
                    { expiresIn: '7d' }
                )

                return {
                    token, user: createdUser, message: "Registration successful!"
                }
            }
        }
    }       
}

