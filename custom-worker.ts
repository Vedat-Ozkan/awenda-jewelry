// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- `.open-next/worker.js` is generated at build time; ts-expect-error would break once it exists
// @ts-ignore
import { default as handler } from "./.open-next/worker.js";

// CRON_SECRET is a Worker secret (`wrangler secret put CRON_SECRET`), so it is
// not declared in wrangler.jsonc `vars` and `cf-typegen` does not know about it.
type EnvWithCronSecret = CloudflareEnv & { CRON_SECRET: string };

export default {
  fetch: handler.fetch,

  async scheduled(_event, env, ctx) {
    const { CRON_SECRET } = env as EnvWithCronSecret;
    ctx.waitUntil(
      handler
        .fetch(
          new Request("https://awenda-jewelry.internal/api/keepalive", {
            headers: { "x-cron-secret": CRON_SECRET },
          }),
          env,
          ctx,
        )
        .then((response: Response) => {
          if (!response.ok) {
            console.error(`Keepalive ping failed: ${response.status}`);
          }
        }),
    );
  },
} satisfies ExportedHandler<CloudflareEnv>;
