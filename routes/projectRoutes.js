const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const mongoManager = require('../utils/mongoManager');
const apiDiscovery = require('../utils/apiDiscovery');

// POST /projects/add - Add a new project
router.post('/add', async (req, res) => {
  try {
    const { name, apiUrl, mongoDbUrl } = req.body;

    if (!name || !apiUrl || !mongoDbUrl) {
      return res.status(400).json({
        message: 'Name, API URL, and MongoDB URL are required'
      });
    }

    // Validate URL formats
    try {
      new URL(apiUrl);
      new URL(mongoDbUrl);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    // Test MongoDB connection
    const mongoTest = await mongoManager.testConnection(mongoDbUrl);
    if (!mongoTest.success) {
      return res.status(400).json({
        message: 'Failed to connect to MongoDB',
        error: mongoTest.error
      });
    }

    // Create new project
    const newProject = new Project({
      name,
      apiUrl,
      mongoDbUrl,
      apiStatus: 'pending'
    });

    await newProject.save();

    // Discover API routes in background
    apiDiscovery.discoverRoutes(apiUrl).then(result => {
      if (result.success) {
        newProject.routes = result.routes;
        newProject.save();
      }
    });

    res.status(201).json({
      message: 'Project added successfully',
      project: newProject
    });
  } catch (error) {
    console.error('Error adding project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /projects/list - Get all projects
router.get('/list', async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 });
    res.status(200).json({
      count: projects.length,
      projects
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /projects/:id - Get a specific project
router.get('/:id', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    res.status(200).json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /projects/:id/discover-routes - Discover API routes
router.post('/:id/discover-routes', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const result = await apiDiscovery.discoverRoutes(project.apiUrl);

    if (result.success) {
      project.routes = result.routes;
      project.apiStatus = 'success';
      await project.save();

      res.status(200).json({
        message: 'Routes discovered successfully',
        routes: result.routes,
        project
      });
    } else {
      res.status(500).json({
        message: 'Failed to discover routes',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error discovering routes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /projects/:id/monitor - Monitor all routes
router.post('/:id/monitor', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!project.routes || project.routes.length === 0) {
      return res.status(400).json({
        message: 'No routes to monitor. Discover routes first.'
      });
    }

    const result = await apiDiscovery.monitorApi(project.apiUrl, project.routes);

    if (result.success) {
      // Update routes with monitoring results
      project.routes = result.results.map(r => ({
        path: r.path,
        method: r.method,
        status: r.status,
        responseTime: r.responseTime,
        lastChecked: r.lastChecked
      }));

      // Update metrics
      const successCount = result.results.filter(r => r.status === 'success').length;
      const errorCount = result.results.filter(r => r.status === 'error').length;
      const avgResponseTime = result.results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / result.results.length;

      project.apiMetrics.totalRequests += result.results.length;
      project.apiMetrics.successfulRequests += successCount;
      project.apiMetrics.failedRequests += errorCount;
      project.apiMetrics.averageResponseTime = avgResponseTime;
      project.lastChecked = new Date();

      await project.save();

      res.status(200).json({
        message: 'Monitoring completed',
        results: result.results,
        project
      });
    } else {
      res.status(500).json({
        message: 'Failed to monitor routes',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error monitoring routes:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /projects/:id - Delete a project
router.delete('/:id', async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Disconnect MongoDB connection
    await mongoManager.disconnect(req.params.id);

    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// MongoDB Management Routes

// GET /projects/:id/mongo/databases - List all databases
router.get('/:id/mongo/databases', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const connectResult = await mongoManager.connect(project.mongoDbUrl, project._id.toString());
    if (!connectResult.success) {
      return res.status(500).json({
        message: 'Failed to connect to MongoDB',
        error: connectResult.error
      });
    }

    const result = await mongoManager.listDatabases(project._id.toString());

    if (result.success) {
      res.status(200).json({ databases: result.databases });
    } else {
      res.status(500).json({
        message: 'Failed to list databases',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error listing databases:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /projects/:id/mongo/:dbName/collections - List collections in a database
router.get('/:id/mongo/:dbName/collections', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const connectResult = await mongoManager.connect(project.mongoDbUrl, project._id.toString());
    if (!connectResult.success) {
      return res.status(500).json({
        message: 'Failed to connect to MongoDB',
        error: connectResult.error
      });
    }

    const result = await mongoManager.listCollections(project._id.toString(), req.params.dbName);

    if (result.success) {
      res.status(200).json({ collections: result.collections });
    } else {
      res.status(500).json({
        message: 'Failed to list collections',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error listing collections:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /projects/:id/mongo/:dbName/:collection/documents - Get documents from a collection
router.get('/:id/mongo/:dbName/:collection/documents', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;

    const connectResult = await mongoManager.connect(project.mongoDbUrl, project._id.toString());
    if (!connectResult.success) {
      return res.status(500).json({
        message: 'Failed to connect to MongoDB',
        error: connectResult.error
      });
    }

    const result = await mongoManager.getDocuments(
      project._id.toString(),
      req.params.dbName,
      req.params.collection,
      limit,
      skip
    );

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json({
        message: 'Failed to fetch documents',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// POST /projects/:id/mongo/:dbName/:collection/documents - Insert a document
router.post('/:id/mongo/:dbName/:collection/documents', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const connectResult = await mongoManager.connect(project.mongoDbUrl, project._id.toString());
    if (!connectResult.success) {
      return res.status(500).json({
        message: 'Failed to connect to MongoDB',
        error: connectResult.error
      });
    }

    const result = await mongoManager.insertDocument(
      project._id.toString(),
      req.params.dbName,
      req.params.collection,
      req.body
    );

    if (result.success) {
      res.status(201).json({
        message: 'Document inserted successfully',
        insertedId: result.insertedId
      });
    } else {
      res.status(500).json({
        message: 'Failed to insert document',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error inserting document:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// PUT /projects/:id/mongo/:dbName/:collection/documents - Update a document
router.put('/:id/mongo/:dbName/:collection/documents', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { filter, update } = req.body;
    if (!filter || !update) {
      return res.status(400).json({
        message: 'Filter and update fields are required'
      });
    }

    const connectResult = await mongoManager.connect(project.mongoDbUrl, project._id.toString());
    if (!connectResult.success) {
      return res.status(500).json({
        message: 'Failed to connect to MongoDB',
        error: connectResult.error
      });
    }

    const result = await mongoManager.updateDocument(
      project._id.toString(),
      req.params.dbName,
      req.params.collection,
      filter,
      update
    );

    if (result.success) {
      res.status(200).json({
        message: 'Document updated successfully',
        modifiedCount: result.modifiedCount
      });
    } else {
      res.status(500).json({
        message: 'Failed to update document',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /projects/:id/mongo/:dbName/:collection/documents - Delete a document
router.delete('/:id/mongo/:dbName/:collection/documents', async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { filter } = req.body;
    if (!filter) {
      return res.status(400).json({ message: 'Filter is required' });
    }

    const connectResult = await mongoManager.connect(project.mongoDbUrl, project._id.toString());
    if (!connectResult.success) {
      return res.status(500).json({
        message: 'Failed to connect to MongoDB',
        error: connectResult.error
      });
    }

    const result = await mongoManager.deleteDocument(
      project._id.toString(),
      req.params.dbName,
      req.params.collection,
      filter
    );

    if (result.success) {
      res.status(200).json({
        message: 'Document deleted successfully',
        deletedCount: result.deletedCount
      });
    } else {
      res.status(500).json({
        message: 'Failed to delete document',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
