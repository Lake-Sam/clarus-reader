import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "wordnet-db", "dict");
const target = join(root, "public", "wordnet");
await mkdir(target, { recursive: true });
for (const name of ["index.noun", "index.verb", "index.adj", "index.adv", "data.noun", "data.verb", "data.adj", "data.adv"]) {
  await cp(join(source, name), join(target, name));
}
const license = await readFile(join(root, "node_modules", "wordnet-db", "LICENSE"), "utf8").catch(() => "Princeton WordNet 3.1");
await writeFile(join(target, "LICENSE.txt"), license);
