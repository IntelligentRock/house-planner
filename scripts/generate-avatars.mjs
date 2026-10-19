// Renders the preset avatar set to static SVGs in public/avatars.
// Style: DiceBear "Notionists" by Zoish (CC0 1.0). Re-run only to change the set:
//   node scripts/generate-avatars.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { createAvatar } from "@dicebear/core";
import { notionists } from "@dicebear/collection";

const presets = [
  ["Willow", "e8dcc8"],
  ["Jasper", "dfe8dc"],
  ["Hazel", "f2dccf"],
  ["Otto", "d8e2ec"],
  ["Mila", "eee0c4"],
  ["Bram", "e4dbe9"],
  ["Fenna", "dceae6"],
  ["Sem", "f0d9d9"],
  ["Lotte", "e3e6d2"],
  ["Daan", "ece3d6"],
  ["Noor", "d9e4e9"],
  ["Pip", "f1e6cf"],
  ["Ruben", "e6dccf"],
  ["Isa", "dde5d9"],
  ["Teun", "e9d8cf"],
  ["Roos", "e0dcea"],
  ["Finn", "d6e6e1"],
  ["Elin", "efdcd2"],
];

const outDir = new URL("../public/avatars/", import.meta.url);
mkdirSync(outDir, { recursive: true });

presets.forEach(([seed, background], index) => {
  const svg = createAvatar(notionists, {
    seed,
    backgroundColor: [background],
    radius: 0,
  }).toString();
  const name = `avatar-${String(index + 1).padStart(2, "0")}.svg`;
  writeFileSync(new URL(name, outDir), svg);
});

console.log(`Wrote ${presets.length} avatars to public/avatars`);
