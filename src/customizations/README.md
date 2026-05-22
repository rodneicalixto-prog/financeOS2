# Customizations

Este diretório é o local **único e seguro** para customizações de código que você quer fazer na sua instância sem causar conflitos com atualizações do upstream.

## Por que existe

Quando você puxa atualizações do upstream (via `git pull` ou re-importando o template), o Git tenta mesclar as mudanças do projeto principal com seu código local. Se você editar arquivos fora deste diretório, vai conflitar quando puxar atualizações.

**Regra simples:** o upstream nunca edita arquivos dentro de `src/customizations/`. Tudo aqui é seu.

## Como usar

- Crie hooks, componentes, helpers próprios aqui
- Importe-os no resto da aplicação normalmente: `import { meuHook } from "@/customizations/hooks/meuHook"`
- Para sobrescrever lógica existente: crie um wrapper aqui que importa do core e adapta o comportamento

Exemplo de estrutura sugerida:

```
src/customizations/
├── README.md
├── hooks/
│   └── useMinhaIntegracao.ts
├── components/
│   └── MeuWidget.tsx
└── lib/
    └── minhasUtils.ts
```

## Limites

Customizações que exigem editar arquivos de domínio (ex.: alterar lógica de uma Edge Function existente, mudar comportamento de um componente core) **não cabem aqui** — vão precisar de merge manual quando atualizar.

Para essas, recomendado: abra issue ou PR no upstream sugerindo a customização como feature opcional. Se rolar merge, todo mundo ganha; se não, fica só no seu fork e você assume a responsabilidade do merge a cada update.

## Não delete este README

Mantenha este `README.md` versionado. Ele é a única coisa neste diretório que o upstream conhece — serve como marcador de "esta convenção existe e está documentada".
