const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "vu-two-schools");
fs.mkdirSync(output, { recursive: true });
const files = [
  ["\\\\VU\\Sales\\Dede Lam\\蝴蝶中學\\唐賓南中學- (失敗)\\唐賓南-2026投標.docx", "tong-bun-nam-2026.docx"],
  ["\\\\VU\\Sales\\Dede Lam\\鳴琴中學\\恩平工商會李琳明- (入校)\\通告-2026.docx", "li-lin-ming-2026.docx"],
];
for (const [source, name] of files) {
  const destination = path.join(output, name);
  fs.writeFileSync(destination, fs.readFileSync(source));
  console.log(`${name}: ${fs.statSync(destination).size}`);
}
