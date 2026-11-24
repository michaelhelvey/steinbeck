import { access, constants, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { STEINBECK_FUNCTION, upsertBlock } from "./shell-block.ts";

const ROOT = resolve(import.meta.dir, "..");
const BUILT_APP = join(ROOT, "src-tauri/target/release/bundle/macos/Steinbeck.app");
const ZSHRC = join(homedir(), ".zshrc");

function step(message: string) {
  console.log(`\n\x1b[33m==>\x1b[0m \x1b[1m${message}\x1b[0m`);
}

async function run(command: string[]) {
  const proc = Bun.spawn(command, { cwd: ROOT, stdio: ["inherit", "inherit", "inherit"] });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`'${command.join(" ")}' failed with exit code ${code}`);
}

async function requireTool(tool: string, hint: string) {
  if (!Bun.which(tool)) throw new Error(`'${tool}' is not installed. ${hint}`);
}

async function writable(directory: string) {
  try {
    await access(directory, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function applicationsDirectory() {
  if (await writable("/Applications")) return "/Applications";
  const personal = join(homedir(), "Applications");
  await mkdir(personal, { recursive: true });
  return personal;
}

async function installApp() {
  const target = join(await applicationsDirectory(), "Steinbeck.app");
  await rm(target, { recursive: true, force: true });
  await run(["ditto", BUILT_APP, target]);
  return target;
}

async function installShellFunction() {
  const rc = Bun.file(ZSHRC);
  const current = (await rc.exists()) ? await rc.text() : "";
  const next = upsertBlock(current, STEINBECK_FUNCTION);
  if (next !== current) await Bun.write(ZSHRC, next);
  return next !== current;
}

async function main() {
  if (process.platform !== "darwin") throw new Error("setup supports macOS only");
  await requireTool("cargo", "Install Rust from https://rustup.rs and run setup again.");

  step("Installing JavaScript dependencies");
  await run(["bun", "install"]);

  step("Building Steinbeck (the first build takes a few minutes)");
  await run(["bun", "run", "tauri", "build", "--bundles", "app"]);

  step("Installing Steinbeck.app");
  const installed = await installApp();
  console.log(`Installed ${installed}`);

  step("Adding the `steinbeck` command to ~/.zshrc");
  const changed = await installShellFunction();
  console.log(changed ? "Added the steinbeck function." : "The steinbeck function is current.");

  console.log("\n\x1b[32mDone.\x1b[0m Open a new terminal (or run `source ~/.zshrc`), then:");
  console.log("  steinbeck draft.md");
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n\x1b[31msetup failed:\x1b[0m ${message}`);
  process.exit(1);
}
