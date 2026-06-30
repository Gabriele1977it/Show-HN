// EchoDeck server entry point.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createStore } from "./store.js";
import { createApp } from "./app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.ECHODECK_DATA || join(ROOT, "data", "db.json");
const UPLOADS_DIR = process.env.ECHODECK_UPLOADS || join(ROOT, "uploads");

const store = createStore(DATA_FILE);
const app = createApp({ store, uploadsDir: UPLOADS_DIR });

app.listen(PORT, () => {
  console.log(`EchoDeck running on http://localhost:${PORT}`);
});
