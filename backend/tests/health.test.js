/**
 * TrustVault Backend - Health & Base Route Integration Tests
 * Validates operational endpoints, security isolation, and error handling.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('API Foundation & Health Endpoints', () => {
  const app = createApp();

  describe('GET /api/health', () => {
    it('should return 200 OK with operational status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'TrustVault API');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');
    });

    it('should not leak sensitive configuration, paths, or secrets', async () => {
      const response = await request(app).get('/api/health');

      const bodyString = JSON.stringify(response.body).toLowerCase();

      // Assert no secret or internal leak exists in response
      expect(bodyString).not.toContain('mongodb');
      expect(bodyString).not.toContain('password');
      expect(bodyString).not.toContain('secret');
      expect(bodyString).not.toContain('token');
      expect(bodyString).not.toContain('c:\\');
      expect(bodyString).not.toContain('/home/');
    });
  });

  describe('404 Not Found Handling', () => {
    it('should return 404 with structured JSON error for unknown routes', async () => {
      const response = await request(app).get('/api/unregistered-path-12345');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
      expect(response.body.error.message).toContain('unregistered-path-12345');
    });
  });
});
