// Cloudflare Worker entry. Deploy: see ../README.md
import { handle, type Env } from "../src/core.ts";

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env);
  },
};
