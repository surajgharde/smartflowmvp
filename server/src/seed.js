/**
 * Seeds the SmartFlow database: the Nagpur corridor network and three demo
 * accounts spanning the role model. Safe to re-run — it upserts corridors and
 * leaves existing scenarios and reports untouched unless --reset is passed.
 */

import bcrypt from 'bcryptjs';
import { connectDb, disconnectDb } from './db.js';
import { Corridor } from './models/Corridor.js';
import { User } from './models/User.js';
import { Simulation } from './models/Simulation.js';
import { Report } from './models/Report.js';
import { CORRIDORS } from './data/nagpurNetwork.js';

const DEMO_USERS = [
  {
    name: 'Dr. Anjali Deshmukh',
    email: 'commissioner@nagpur.gov.in',
    password: 'smartflow',
    role: 'commissioner',
    designation: 'Traffic Commissioner',
    authority: 'NMC',
  },
  {
    name: 'Rohit Kalambe',
    email: 'engineer@nmc.gov.in',
    password: 'smartflow',
    role: 'engineer',
    designation: 'Executive Engineer, Traffic Cell',
    authority: 'NIT',
  },
  {
    name: 'Sneha Wankhede',
    email: 'analyst@nmrda.gov.in',
    password: 'smartflow',
    role: 'analyst',
    designation: 'Transport Data Analyst',
    authority: 'NMRDA',
  },
];

async function seed() {
  const reset = process.argv.includes('--reset');

  await connectDb();
  console.log('[seed] connected to MongoDB');

  if (reset) {
    await Promise.all([
      Corridor.deleteMany({}),
      User.deleteMany({}),
      Simulation.deleteMany({}),
      Report.deleteMany({}),
    ]);
    console.log('[seed] cleared existing collections (--reset)');
  }

  let upserted = 0;
  for (const corridor of CORRIDORS) {
    await Corridor.updateOne({ code: corridor.code }, { $set: corridor }, { upsert: true });
    upserted += 1;
  }
  console.log(`[seed] ${upserted} corridors upserted`);

  for (const u of DEMO_USERS) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`[seed] user exists → ${u.email}`);
      continue;
    }
    await User.create({
      name: u.name,
      email: u.email,
      passwordHash: await bcrypt.hash(u.password, 10),
      role: u.role,
      designation: u.designation,
      authority: u.authority,
    });
    console.log(`[seed] user created → ${u.email} / ${u.password}`);
  }

  console.log('\n[seed] done. Demo sign-ins:');
  for (const u of DEMO_USERS) {
    console.log(`         ${u.role.padEnd(13)} ${u.email}  /  ${u.password}`);
  }

  await disconnectDb();
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
