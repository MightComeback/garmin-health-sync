import { fetchLoomSession } from './src/loom.js';

const id = 'e41353f2fe1c43eba6c6829693e0f2c5';
try {
  const session = await fetchLoomSession(id);
  console.log(JSON.stringify(session, null, 2));
} catch (e) {
  console.error(e);
}
