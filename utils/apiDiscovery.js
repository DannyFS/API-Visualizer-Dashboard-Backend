const axios = require('axios');

class ApiDiscovery {
  async discoverRoutes(baseUrl) {
    try {
      // Common API route patterns to check
      const commonEndpoints = [
        '/',
        '/api',
        '/health',
        '/status',
        '/users',
        '/products',
        '/posts',
        '/comments',
        '/data'
      ];

      const discoveredRoutes = [];
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const endpoint of commonEndpoints) {
        for (const method of methods) {
          try {
            const url = `${baseUrl}${endpoint}`;
            const startTime = Date.now();

            const response = await axios({
              method: method.toLowerCase(),
              url,
              timeout: 5000,
              validateStatus: () => true // Accept any status
            });

            const responseTime = Date.now() - startTime;

            // Only add if it returns a meaningful status (not 404)
            if (response.status !== 404) {
              discoveredRoutes.push({
                path: endpoint,
                method,
                status: response.status >= 200 && response.status < 300 ? 'success' : 'error',
                responseTime,
                lastChecked: new Date()
              });
            }
          } catch (error) {
            // Route doesn't exist or error occurred, skip it
          }
        }
      }

      return { success: true, routes: discoveredRoutes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkRoute(baseUrl, path, method = 'GET') {
    try {
      const url = `${baseUrl}${path}`;
      const startTime = Date.now();

      const response = await axios({
        method: method.toLowerCase(),
        url,
        timeout: 10000,
        validateStatus: () => true
      });

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        status: response.status >= 200 && response.status < 300 ? 'success' : 'error',
        statusCode: response.status,
        responseTime,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        status: 'error',
        error: error.message
      };
    }
  }

  async monitorApi(baseUrl, routes) {
    const results = [];

    for (const route of routes) {
      const result = await this.checkRoute(baseUrl, route.path, route.method);
      results.push({
        path: route.path,
        method: route.method,
        ...result,
        lastChecked: new Date()
      });
    }

    return { success: true, results };
  }
}

module.exports = new ApiDiscovery();
