import { defineApp } from "convex/server";
import dpdpguard from "../../src/component/convex.config";

const app = defineApp();
app.use(dpdpguard);

export default app;
