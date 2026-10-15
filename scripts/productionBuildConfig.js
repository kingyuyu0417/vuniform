export const readWranglerProductionVariables = (configText) => {
  const variables = {};
  let inProductionVariables = false;

  String(configText || "").split(/\r?\n/).forEach((line) => {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) {
      inProductionVariables = section[1] === "env.production.vars";
      return;
    }
    if (!inProductionVariables) return;

    const assignment = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);
    if (!assignment) return;
    variables[assignment[1]] = JSON.parse(assignment[2]);
  });

  return variables;
};

export const validateProductionBuildConfig = (environment) => {
  const errors = [];
  const supabaseUrl = String(environment.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(environment.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(supabaseUrl)
    || /xxx|example|placeholder/i.test(supabaseUrl)) {
    errors.push("VITE_SUPABASE_URL must be a valid Supabase project URL.");
  }
  if (!anonKey || /your|placeholder|example|xxx|xxxxxx/i.test(anonKey)) {
    errors.push("VITE_SUPABASE_ANON_KEY must be a configured Supabase public key.");
  }

  return errors;
};
