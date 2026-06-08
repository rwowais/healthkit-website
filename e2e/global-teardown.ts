import { adminClient, EMAIL_PREFIX } from "./lib/supa";

/**
 * Delete every test user this project created — A, B, the deletion spec's
 * throwaway user, and any orphans left by a crashed earlier run. Matching on
 * the distinctive EMAIL_PREFIX guarantees we only ever touch test identities,
 * never a real account, even when running against production. Deleting the
 * auth user cascades its protocolize_state / protocolize_logs / push rows.
 */
export default async function globalTeardown() {
  let admin;
  try {
    admin = adminClient();
  } catch {
    return; // no creds → nothing was provisioned
  }
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) break;
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (u.email && u.email.startsWith(EMAIL_PREFIX)) {
        await admin.auth.admin.deleteUser(u.id).catch(() => {});
      }
    }
    if (users.length < 200) break;
  }
}
