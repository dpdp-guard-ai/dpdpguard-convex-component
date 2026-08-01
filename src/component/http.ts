import { httpRouter } from 'convex/server';
import { receive } from './webhooks';

// Not itself registered against convex's own http router - this is a
// factory the host app calls from its own convex/http.ts:
//
//   import { registerRoutes } from "@dpdpguard/convex/http";
//   const http = httpRouter();
//   registerRoutes(http);
//   export default http;
export function registerRoutes(http: ReturnType<typeof httpRouter>) {
  http.route({
    path: '/dpdpguard/webhook',
    method: 'POST',
    handler: receive,
  });
  return http;
}
