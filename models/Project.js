const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  apiUrl: {
    type: String,
    required: true,
    trim: true
  },
  mongoDbUrl: {
    type: String,
    required: true,
    trim: true
  },
  apiStatus: {
    type: String,
    enum: ['success', 'error', 'pending'],
    default: 'pending'
  },
  lastChecked: {
    type: Date,
    default: null
  },
  responseTime: {
    type: Number,
    default: null
  },
  routes: [{
    path: String,
    method: String,
    status: String,
    responseTime: Number,
    lastChecked: Date
  }],
  apiMetrics: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', projectSchema);
