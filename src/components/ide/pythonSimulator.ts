/**
 * Basic Python interpreter/simulator for Marv-IA IDE
 * Supports: print, variables, arithmetic, strings, lists, loops, conditionals, functions
 */

type PyValue = string | number | boolean | PyValue[] | null;

interface PyOutput {
  type: "log" | "error" | "info";
  text: string;
}

export function executePython(code: string): PyOutput[] {
  const outputs: PyOutput[] = [];
  const log = (text: string) => outputs.push({ type: "log", text });
  const error = (text: string) => outputs.push({ type: "error", text });
  const info = (text: string) => outputs.push({ type: "info", text });

  const variables: Record<string, PyValue> = {};
  const functions: Record<string, { params: string[]; body: string[] }> = {};

  const lines = code.split("\n");

  function evaluateExpr(expr: string): PyValue {
    expr = expr.trim();
    if (expr === "") return null;
    if (expr === "None") return null;
    if (expr === "True") return true;
    if (expr === "False") return false;

    // String literals
    if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))) {
      return expr.slice(1, -1);
    }

    // f-string basic support
    if (expr.startsWith('f"') && expr.endsWith('"') || expr.startsWith("f'") && expr.endsWith("'")) {
      const inner = expr.slice(2, -1);
      return inner.replace(/\{([^}]+)\}/g, (_, e) => String(evaluateExpr(e)));
    }

    // List literal
    if (expr.startsWith("[") && expr.endsWith("]")) {
      const inner = expr.slice(1, -1).trim();
      if (inner === "") return [];
      return splitArgs(inner).map(e => evaluateExpr(e));
    }

    // len()
    const lenMatch = expr.match(/^len\((.+)\)$/);
    if (lenMatch) {
      const val = evaluateExpr(lenMatch[1]);
      if (Array.isArray(val)) return val.length;
      if (typeof val === "string") return val.length;
      return 0;
    }

    // type()
    const typeMatch = expr.match(/^type\((.+)\)$/);
    if (typeMatch) {
      const val = evaluateExpr(typeMatch[1]);
      if (val === null) return "<class 'NoneType'>";
      if (typeof val === "number") return Number.isInteger(val) ? "<class 'int'>" : "<class 'float'>";
      if (typeof val === "string") return "<class 'str'>";
      if (typeof val === "boolean") return "<class 'bool'>";
      if (Array.isArray(val)) return "<class 'list'>";
      return "<class 'object'>";
    }

    // str(), int(), float()
    const strMatch = expr.match(/^str\((.+)\)$/);
    if (strMatch) return String(evaluateExpr(strMatch[1]));
    const intMatch = expr.match(/^int\((.+)\)$/);
    if (intMatch) return Math.floor(Number(evaluateExpr(intMatch[1])));
    const floatMatch = expr.match(/^float\((.+)\)$/);
    if (floatMatch) return Number(evaluateExpr(floatMatch[1]));

    // range() returns list
    const rangeMatch = expr.match(/^range\((.+)\)$/);
    if (rangeMatch) {
      const args = splitArgs(rangeMatch[1]).map(a => Number(evaluateExpr(a)));
      const result: number[] = [];
      const start = args.length >= 2 ? args[0] : 0;
      const end = args.length >= 2 ? args[1] : args[0];
      const step = args[2] || 1;
      for (let i = start; step > 0 ? i < end : i > end; i += step) result.push(i);
      return result;
    }

    // input() - simulated
    const inputMatch = expr.match(/^input\((.*)?\)$/);
    if (inputMatch) {
      const prompt = inputMatch[1] ? String(evaluateExpr(inputMatch[1])) : "";
      info(`⌨️ input("${prompt}") → "utilisateur" (simulé)`);
      return "utilisateur";
    }

    // .append(), .upper(), .lower()
    const methodMatch = expr.match(/^(\w+)\.(\w+)\(([^)]*)\)$/);
    if (methodMatch) {
      const [, varName, method, argStr] = methodMatch;
      const obj = variables[varName];
      if (method === "append" && Array.isArray(obj)) {
        obj.push(evaluateExpr(argStr));
        return null;
      }
      if (method === "upper" && typeof obj === "string") return obj.toUpperCase();
      if (method === "lower" && typeof obj === "string") return obj.toLowerCase();
      if (method === "split" && typeof obj === "string") {
        const sep = argStr ? String(evaluateExpr(argStr)) : " ";
        return obj.split(sep);
      }
      if (method === "join" && typeof obj === "string") {
        const arr = evaluateExpr(argStr);
        if (Array.isArray(arr)) return arr.map(String).join(obj);
      }
    }

    // list indexing
    const indexMatch = expr.match(/^(\w+)\[(.+)\]$/);
    if (indexMatch) {
      const val = variables[indexMatch[1]];
      const idx = Number(evaluateExpr(indexMatch[2]));
      if (Array.isArray(val)) return val[idx < 0 ? val.length + idx : idx] ?? null;
      if (typeof val === "string") return val[idx < 0 ? val.length + idx : idx] ?? null;
    }

    // Arithmetic and comparisons
    // String concatenation with +
    if (expr.includes("+") && !expr.match(/^\d/)) {
      const parts = expr.split("+").map(p => evaluateExpr(p.trim()));
      if (parts.some(p => typeof p === "string")) return parts.map(String).join("");
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);

    // Variable
    if (/^\w+$/.test(expr) && expr in variables) return variables[expr];

    // Function call
    const funcCallMatch = expr.match(/^(\w+)\(([^)]*)\)$/);
    if (funcCallMatch && funcCallMatch[1] in functions) {
      const fn = functions[funcCallMatch[1]];
      const args = funcCallMatch[2] ? splitArgs(funcCallMatch[2]).map(a => evaluateExpr(a)) : [];
      const prevVars = { ...variables };
      fn.params.forEach((p, i) => { variables[p] = args[i] ?? null; });
      const result = executeBlock(fn.body);
      Object.assign(variables, prevVars);
      fn.params.forEach(p => { if (!(p in prevVars)) delete variables[p]; });
      return result;
    }

    // Simple arithmetic eval (safe)
    try {
      const resolved = expr.replace(/\b([a-zA-Z_]\w*)\b/g, (match) => {
        if (match in variables) {
          const v = variables[match];
          return typeof v === "string" ? `"${v}"` : String(v);
        }
        return match;
      });
      // Only allow safe chars
      if (/^[\d\s+\-*/%().><!=&|"']+$/.test(resolved)) {
        const result = new Function(`return (${resolved})`)();
        return result;
      }
    } catch {}

    return expr; // Return as string if can't evaluate
  }

  function splitArgs(str: string): string[] {
    const args: string[] = [];
    let depth = 0;
    let current = "";
    let inStr: string | null = null;
    for (const ch of str) {
      if (inStr) {
        current += ch;
        if (ch === inStr) inStr = null;
        continue;
      }
      if (ch === '"' || ch === "'") { inStr = ch; current += ch; continue; }
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) { args.push(current.trim()); current = ""; continue; }
      current += ch;
    }
    if (current.trim()) args.push(current.trim());
    return args;
  }

  function formatValue(val: PyValue): string {
    if (val === null) return "None";
    if (val === true) return "True";
    if (val === false) return "False";
    if (Array.isArray(val)) return `[${val.map(formatValue).join(", ")}]`;
    return String(val);
  }

  function executeBlock(blockLines: string[]): PyValue {
    for (let i = 0; i < blockLines.length; i++) {
      const line = blockLines[i].trim();
      if (line === "" || line.startsWith("#")) continue;

      // Return statement
      if (line.startsWith("return ")) {
        return evaluateExpr(line.slice(7));
      }

      // Print
      const printMatch = line.match(/^print\((.+)\)$/);
      if (printMatch) {
        const args = splitArgs(printMatch[1]);
        log(args.map(a => formatValue(evaluateExpr(a))).join(" "));
        continue;
      }

      // Variable assignment
      const assignMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
      if (assignMatch && !line.includes("==")) {
        variables[assignMatch[1]] = evaluateExpr(assignMatch[2]);
        continue;
      }

      // Augmented assignment
      const augMatch = line.match(/^(\w+)\s*([+\-*/%])=\s*(.+)$/);
      if (augMatch) {
        const [, name, op, val] = augMatch;
        const current = Number(variables[name] || 0);
        const operand = Number(evaluateExpr(val));
        const ops: Record<string, (a: number, b: number) => number> = {
          "+": (a, b) => a + b, "-": (a, b) => a - b, "*": (a, b) => a * b,
          "/": (a, b) => a / b, "%": (a, b) => a % b,
        };
        variables[name] = ops[op](current, operand);
        continue;
      }

      // If/elif/else (basic single-line support)
      if (line.startsWith("if ") || line.startsWith("elif ") || line.startsWith("else:")) {
        // Collect the if/elif/else block
        const condBlocks: { condition: string | null; body: string[] }[] = [];
        let j = i;
        while (j < blockLines.length) {
          const bl = blockLines[j].trim();
          if (bl.startsWith("if ") && bl.endsWith(":")) {
            condBlocks.push({ condition: bl.slice(3, -1), body: [] });
          } else if (bl.startsWith("elif ") && bl.endsWith(":")) {
            condBlocks.push({ condition: bl.slice(5, -1), body: [] });
          } else if (bl === "else:") {
            condBlocks.push({ condition: null, body: [] });
          } else if (blockLines[j].startsWith("    ") || blockLines[j].startsWith("\t")) {
            if (condBlocks.length > 0) condBlocks[condBlocks.length - 1].body.push(blockLines[j].replace(/^    |\t/, ""));
          } else {
            break;
          }
          j++;
        }
        i = j - 1;

        for (const cb of condBlocks) {
          if (cb.condition === null || evaluateExpr(cb.condition)) {
            const result = executeBlock(cb.body);
            if (result !== null && result !== undefined) return result;
            break;
          }
        }
        continue;
      }

      // For loop
      const forMatch = line.match(/^for\s+(\w+)\s+in\s+(.+):$/);
      if (forMatch) {
        const [, varName, iterExpr] = forMatch;
        const iterable = evaluateExpr(iterExpr);
        const body: string[] = [];
        let j = i + 1;
        while (j < blockLines.length && (blockLines[j].startsWith("    ") || blockLines[j].startsWith("\t"))) {
          body.push(blockLines[j].replace(/^    |\t/, ""));
          j++;
        }
        i = j - 1;

        if (Array.isArray(iterable)) {
          for (const item of iterable) {
            variables[varName] = item;
            executeBlock(body);
          }
        }
        continue;
      }

      // While loop
      const whileMatch = line.match(/^while\s+(.+):$/);
      if (whileMatch) {
        const body: string[] = [];
        let j = i + 1;
        while (j < blockLines.length && (blockLines[j].startsWith("    ") || blockLines[j].startsWith("\t"))) {
          body.push(blockLines[j].replace(/^    |\t/, ""));
          j++;
        }
        i = j - 1;
        let safety = 0;
        while (evaluateExpr(whileMatch[1]) && safety < 1000) {
          executeBlock(body);
          safety++;
        }
        if (safety >= 1000) error("⚠️ Boucle while interrompue (limite 1000 itérations)");
        continue;
      }

      // Function definition
      const defMatch = line.match(/^def\s+(\w+)\(([^)]*)\):$/);
      if (defMatch) {
        const [, name, paramsStr] = defMatch;
        const params = paramsStr ? paramsStr.split(",").map(p => p.trim()) : [];
        const body: string[] = [];
        let j = i + 1;
        while (j < blockLines.length && (blockLines[j].startsWith("    ") || blockLines[j].startsWith("\t"))) {
          body.push(blockLines[j].replace(/^    |\t/, ""));
          j++;
        }
        i = j - 1;
        functions[name] = { params, body };
        continue;
      }

      // Method calls or expressions (like list.append)
      if (line.includes("(")) {
        evaluateExpr(line);
        continue;
      }
    }
    return null;
  }

  try {
    info("🐍 Exécution Python (simulée)...");
    executeBlock(lines);
    info("✅ Exécution terminée");
  } catch (e) {
    error(`❌ Erreur: ${e instanceof Error ? e.message : String(e)}`);
  }

  return outputs;
}
