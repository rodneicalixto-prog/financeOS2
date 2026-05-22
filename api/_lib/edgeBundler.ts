// =============================================================================
// Bundler simples para Edge Functions.
// -----------------------------------------------------------------------------
// O Supabase Management API (POST/PATCH /v1/projects/{ref}/functions/{slug})
// aceita o source da função como UMA string. Mas nossas EFs usam imports
// relativos (`../_shared/credentials.ts`) — fora do CLI/eszip, esses imports
// não resolvem em runtime.
//
// Este bundler resolve recursivamente todos os imports relativos a partir do
// `index.ts` da função, inline-a o conteúdo (em ordem topológica) e remove as
// linhas de import locais. Imports de URL (deno.land, esm.sh) ficam intactos.
//
// Limitações conhecidas:
//   - assume que módulos relativos terminam em `.ts`
//   - assume que cada `export function/const/let/class/interface X` no shared é
//     usado como `X` direto no consumidor (não há aliases tipo `import { X as Y }`)
//   - não suporta re-exports (`export * from`) — não há nenhum no repo atual
// =============================================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';

const REL_IMPORT_RE = /^\s*import\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"](\.[^'"]+)['"];?\s*$/gm;

async function readIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

export async function bundleEdgeFunction(functionsRoot: string, slug: string): Promise<string> {
  const entry = path.join(functionsRoot, slug, 'index.ts');
  const seen = new Set<string>();
  const inlined: string[] = [];

  async function resolve(filePath: string): Promise<void> {
    const abs = path.resolve(filePath);
    if (seen.has(abs)) return;
    seen.add(abs);

    const raw = await readIfExists(abs);
    if (raw === null) {
      throw new Error(`Edge bundler: arquivo não encontrado: ${abs}`);
    }

    // Encontra imports relativos antes de strip (precisamos da lista).
    const dir = path.dirname(abs);
    const localImports: string[] = [];
    let match: RegExpExecArray | null;
    REL_IMPORT_RE.lastIndex = 0;
    while ((match = REL_IMPORT_RE.exec(raw)) !== null) {
      const spec = match[1];
      if (!spec.startsWith('.')) continue;
      const resolved = path.resolve(dir, spec);
      localImports.push(resolved);
    }

    // Recursão first (DFS) — dependências aparecem ANTES no bundle final.
    for (const dep of localImports) {
      await resolve(dep);
    }

    // Remove linhas de import relativo do conteúdo.
    const stripped = raw.replace(REL_IMPORT_RE, '');
    inlined.push(`// ===== ${path.relative(functionsRoot, abs)} =====\n${stripped}`);
  }

  await resolve(entry);
  return inlined.join('\n\n');
}
