import JSZip from "jszip";

const WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const textFromNode = (node) => {
  if (node.nodeType === 1 && node.namespaceURI === WORD_NAMESPACE) {
    if (node.localName === "t") return node.textContent || "";
    if (node.localName === "tab") return "\t";
    if (node.localName === "br" || node.localName === "cr") return "\n";
  }
  return Array.from(node.childNodes || [], textFromNode).join("");
};

export const wordDocumentXmlToText = (xml, Parser = globalThis.DOMParser) => {
  if (typeof Parser !== "function") throw new Error("目前環境不支援 DOCX 文件解析。");
  const document = new Parser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error("DOCX 文件內容無效，無法讀取。");
  }
  const paragraphs = Array.from(document.getElementsByTagNameNS(WORD_NAMESPACE, "p"));
  return paragraphs.map(textFromNode).join("\n");
};

export const noticeTextFromDocx = async (file, Parser = globalThis.DOMParser) => {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const document = archive.file("word/document.xml");
  if (!document) throw new Error("DOCX 文件缺少 Word 內文，無法讀取。");
  return wordDocumentXmlToText(await document.async("string"), Parser);
};
