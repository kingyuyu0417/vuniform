export const productDisplayName = (name = "") => String(name || "")
  .replace(/(?:[（(【]\s*)?(?:兩季通用|四季通用|全年通用|男女通用)(?:\s*[）)】])?\s*[-–—:：]?\s*/g, "")
  .replace(/(?:【)?(?:男生|女生|男女生)(?:】)?\s*[-–—:：]?\s*/g, "")
  .replace(/\b(?:Boy|Girl)[`'’]s\b\s*[-–—:：]?\s*/gi, "")
  .replace(/\s+/g, " ")
  .replace(/校\s+褸/g, "校褸")
  .trim();
