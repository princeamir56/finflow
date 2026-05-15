export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    fullName: String!
    createdAt: String!
  }

  type Account {
    id: ID!
    userId: ID!
    iban: String!
    currency: String!
    balance: Float!
    createdAt: String!
  }

  type Transaction {
    id: ID!
    fromAccountId: ID
    toAccountId: ID
    amount: Float!
    type: String!
    status: String!
    description: String
    createdAt: String!
  }

  type Notification {
    id: ID!
    userId: ID!
    type: String!
    title: String!
    message: String!
    read: Boolean!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    myAccounts: [Account!]!
    account(id: ID!): Account
    transactionHistory(accountId: ID!, limit: Int, offset: Int): [Transaction!]!
    myNotifications(limit: Int, offset: Int): [Notification!]!
    unreadNotificationCount: Int!
  }

  type Mutation {
    register(email: String!, password: String!, fullName: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createAccount(currency: String): Account!
    deposit(accountId: ID!, amount: Float!, description: String): Transaction!
    withdraw(accountId: ID!, amount: Float!, description: String): Transaction!
    transfer(fromAccountId: ID!, toAccountId: ID!, amount: Float!, description: String): Transaction!
    markNotificationAsRead(id: ID!): Notification!
  }
`;
