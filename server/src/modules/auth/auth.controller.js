const asyncHandler = require('../../common/utils/asyncHandler');
const { registerUser, loginUser } = require('./auth.service');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production', // Auto-enable in production
  maxAge: 24 * 60 * 60 * 1000,
};

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, token } = await registerUser({ name, email, password });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await loginUser({ email, password });
  res.cookie('token', token, COOKIE_OPTIONS);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

exports.logout = asyncHandler(async (_req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

exports.me = asyncHandler(async (req, res) => {
  const { id, role } = req.user;
  res.json({ user: { id, role } });
});