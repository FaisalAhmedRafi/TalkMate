// Runs before `nest build` (npm "prebuild" hook).
// Hostinger's Node.js builds only run `npm install` + `npm run build`, so the server sets
// MIGRATE_ON_BUILD=1 to generate the Prisma client and apply migrations here.
// Local, CI and Railway builds skip the migration (they run `npm run prisma:deploy` themselves).
const { execSync } = require('node:child_process');

execSync('npx prisma generate', { stdio: 'inherit' }); // postinstall may be skipped by the host
if (process.env.MIGRATE_ON_BUILD === '1') {
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
} else {
  console.log('prebuild: MIGRATE_ON_BUILD is not 1, skipping prisma migrate deploy');
}
