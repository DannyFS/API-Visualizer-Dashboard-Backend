const express = require('express');
const router = express.Router();
const axios = require('axios');
const Api = require('../models/Api');

// POST /api/add - Add a new API URL
router.post('/add', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ message: 'URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    // Check if URL already exists
    const existingApi = await Api.findOne({ url });
    if (existingApi) {
      return res.status(400).json({ message: 'API URL already exists' });
    }

    // Create new API entry
    const newApi = new Api({
      url,
      lastStatus: 'pending'
    });

    await newApi.save();

    res.status(201).json({
      message: 'API added successfully',
      api: newApi
    });
  } catch (error) {
    console.error('Error adding API:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/list - Get all stored APIs
router.get('/list', async (req, res) => {
  try {
    const apis = await Api.find().sort({ createdAt: -1 });
    res.status(200).json({
      count: apis.length,
      apis
    });
  } catch (error) {
    console.error('Error fetching APIs:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// GET /api/fetch/:id - Fetch data from the stored API URL
router.get('/fetch/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find the API by ID
    const api = await Api.findById(id);
    if (!api) {
      return res.status(404).json({ message: 'API not found' });
    }

    // Measure response time
    const startTime = Date.now();

    try {
      // Fetch data from the stored URL
      const response = await axios.get(api.url, {
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status < 500 // Accept any status code below 500
      });

      const responseTime = Date.now() - startTime;

      // Update the API document with the new response
      api.lastStatus = 'success';
      api.lastResponse = response.data;
      api.lastChecked = new Date();
      api.responseTime = responseTime;
      api.errorMessage = null;

      await api.save();

      res.status(200).json({
        status: 'success',
        responseTime,
        data: response.data,
        statusCode: response.status,
        api: api
      });
    } catch (fetchError) {
      const responseTime = Date.now() - startTime;

      // Update with error status
      api.lastStatus = 'error';
      api.lastResponse = null;
      api.lastChecked = new Date();
      api.responseTime = responseTime;
      api.errorMessage = fetchError.message;

      await api.save();

      res.status(200).json({
        status: 'error',
        responseTime,
        error: fetchError.message,
        api: api
      });
    }
  } catch (error) {
    console.error('Error fetching API data:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// DELETE /api/delete/:id - Delete an API
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const api = await Api.findByIdAndDelete(id);
    if (!api) {
      return res.status(404).json({ message: 'API not found' });
    }

    res.status(200).json({ message: 'API deleted successfully' });
  } catch (error) {
    console.error('Error deleting API:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
