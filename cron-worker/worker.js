// Tiny Cloudflare Worker whose only job is to hit /api/cron/tick on a schedule.
// Deploy separately from the Pages app:  cd cron-worker && wrangler deploy
// Set the secret:  wrangler secret put CRON_SECRET   (same value as the Pages app)
export default {
  async scheduled(event, env, ctx) {
    const url = `${env.APP_URL}/api/cron/tick?token=${env.CRON_SECRET}`;
    const res = await fetch(url);
    console.log('cron tick', res.status, await res.text());
  },
};
