import { GraphQLError } from 'graphql';
import {
  authClient,
  transactionClient,
  notificationClient
} from '../config/grpc-clients.js';
import { grpcStatusToHttp } from '../utils/grpc-error.js';

function mapGrpcError(err) {
  const httpStatus = grpcStatusToHttp(err?.code);
  return new GraphQLError(err?.details || err?.message || 'Internal error', {
    extensions: { code: err?.code, http: { status: httpStatus } }
  });
}

function requireUser(ctx) {
  if (!ctx.user) {
    throw new GraphQLError('Unauthenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return ctx.user;
}

const mapUser = (u) => u && {
  id: u.id, email: u.email, fullName: u.full_name, createdAt: u.created_at
};
const mapAccount = (a) => a && {
  id: a.id, userId: a.user_id, iban: a.iban, currency: a.currency,
  balance: a.balance, createdAt: a.created_at
};
const mapTx = (t) => t && {
  id: t.id, fromAccountId: t.from_account_id, toAccountId: t.to_account_id,
  amount: t.amount, type: t.type, status: t.status,
  description: t.description, createdAt: t.created_at
};
const mapNotif = (n) => n && {
  id: n.id, userId: n.user_id, type: n.type, title: n.title,
  message: n.message, read: n.read, createdAt: n.created_at
};

async function call(fn) {
  try {
    return await fn();
  } catch (err) {
    throw mapGrpcError(err);
  }
}

export const resolvers = {
  Query: {
    me: async (_p, _a, ctx) => {
      const user = requireUser(ctx);
      return call(async () => mapUser(await authClient.GetUser({ user_id: user.id })));
    },
    myAccounts: async (_p, _a, ctx) => {
      const user = requireUser(ctx);
      return call(async () => {
        const list = await transactionClient.GetUserAccounts({ user_id: user.id });
        return (list.accounts || []).map(mapAccount);
      });
    },
    account: async (_p, { id }, ctx) => {
      requireUser(ctx);
      return call(async () => mapAccount(await transactionClient.GetAccount({ account_id: id })));
    },
    transactionHistory: async (_p, { accountId, limit, offset }, ctx) => {
      requireUser(ctx);
      return call(async () => {
        const list = await transactionClient.GetHistory({
          account_id: accountId, limit: limit || 50, offset: offset || 0
        });
        return (list.transactions || []).map(mapTx);
      });
    },
    myNotifications: async (_p, { limit, offset }, ctx) => {
      const user = requireUser(ctx);
      return call(async () => {
        const list = await notificationClient.GetUserNotifications({
          user_id: user.id, limit: limit || 50, offset: offset || 0
        });
        return (list.notifications || []).map(mapNotif);
      });
    },
    unreadNotificationCount: async (_p, _a, ctx) => {
      const user = requireUser(ctx);
      return call(async () => {
        const r = await notificationClient.GetUnreadCount({ user_id: user.id });
        return r.count || 0;
      });
    }
  },
  Mutation: {
    register: async (_p, { email, password, fullName }) =>
      call(async () => {
        const r = await authClient.Register({ email, password, full_name: fullName });
        return { token: r.token, user: mapUser(r.user) };
      }),
    login: async (_p, { email, password }) =>
      call(async () => {
        const r = await authClient.Login({ email, password });
        return { token: r.token, user: mapUser(r.user) };
      }),
    createAccount: async (_p, { currency }, ctx) => {
      const user = requireUser(ctx);
      return call(async () =>
        mapAccount(await transactionClient.CreateAccount({ user_id: user.id, currency: currency || 'EUR' }))
      );
    },
    deposit: async (_p, { accountId, amount, description }, ctx) => {
      requireUser(ctx);
      return call(async () =>
        mapTx(await transactionClient.Deposit({ account_id: accountId, amount, description }))
      );
    },
    withdraw: async (_p, { accountId, amount, description }, ctx) => {
      requireUser(ctx);
      return call(async () =>
        mapTx(await transactionClient.Withdraw({ account_id: accountId, amount, description }))
      );
    },
    transfer: async (_p, { fromAccountId, toAccountId, amount, description }, ctx) => {
      requireUser(ctx);
      return call(async () =>
        mapTx(await transactionClient.Transfer({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount,
          description
        }))
      );
    },
    markNotificationAsRead: async (_p, { id }, ctx) => {
      const user = requireUser(ctx);
      return call(async () =>
        mapNotif(await notificationClient.MarkAsRead({ notification_id: id, user_id: user.id }))
      );
    }
  }
};
