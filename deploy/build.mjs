// Run by `npx wrangler deploy` (see wrangler.toml): copies the public files to .deploy/dist and compiles functions/
// with wrangler's Pages Functions compiler, so routing ([code].js, index.js, nested folders) works exactly as on Pages.
import { cpSync, rmSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// never served: server code, config, docs, and the deploy folders themselves
const PRIVATE = new Set([".git", ".github", ".wrangler", ".deploy", "deploy", "functions", "node_modules", "wrangler.toml", "README.md", "schema.sql", ".gitignore", "package.json", "package-lock.json"]);

rmSync(".deploy", { recursive: true, force: true });
mkdirSync(".deploy/dist", { recursive: true });
for (const name of readdirSync(".")) if (!PRIVATE.has(name)) cpSync(name, `.deploy/dist/${name}`, { recursive: true });

execSync("npx wrangler pages functions build functions --outdir .deploy/fn --output-routes-path .deploy/_routes.json", { stdio: "inherit" });

// every route the functions claim must run before assets, or the Worker would serve index.html there instead
const routes = JSON.parse(readFileSync(".deploy/_routes.json", "utf8")).include;
const first = JSON.parse(readFileSync("wrangler.toml", "utf8").match(/run_worker_first\s*=\s*(\[[^\]]*\])/)[1]);
const covered = r => first.some(f => f === r || (f.endsWith("/*") && (r === f.slice(0, -2) || r.startsWith(f.slice(0, -1)))));
const missing = routes.filter(r => !covered(r));
if (missing.length) throw new Error(`Add these to run_worker_first in wrangler.toml: ${missing.join(", ")}`);
console.log(`.deploy/dist ready; function routes: ${routes.join(", ")}`);
