/**
 * TrustVault Backend - Authentication Integration & Security Tests
 * Validates registration, bcrypt password hashing, privilege escalation prevention,
 * login authentication, and JWT protected routes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/user.model.js';

describe('Authentication & Identity Security Suite', () => {
  const app = createApp();

  beforeEach(() => {
    User.clearInMemory();
  });

  describe('POST /api/auth/register', () => {
    const validPayload = {
      name: 'Alice Developer',
      email: 'alice@company.com',
      password: 'SecurePassword123',
    };

    it('should register a new user and return sanitized user and JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');

      const user = response.body.data.user;
      expect(user.name).toBe('Alice Developer');
      expect(user.email).toBe('alice@company.com');
      expect(user.role).toBe('member');

      // CRITICAL SECURITY ASSERTION: passwordHash must NEVER be returned in response
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password');
      expect(JSON.stringify(response.body)).not.toContain('SecurePassword123');
    });

    it('should reject registration when email already exists (409 Conflict)', async () => {
      await request(app).post('/api/auth/register').send(validPayload);

      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send(validPayload);

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validPayload, email: 'not-an-email' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
    });

    it('should reject registration with weak password (< 8 chars)', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ ...validPayload, password: 'short1' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('THREAT-06: should prevent privilege escalation when client supplies role: admin', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validPayload,
          role: 'admin', // Malicious attempt to self-promote
        });

      expect(response.status).toBe(201);
      // Assert that role strictly defaults to 'member'
      expect(response.body.data.user.role).toBe('member');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        name: 'Bob Manager',
        email: 'bob@company.com',
        password: 'Password987',
      });
    });

    it('should authenticate user with valid credentials and return JWT', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@company.com',
          password: 'Password987',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('bob@company.com');
      expect(response.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 Unauthorized for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@company.com',
          password: 'WrongPassword123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      // Generic message to prevent account enumeration
      expect(response.body.error.message).toBe('Invalid email address or password.');
    });

    it('should return 401 Unauthorized for non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@company.com',
          password: 'Password987',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me (Protected Route)', () => {
    let validToken;

    beforeEach(async () => {
      const reg = await request(app).post('/api/auth/register').send({
        name: 'Charlie Member',
        email: 'charlie@company.com',
        password: 'StrongPassword1',
      });
      validToken = reg.body.data.token;
    });

    it('should return current user profile when valid Bearer token is provided', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).toHaveProperty('email', 'charlie@company.com');
      expect(response.body.data.user).toHaveProperty('name', 'Charlie Member');
      expect(response.body.data.user).toHaveProperty('role', 'member');
    });

    it('should return 401 Unauthorized when Authorization header is missing', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 Unauthorized when Bearer token is invalid or corrupted', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
