import mongodb from 'mongodb';

import LogServices from '#modules/logging/LogServices';

import setupCollections from './setupCollections';
import setupDatabase from './setupDatabase';

const { MongoClient } = mongodb;

let databasesEnsured = false;

// Db handle for code that runs outside the HTTP route context (e.g. the
// WebSocket handler). Set once when mongoPool() is called at startup.
let sharedDb = null;

export const getSharedDb = () => sharedDb;

const mongoPool = connOptions => {
  const { uri: mongoUrl, dbName } = connOptions;

  let client;

  try {
    client = new MongoClient(mongoUrl, {
      maxPoolSize: 500,
      minPoolSize: 1,
    });

    sharedDb = client.db(dbName);

    if (!databasesEnsured) {
      databasesEnsured = true;
      LogServices.warn('Ensuring databases and collections (indexes, validations)...');
      const mDb = client.db(dbName);
      setupCollections(mDb).then(() => {
        LogServices.success('Ensuring done');
      });
    }
  } catch (e) {
    console.error(e);
    return null;
  }

  process.on('SIGINT', function () {
    client.close();
  });

  return async ctx => {
    ctx.mongo = client;

    ctx.modS.responses.createValidateError(
      ctx.mongo,
      ctx,
      ctx.modS.responses.CustomErrors.SERVER_TIMEOUT,
    );

    ctx.mongoDb = ctx.mongo.db(dbName);
    ctx.db = setupDatabase(ctx.mongoDb);
    ctx.privateState = {
      user: null,
    };
  };
};

export default mongoPool;
