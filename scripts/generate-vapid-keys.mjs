// Run once: node scripts/generate-vapid-keys.mjs
// Then add the output to your .env.local

import webpush from "web-push";
const keys = webpush.generateVAPIDKeys();
console.log("Add these to .env.local:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:you@example.com`);
console.log(`CRON_SECRET=<your-secret>`);
