import assert from "node:assert/strict";
import test from "node:test";
import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import { noticeTextFromDocx, wordDocumentXmlToText } from "./docxText.js";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

test("extracts paragraph text, tabs, line breaks, and XML entities", () => {
  const xml = `<w:document xmlns:w="${WORD_NAMESPACE}"><w:body>
    <w:p><w:r><w:t>尺碼 &amp; 數量</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>2</w:t><w:br/><w:t>件</w:t></w:r></w:p>
    <w:p><w:r><w:t>白色恤衫</w:t></w:r></w:p>
  </w:body></w:document>`;

  assert.equal(wordDocumentXmlToText(xml, DOMParser), "尺碼 & 數量\t2\n件\n白色恤衫");
});

test("extracts text from the main DOCX document", async () => {
  const archive = new JSZip();
  archive.file("word/document.xml", `<w:document xmlns:w="${WORD_NAMESPACE}"><w:body><w:p><w:r><w:t>訂購通告</w:t></w:r></w:p></w:body></w:document>`);
  const file = { arrayBuffer: () => archive.generateAsync({ type: "arraybuffer" }) };

  assert.equal(await noticeTextFromDocx(file, DOMParser), "訂購通告");
});

test("reports DOCX archives without a document body", async () => {
  const archive = new JSZip();
  const file = { arrayBuffer: () => archive.generateAsync({ type: "arraybuffer" }) };

  await assert.rejects(noticeTextFromDocx(file, DOMParser), /缺少 Word 內文/);
});
