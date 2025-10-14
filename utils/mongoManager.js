const mongoose = require('mongoose');

class MongoManager {
  constructor() {
    this.connections = new Map();
  }

  async connect(url, projectId) {
    try {
      if (this.connections.has(projectId)) {
        return { success: true, connection: this.connections.get(projectId) };
      }

      const connection = await mongoose.createConnection(url, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000
      }).asPromise();

      this.connections.set(projectId, connection);
      return { success: true, connection };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listDatabases(projectId) {
    try {
      const connection = this.connections.get(projectId);
      if (!connection) {
        throw new Error('No connection found for this project');
      }

      const admin = connection.db.admin();
      const result = await admin.listDatabases();
      return { success: true, databases: result.databases };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listCollections(projectId, dbName) {
    try {
      const connection = this.connections.get(projectId);
      if (!connection) {
        throw new Error('No connection found for this project');
      }

      const db = dbName ? connection.useDb(dbName) : connection.db;
      const collections = await db.listCollections().toArray();
      return { success: true, collections };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getDocuments(projectId, dbName, collectionName, limit = 100, skip = 0) {
    try {
      const connection = this.connections.get(projectId);
      if (!connection) {
        throw new Error('No connection found for this project');
      }

      const db = dbName ? connection.useDb(dbName) : connection.db;
      const collection = db.collection(collectionName);

      const documents = await collection.find({}).limit(limit).skip(skip).toArray();
      const total = await collection.countDocuments();

      return { success: true, documents, total, limit, skip };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async insertDocument(projectId, dbName, collectionName, document) {
    try {
      const connection = this.connections.get(projectId);
      if (!connection) {
        throw new Error('No connection found for this project');
      }

      const db = dbName ? connection.useDb(dbName) : connection.db;
      const collection = db.collection(collectionName);

      const result = await collection.insertOne(document);
      return { success: true, insertedId: result.insertedId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateDocument(projectId, dbName, collectionName, filter, update) {
    try {
      const connection = this.connections.get(projectId);
      if (!connection) {
        throw new Error('No connection found for this project');
      }

      const db = dbName ? connection.useDb(dbName) : connection.db;
      const collection = db.collection(collectionName);

      const result = await collection.updateOne(filter, { $set: update });
      return { success: true, modifiedCount: result.modifiedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteDocument(projectId, dbName, collectionName, filter) {
    try {
      const connection = this.connections.get(projectId);
      if (!connection) {
        throw new Error('No connection found for this project');
      }

      const db = dbName ? connection.useDb(dbName) : connection.db;
      const collection = db.collection(collectionName);

      const result = await collection.deleteOne(filter);
      return { success: true, deletedCount: result.deletedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async disconnect(projectId) {
    try {
      const connection = this.connections.get(projectId);
      if (connection) {
        await connection.close();
        this.connections.delete(projectId);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testConnection(url) {
    try {
      const connection = await mongoose.createConnection(url, {
        serverSelectionTimeoutMS: 5000
      }).asPromise();

      await connection.close();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new MongoManager();
