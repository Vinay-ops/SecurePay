const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const SecurityLog = require('../models/SecurityLog');
const { generateRSAKeyPair, computeKeyFingerprint } = require('../crypto/rsa');
const { getJwtSecret } = require('../config/secrets');

// Fallback in-memory user store if database is offline
const inMemoryUsers = new Map();

// Helper to sign JWT (secret is environment-provided or ephemeral; never hardcoded)
const generateToken = (id, name, email, role) => {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured on the server.');
  }
  return jwt.sign({ id, name, email, role }, secret, { expiresIn: '7d' });
};

/**
 * Register a new user and auto-generate their 2048-bit RSA keypair
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    // Generate cryptographic RSA 2048-bit Keypair for the user
    const { publicKey, privateKey, fingerprint } = generateRSAKeyPair();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let createdUser;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;

    if (isDbReady) {
      try {
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: 'An account with this email already exists',
          });
        }

        createdUser = await User.create({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          rsaPublicKey: publicKey,
          rsaPrivateKey: privateKey,
          publicKeyFingerprint: fingerprint,
          balance: 50000.0,
        });
      } catch (dbErr) {
        // Fallback to in-memory
      }
    }

    if (!createdUser) {
      // In-memory fallback
      const normEmail = email.toLowerCase().trim();
      if (inMemoryUsers.has(normEmail)) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email already exists in active session',
        });
      }

      const mockId = uuidv4();
      createdUser = {
        _id: mockId,
        id: mockId,
        name: name.trim(),
        email: normEmail,
        balance: 50000.0,
        rsaPublicKey: publicKey,
        rsaPrivateKey: privateKey,
        publicKeyFingerprint: fingerprint,
        role: 'user',
        createdAt: new Date(),
      };
      inMemoryUsers.set(normEmail, {
        ...createdUser,
        password: hashedPassword,
      });
    }

    // Log security event
    if (isDbReady) {
      try {
        await SecurityLog.create({
          logId: uuidv4(),
          eventType: 'AUTH_SUCCESS',
          severity: 'INFO',
          details: `New cryptographic identity registered for ${email}. RSA-2048 keypair generated (${fingerprint}).`,
        });
      } catch (e) {}
    }

    const token = generateToken(
      createdUser._id || createdUser.id,
      createdUser.name,
      createdUser.email,
      createdUser.role
    );

    // Private key is NEVER exposed in the API response
    res.status(201).json({
      success: true,
      message: 'User registered successfully with cryptographic credentials',
      token,
      user: {
        id: createdUser._id || createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        balance: createdUser.balance,
        rsaPublicKey: createdUser.rsaPublicKey,
        publicKeyFingerprint: createdUser.publicKeyFingerprint || fingerprint,
        role: createdUser.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    let user = null;
    let isMatch = false;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;

    if (isDbReady) {
      try {
        user = await User.findOne({ email: email.toLowerCase().trim() });
        if (user) {
          isMatch = await bcrypt.compare(password, user.password);
        }
      } catch (dbErr) {}
    }

    if (!user) {
      // Check in-memory store
      const memUser = inMemoryUsers.get(email.toLowerCase().trim());
      if (memUser) {
        isMatch = await bcrypt.compare(password, memUser.password);
        user = memUser;
      }
    }

    if (!user || !isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password credentials',
      });
    }

    const token = generateToken(
      user._id || user.id,
      user.name,
      user.email,
      user.role
    );

    // Private key is NEVER exposed in the response
    res.status(200).json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        rsaPublicKey: user.rsaPublicKey,
        publicKeyFingerprint: user.publicKeyFingerprint || computeKeyFingerprint(user.rsaPublicKey),
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile and public keys (Private key is omitted)
 */
const getProfile = async (req, res, next) => {
  try {
    let user = null;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;
    if (isDbReady && req.user?._id) {
      try {
        user = await User.findById(req.user._id).select('-password -rsaPrivateKey');
      } catch (e) {}
    }

    if (!user && req.user?.email) {
      user = inMemoryUsers.get(req.user.email.toLowerCase().trim());
    }

    if (!user) {
      user = req.user;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User profile not found',
      });
    }

    const safeUser = {
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      balance: user.balance,
      rsaPublicKey: user.rsaPublicKey,
      publicKeyFingerprint: user.publicKeyFingerprint || (user.rsaPublicKey ? computeKeyFingerprint(user.rsaPublicKey) : 'N/A'),
      role: user.role,
    };

    res.status(200).json({
      success: true,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Regenerate RSA Keypair for the user (Private key stays server-side)
 */
const regenerateKeys = async (req, res, next) => {
  try {
    const { publicKey, privateKey, fingerprint } = generateRSAKeyPair();
    const userId = req.user?._id || req.user?.id;
    const isDbReady = mongoose.connection && mongoose.connection.readyState === 1;

    if (isDbReady && userId) {
      try {
        await User.findByIdAndUpdate(userId, {
          rsaPublicKey: publicKey,
          rsaPrivateKey: privateKey,
          publicKeyFingerprint: fingerprint,
        });
      } catch (e) {}
    }

    // Update in memory if present
    if (req.user?.email && inMemoryUsers.has(req.user.email.toLowerCase())) {
      const u = inMemoryUsers.get(req.user.email.toLowerCase());
      u.rsaPublicKey = publicKey;
      u.rsaPrivateKey = privateKey;
      u.publicKeyFingerprint = fingerprint;
    }

    // Never return private key in API response
    res.status(200).json({
      success: true,
      message: 'RSA 2048-bit keypair regenerated successfully',
      publicKey,
      publicKeyFingerprint: fingerprint,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  regenerateKeys,
  inMemoryUsers,
};
