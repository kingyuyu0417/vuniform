import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const normalize = (value: string) => value.replace(/\s+/g, "").toLowerCase();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const endpoint = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("AZURE_DOCUMENT_INTELLIGENCE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !endpoint || !apiKey) {
    return json({ error: "Document analysis is not configured" }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Login required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Login required" }, 401);
  const { data: actor, error: actorError } = await userClient
    .from("staff_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (actorError || !["admin", "manager"].includes(actor?.role)) return json({ error: "Manager role required" }, 403);

  const body = await request.json();
  const targetSchool = String(body.targetSchool || "").trim();
  const contentType = String(body.contentType || "").toLowerCase();
  const encoded = String(body.fileBase64 || "");
  if (!targetSchool || !encoded || !["application/pdf", "image/jpeg", "image/png"].includes(contentType)) {
    return json({ error: "Invalid source document" }, 400);
  }

  let sourceBytes: Uint8Array;
  try {
    sourceBytes = decodeBase64(encoded);
  } catch {
    return json({ error: "Invalid source document encoding" }, 400);
  }
  if (sourceBytes.byteLength === 0 || sourceBytes.byteLength > 20 * 1024 * 1024) return json({ error: "Document must be between 1 byte and 20MB" }, 400);

  const analyzeUrl = `${endpoint}/documentModels/prebuilt-layout:analyze?api-version=2024-11-30`;
  const analyzeResponse = await fetch(analyzeUrl, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": apiKey, "Content-Type": contentType },
    body: sourceBytes,
  });
  if (!analyzeResponse.ok) return json({ error: `Document analysis request failed (${analyzeResponse.status})` }, 502);
  const operationLocation = analyzeResponse.headers.get("Operation-Location");
  if (!operationLocation) return json({ error: "Document analysis did not return an operation" }, 502);

  let result: any = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const pollResponse = await fetch(operationLocation, { headers: { "Ocp-Apim-Subscription-Key": apiKey } });
    if (!pollResponse.ok) return json({ error: `Document analysis polling failed (${pollResponse.status})` }, 502);
    result = await pollResponse.json();
    if (result.status === "succeeded" || result.status === "failed") break;
  }
  if (!result || result.status !== "succeeded") return json({ error: "Document analysis timed out or failed" }, 502);

  const content = String(result.analyzeResult?.content || "");
  const tables = (result.analyzeResult?.tables || []).map((table: any) => ({
    rowCount: table.rowCount,
    columnCount: table.columnCount,
    cells: (table.cells || []).map((cell: any) => ({ rowIndex: cell.rowIndex, columnIndex: cell.columnIndex, content: cell.content })),
  }));
  const issues: string[] = [];
  if (!normalize(content).includes(normalize(targetSchool))) issues.push("文件內未能確認學校名稱與目前選擇一致，必須人工核對。");
  if (!tables.length) issues.push("未偵測到表格，尺碼及價格可能需要人工逐項輸入或核對。");
  if (!content.trim()) issues.push("文件沒有可讀取文字，可能需要較清晰的圖片或掃描檔。");
  issues.push("OCR 結果只作分析提示；所有價格、尺碼及裁碼仍必須人工確認後才可發布。");

  return json({
    status: "succeeded",
    targetSchool,
    extractedText: content,
    tables,
    issues,
    documentSchoolMatched: normalize(content).includes(normalize(targetSchool)),
  });
});
