# Design Tokens — Contraste WCAG 2.1 AA

> Gerado automaticamente por `scripts/audit-contrast.mjs` a partir de
> `src/index.css`. Não edite manualmente — re-rode `npm run audit:contrast`
> após alterar tokens HSL.

Critérios:

- **Texto normal (kind=text):** AA exige ≥ **4.5:1** (WCAG 1.4.3).
- **Texto grande / componentes UI (kind=largeText|ui):** AA exige ≥ **3.0:1** (WCAG 1.4.11).
- Tokens marcados como `required` precisam passar — falha bloqueia o CI.

## Tema claro (`:root`)

| Par | Tipo | Ratio | Limiar AA | Status |
|---|---|---:|---:|:---:|
| `foreground × background` | text | 16.96 | 4.5 | PASS |
| `foreground × surface` | text | 17.57 | 4.5 | PASS |
| `card-foreground × card` | text | 17.57 | 4.5 | PASS |
| `popover-foreground × popover` | text | 17.57 | 4.5 | PASS |
| `muted-foreground × background` | text | 6.39 | 4.5 | PASS |
| `muted-foreground × muted` | text | 5.96 | 4.5 | PASS |
| `primary-foreground × primary` | text | 8.85 | 4.5 | PASS |
| `secondary-foreground × secondary` | text | 14.14 | 4.5 | PASS |
| `accent-foreground × accent` | text | 9.27 | 4.5 | PASS |
| `success-foreground × success` | text | 4.52 | 4.5 | PASS |
| `info-foreground × info` | text | 6.35 | 4.5 | PASS |
| `warning-foreground × warning` | text | 4.65 | 4.5 | PASS |
| `destructive-foreground × destructive` | text | 5.22 | 4.5 | PASS |
| `border × background` | ui | 1.29 | 3.0 | FAIL |
| `ring × background` | ui | 5.40 | 3.0 | PASS |
| `sidebar-foreground × sidebar-background` | text | 10.95 | 4.5 | PASS |
| `sidebar-primary-foreground × sidebar-primary` | text | 8.85 | 4.5 | PASS |
| `sidebar-accent-foreground × sidebar-accent` | text | 10.22 | 4.5 | PASS |


## Tema escuro (`.dark`)

Tokens não redefinidos em `.dark` herdam de `:root`.

| Par | Tipo | Ratio | Limiar AA | Status |
|---|---|---:|---:|:---:|
| `foreground × background` | text | 16.14 | 4.5 | PASS |
| `foreground × surface` | text | 1.10 | 4.5 | FAIL |
| `card-foreground × card` | text | 14.47 | 4.5 | PASS |
| `popover-foreground × popover` | text | 14.47 | 4.5 | PASS |
| `muted-foreground × background` | text | 5.05 | 4.5 | PASS |
| `muted-foreground × muted` | text | 3.72 | 4.5 | FAIL |
| `primary-foreground × primary` | text | 5.97 | 4.5 | PASS |
| `secondary-foreground × secondary` | text | 11.87 | 4.5 | PASS |
| `accent-foreground × accent` | text | 5.66 | 4.5 | PASS |
| `success-foreground × success` | text | 5.71 | 4.5 | PASS |
| `info-foreground × info` | text | 5.31 | 4.5 | PASS |
| `warning-foreground × warning` | text | 7.83 | 4.5 | PASS |
| `destructive-foreground × destructive` | text | 6.03 | 4.5 | PASS |
| `border × background` | ui | 1.36 | 3.0 | FAIL |
| `ring × background` | ui | 6.13 | 3.0 | PASS |
| `sidebar-foreground × sidebar-background` | text | 15.34 | 4.5 | PASS |
| `sidebar-primary-foreground × sidebar-primary` | text | 5.97 | 4.5 | PASS |
| `sidebar-accent-foreground × sidebar-accent` | text | 12.75 | 4.5 | PASS |


## Como ler

- **PASS / FAIL** considera o limiar do tipo do par.
- Pares com `FAIL` em `required` precisam ser ajustados antes do merge.
  Estratégia recomendada: alterar o **foreground** (ex.: `muted-foreground`)
  para preservar a paleta primária BWild.
- Pares com `FAIL` em não-required servem como aviso — corrigir quando
  possível, mas não bloqueiam o build.
