export const notificationSchema = {
  title: 'notification',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:        { type: 'string', maxLength: 100 },
    userId:    { type: 'string', maxLength: 100 },
    type:      { type: 'string', maxLength: 50 },
    title:     { type: 'string' },
    message:   { type: 'string' },
    read:      { type: 'boolean', default: false },
    createdAt: { type: 'string', maxLength: 40 }
  },
  required: ['id', 'userId', 'type', 'title', 'message', 'createdAt'],
  indexes: ['userId', 'createdAt']
};

export const processedEventSchema = {
  title: 'processed_event',
  version: 0,
  primaryKey: 'eventId',
  type: 'object',
  properties: {
    eventId:   { type: 'string', maxLength: 100 },
    processedAt: { type: 'string', maxLength: 40 }
  },
  required: ['eventId', 'processedAt']
};
