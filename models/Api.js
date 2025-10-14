const mongoose = require('mongoose');

const apiSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lastStatus: {
    type: String,
    enum: ['success', 'error', 'pending'],
    default: 'pending'
  },
  lastResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastChecked: {
    type: Date,
    default: null
  },
  responseTime: {
    type: Number,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Api', apiSchema);
