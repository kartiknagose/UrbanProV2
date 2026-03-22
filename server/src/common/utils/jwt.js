const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../config/env');

function signJwt(payload, options = {}) {
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';
  const issuer = process.env.JWT_ISSUER;
  const audience = process.env.JWT_AUDIENCE;
  const signOptions = {
    algorithm: 'HS256',
    expiresIn: jwtExpiresIn,
    ...options,
  };

  if (issuer) signOptions.issuer = issuer;
  if (audience) signOptions.audience = audience;

  return jwt.sign(payload, JWT_SECRET, signOptions);
}

function verifyJwt(token) {
  try {
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;
    const verifyOptions = {
      algorithms: ['HS256'],
    };

    if (issuer) verifyOptions.issuer = issuer;
    if (audience) verifyOptions.audience = audience;

    return jwt.verify(token, JWT_SECRET, verifyOptions);
  } catch {
    return null;
  }
}

module.exports = { signJwt, verifyJwt };