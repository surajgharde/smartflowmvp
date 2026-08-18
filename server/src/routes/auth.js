import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user) return res.status(401).json({ error: 'No account found for that email' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Incorrect password' });

  return res.json({ token: signToken(user), user: user.toPublic() });
});

authRouter.post('/register', async (req, res) => {
  const { name, email, password, role, authority, designation } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const exists = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (exists) return res.status(409).json({ error: 'An account with that email already exists' });

  const user = await User.create({
    name,
    email: String(email).toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, 10),
    role: ['commissioner', 'engineer', 'analyst'].includes(role) ? role : 'analyst',
    authority: ['NMC', 'NIT', 'NMRDA', 'PWD', 'NHAI'].includes(authority) ? authority : 'NMC',
    designation: designation || '',
  });

  return res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});
