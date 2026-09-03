export interface FrontmatterProperty {
  key: string;
  value: any;
  type: "string" | "number" | "boolean" | "list" | "object";
}

export function parseYamlFrontmatter(yamlStr: string): FrontmatterProperty[] {
  if (!yamlStr || !yamlStr.trim()) return [];
  const lines = yamlStr.split(/\r?\n/);
  const result: FrontmatterProperty[] = [];
  let currentEntry: FrontmatterProperty | null = null;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1].length : 0;

    // Check for block list item: "  - item"
    const listItemMatch = line.match(/^\s*-\s+(.*)$/);
    if (listItemMatch && currentEntry) {
      if (!Array.isArray(currentEntry.value)) {
        currentEntry.value = [];
        currentEntry.type = "list";
      }
      let val = listItemMatch[1].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      currentEntry.value.push(val);
      continue;
    }

    // Check for nested key-value: "  subKey: subVal"
    const nestedKvMatch = line.match(/^\s+([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (nestedKvMatch && currentEntry && indent > 0) {
      if (
        typeof currentEntry.value !== "object" ||
        Array.isArray(currentEntry.value)
      ) {
        currentEntry.value = {};
        currentEntry.type = "object";
      }
      const subKey = nestedKvMatch[1].trim();
      let subVal: any = nestedKvMatch[2].trim();
      if (
        (subVal.startsWith('"') && subVal.endsWith('"')) ||
        (subVal.startsWith("'") && subVal.endsWith("'"))
      ) {
        subVal = subVal.slice(1, -1);
      } else if (subVal === "true") subVal = true;
      else if (subVal === "false") subVal = false;
      else if (!isNaN(Number(subVal)) && subVal !== "") subVal = Number(subVal);
      currentEntry.value[subKey] = subVal;
      continue;
    }

    // Top-level key: value
    const topKvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (topKvMatch) {
      const key = topKvMatch[1].trim();
      let rawVal = topKvMatch[2].trim();
      let parsedVal: any;
      let type: "string" | "number" | "boolean" | "list" | "object" = "string";

      if (rawVal === "" || rawVal === "[]") {
        parsedVal = [];
        type = "list";
      } else if (rawVal === "{}") {
        parsedVal = {};
        type = "object";
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        parsedVal = rawVal
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean);
        type = "list";
      } else if (rawVal === "true") {
        parsedVal = true;
        type = "boolean";
      } else if (rawVal === "false") {
        parsedVal = false;
        type = "boolean";
      } else if (!isNaN(Number(rawVal)) && rawVal !== "") {
        parsedVal = Number(rawVal);
        type = "number";
      } else {
        if (
          (rawVal.startsWith('"') && rawVal.endsWith('"')) ||
          (rawVal.startsWith("'") && rawVal.endsWith("'"))
        ) {
          rawVal = rawVal.slice(1, -1);
        }
        parsedVal = rawVal;
        type = "string";
      }

      currentEntry = { key, value: parsedVal, type };
      result.push(currentEntry);
    }
  }

  return result;
}

export function serializeYamlFrontmatter(
  entries: Array<{ key: string; value: any; type?: string }>
): string {
  if (!entries || entries.length === 0) return "";
  const lines: string[] = [];

  for (const { key, value, type } of entries) {
    if (!key.trim()) continue;

    if (value === null || value === undefined || value === "") {
      lines.push(`${key}: ""`);
    } else if (type === "boolean" || typeof value === "boolean") {
      lines.push(`${key}: ${value ? "true" : "false"}`);
    } else if (type === "number" || typeof value === "number") {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else if (
        value.every(
          (v) => typeof v === "string" && !v.includes("\n") && v.length < 30
        ) &&
        value.length <= 4
      ) {
        lines.push(`${key}: [${value.map((v) => JSON.stringify(v)).join(", ")}]`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          const itemStr = String(item);
          lines.push(
            `  - ${
              itemStr.includes(":") || itemStr.includes("#") || itemStr.includes("'")
                ? JSON.stringify(itemStr)
                : itemStr
            }`
          );
        }
      }
    } else if (typeof value === "object") {
      lines.push(`${key}:`);
      for (const [k, v] of Object.entries(value)) {
        const vStr = String(v);
        lines.push(
          `  ${k}: ${
            typeof v === "string" && (vStr.includes(":") || vStr.includes("#"))
              ? JSON.stringify(vStr)
              : vStr
          }`
        );
      }
    } else {
      const str = String(value);
      if (
        str.includes(":") ||
        str.includes("#") ||
        str.includes("'") ||
        str.includes('"') ||
        str.startsWith("-") ||
        str.startsWith("@") ||
        str.startsWith("%")
      ) {
        lines.push(`${key}: ${JSON.stringify(str)}`);
      } else {
        lines.push(`${key}: ${str}`);
      }
    }
  }

  return lines.join("\n");
}
