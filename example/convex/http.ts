import { httpRouter } from "convex/server";
import { registerRoutes } from "../../src/component/http";

const http = httpRouter();
registerRoutes(http);

export default http;
