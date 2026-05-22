// =============================================================================
// Bundler simples para Edge Functions.
// -----------------------------------------------------------------------------
// O deploy via Management API (POST /v1/projects/{ref}/functions/deploy) sobe
// UM arquivo `index.ts`. Mas nossas EFs usam imports relativos
// (`../_shared/credentials.ts`) que não resolvem nesse modo single-file.
//
// Este bundler resolve recursivamente os imports relativos a partir do
// `index.ts`, inline-a o conteúdo (em ordem topológica) e remove as linhas de
// import locais. Os imports de URL (deno.land, esm.sh) são HOISTADOS para o topo
// e DEDUPLICADOS — senão dois arquivos importando o mesmo binding da mesma URL
// (ex.: `createClient` em index.ts e em _shared/credentials.ts) gerariam
// "Identifier already declared" no Deno.
//
// Limitações conhecidas:
//   - assume imports de uma única linha (sem `import {\n ... \n} from`)
//   - assume que módulos relativos terminam em `.ts`
//   - dedup de URL imports é por linha normalizada; não MERGE specifiers
//     diferentes da mesma URL (não ocorre no repo: cada URL tem um conjunto fixo
//     de bindings). Se isso mudar, o deploy falha alto (ver phaseDeploy).
//   - não suporta re-exports (`export * from`) — não há nenhum no repo atual
// =============================================================================

import { promises as fs } from 'node:fs';
import path from 'node:path';

// Casa qualquer import de uma única linha. group1 = specifier (o que está entre
// aspas). Cobre `import x from '...'`, `import { a } from '...'`,
// `import type { T } from '...'` e o side-effect `import '...'`.
const IMPORT_LINE_RE = /^\s*import\s+(?:[^'"]*\bfrom\b\s+)?['"]([^'"]+)['"];?\s*$/gm;

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
  const urlImports = new Set<string>(); // linhas normalizadas, já deduplicadas

  async function resolve(filePath: string): Promise<void> {
    const abs = path.resolve(filePath);
    if (seen.has(abs)) return;
    seen.add(abs);

    const raw = await readIfExists(abs);
    if (raw === null) {
      throw new Error(`Edge bundler: arquivo não encontrado: ${abs}`);
    }

    // 1) Coleta imports relativos para recursão (DFS — dependências primeiro).
    const dir = path.dirname(abs);
    const relDeps: string[] = [];
    let match: RegExpExecArray | null;
    IMPORT_LINE_RE.lastIndex = 0;
    while ((match = IMPORT_LINE_RE.exec(raw)) !== null) {
      const spec = match[1];
      if (spec.startsWith('.')) relDeps.push(path.resolve(dir, spec));
    }
    for (const dep of relDeps) {
      await resolve(dep);
    }

    // 2) Remove TODAS as linhas de import. Relativos somem (conteúdo inlined);
    //    URL/bare vão hoistados e deduplicados para o topo do bundle.
    const body = raw.replace(IMPORT_LINE_RE, (line: string, spec: string) => {
      if (!spec.startsWith('.')) {
        urlImports.add(line.trim().replace(/;?\s*$/, ';'));
      }
      return '';
    });
    inlined.push(`// ===== ${path.relative(functionsRoot, abs)} =====\n${body.trim()}`);
  }

  await resolve(entry);
  const header = [...urlImports].join('\n');
  return `${header}\n\n${inlined.join('\n\n')}\n`;
}
