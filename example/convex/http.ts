import { httpRouter } from "convex/server";
import { registerRoutes } from "../../src/component/registerDpdpRoutes";

const http = httpRouter();
registerRoutes(http);

export default http;
