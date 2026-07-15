// ── FONTE GLOBAL: POPPINS ───────────────────────────────────────────────────
// Aplica Poppins em TODO <Text> do app, sem precisar editar cada tela.
//
// Por que assim e não patch em Text.render?
//   No RN 0.81 / React 19 o componente Text é uma função simples (TextImpl),
//   não um forwardRef — ou seja, NÃO tem `.render` para sobrescrever. O patch
//   antigo saía silenciosamente e a fonte nunca era aplicada (caía no Arial).
//
// Solução: interceptar o JSX runtime (jsx / jsxs / jsxDEV). Toda tag JSX passa
// por essas funções, então conseguimos injetar a fontFamily certa em qualquer
// <Text> — em nativo e na web — escolhendo a variante pelo fontWeight.
//
// IMPORTANTE: cada variante da Poppins já carrega o peso (ex.: Poppins_700Bold),
// então ZERAMOS o fontWeight. No Android, manter fontFamily + fontWeight juntos
// faz o sistema não achar a fonte e cair no fallback.
import { StyleSheet, Text as RNText } from 'react-native';

function weightToPoppins(weight: string | number | undefined): string {
  const w = String(weight ?? '400');
  if (w === '100' || w === '200' || w === '300') return 'Poppins_300Light';
  if (w === '500') return 'Poppins_500Medium';
  if (w === '600') return 'Poppins_600SemiBold';
  if (w === '700' || w === 'bold') return 'Poppins_700Bold';
  if (w === '800' || w === '900') return 'Poppins_800ExtraBold';
  return 'Poppins_400Regular';
}

function applyFont(props: any): any {
  if (!props) return props;
  const flat = StyleSheet.flatten(props.style) || {};
  if (flat.fontFamily) return props; // respeita fontFamily explícito
  const family = weightToPoppins(flat.fontWeight);
  return {
    ...props,
    style: [props.style, { fontFamily: family, fontWeight: undefined }],
  };
}

function wrap(orig: Function): Function {
  return function patched(type: any, props: any, ...rest: any[]) {
    if (type === RNText) {
      return (orig as any)(type, applyFont(props), ...rest);
    }
    return (orig as any)(type, props, ...rest);
  };
}

function patchRuntime(mod: any, keys: string[]) {
  if (!mod) return;
  for (const k of keys) {
    if (typeof mod[k] === 'function' && !mod[k].__poppinsPatched) {
      const patched = wrap(mod[k]);
      (patched as any).__poppinsPatched = true;
      mod[k] = patched;
    }
  }
}

// Metro só aceita require() com string literal, então requeremos cada runtime
// diretamente. Produção e dev usam runtimes diferentes; cobrimos os dois.
// eslint-disable-next-line @typescript-eslint/no-var-requires
try { patchRuntime(require('react/jsx-runtime'), ['jsx', 'jsxs']); } catch {}
// eslint-disable-next-line @typescript-eslint/no-var-requires
try { patchRuntime(require('react/jsx-dev-runtime'), ['jsxDEV']); } catch {}
