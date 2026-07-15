# 📱 App de Cifras para Missa — Especificação Completa

## Contexto
App React Native (Expo) para tecladista autodidata que precisa cifrar músicas de missa católica de forma rápida, sem digitar nada, podendo estar deitado na cama ou em qualquer lugar sem o teclado físico.

**Problema central que o app resolve:**
- Músicas chegam via WhatsApp dias antes da missa
- Tecladista precisa cifrar ouvindo pelo YouTube
- Hoje gasta 3h+ por semana formatando texto manualmente
- Fica hiperfocado repetindo músicas tentando melhorar ao invés de só cifrar
- Não consegue confirmar acordes sem o teclado físico do lado

**Princípio de design: LOW TYPING.** O usuário não deve digitar nada. Tudo por clique, toque ou seleção.

---

## Stack
- React Native + Expo
- expo-av para samples de piano
- AsyncStorage para persistência local
- react-native-youtube-iframe para player embutido

---

## Fluxo Completo

### PASSO 1 — Criar nova missa

Usuário aperta "Nova Missa" → abre um campo de texto grande → cola a mensagem inteira do WhatsApp → aperta confirmar.

**Exemplo de mensagem colada:**
```
MISSA - CORPUS CHRISTI

ENTRADA: https://youtu.be/EFhnMsTUK60
ATO PENITENCIAL: https://youtu.be/ItfRKnIfxoc
HINO DE LOUVOR: https://youtu.be/PRAaMS0qs2c
SEQUÊNCIA: https://youtu.be/j31J-PvgW-A
ACLAMAÇÃO: (Melodia do "alguém do povo exclamar")
OFERTAS: https://youtu.be/c74ipqfhPXk
SANTO: https://youtu.be/qM60p0pqJBY
CORDEIRO DE DEUS: https://youtu.be/janev45m3K4
COMUNHÃO: https://youtu.be/YYztxONpGvI
EXPOSIÇÃO DO SANTÍSSIMO: https://youtu.be/opJz6z3ayeQ
```

**O parser deve:**
- Extrair o nome da missa (primeira linha em maiúsculas)
- Extrair cada parte e seu link do YouTube
- Criar os blocos automaticamente na ordem que aparecem
- Se não houver link (ex: "Melodia do..."), criar o bloco sem link, com campo de observação
- Criar bloco "Salmo" vazio e marcado como ⚠️ pendente (sempre vem depois)

---

### PASSO 2 — Tela principal da missa

Lista vertical com todos os blocos na ordem:
```
MISSA - CORPUS CHRISTI
📅 [data se informada]

🎵 Entrada          ✅ cifrada
🎵 Ato Penitencial  ⏳ pendente
🎵 Hino de Louvor   ⏳ pendente
🎵 Salmo            ⚠️ sem link
🎵 Aclamação        📝 sem link
...
```

Usuário aperta num bloco → entra na tela de cifragem.

**Adicionar Salmo depois:** botão "Adicionar link" no bloco do Salmo. Usuário cola o link do YouTube. Pronto.

---

### PASSO 3 — Tela de cifragem (coração do app)

Layout dividido em duas metades:

**Metade superior — Player YouTube**
```
[Player YouTube embutido — ocupa ~40% da tela]
⏮  ⏪  ▶/⏸  ⏩  🔊
```
Controles simples de play/pause, voltar 5s, avançar 5s.

**Metade inferior — Editor de partes + teclado de acordes**

Área de partes (scrollável):
```
[Introdução]
Am  G  C  F

[Parte 1]
Am  G  C  F  |  Am  G  F

[Refrão]
F  G  Am  |  F  G  C

[+ Nova parte]  ← botão
```

Ao apertar "+ Nova parte" → aparece um menu de opções por clique (sem digitar):
```
Introdução
Parte 1 / Parte 2 / Parte 3
Refrão
Pré-refrão
Ponte
Final
Instrumental
```

**Para adicionar acordes numa parte:**
- Usuário aperta na parte onde quer adicionar
- O teclado de acordes aparece na parte de baixo
- Cada acorde clicado toca o som de piano + adiciona na linha
- Para nova linha dentro da parte → botão "|" separador ou quebra de linha

**Para deletar um acorde:**
- Segurar o acorde → aparece opção de deletar

---

### PASSO 4 — Teclado de acordes (navegável por campo harmônico)

**Lógica central:**
- O teclado mostra o campo harmônico do tom da música
- São 12 campos (um por nota), navegáveis por setas
- Usuário navega entre campos para achar acordes fora do tom principal

**Exemplo — música em D maior:**
```
← [C#/Db] [D] [D#/Eb] →

Campo de D maior:
D   Em  F#m
G   A   Bm  C#°
```

Seta pra direita → vai pro campo de D#/Eb:
```
← [D] [D#/Eb] [E] →

Campo de D# maior:
D#  Fm  Gm
G#  A#  Cm  D°
```

Assim, se a música tá em D mas tem um Gm, o usuário navega até o campo de D# (onde Gm aparece como 3º grau menor) e clica em Gm.

**Ao clicar em qualquer acorde:**
- Toca o sample de piano formando o acorde completo 🎹
- Adiciona o acorde na parte selecionada
- O campo harmônico permanece onde está (não reseta)

**Definir tom da música:**
- Ao entrar na tela de cifragem → pergunta o tom (teclado de 12 notas simples)
- O campo exibido por padrão é o tom escolhido
- Pode mudar o tom depois a qualquer momento

---

### PASSO 5 — Transpor no ensaio

Dentro da música cifrada → botão "Transpor" no canto superior.
Abre um seletor:
```
[- 6] [- 5] [- 4] [- 3] [- 2] [- 1] [original] [+ 1] [+ 2] [+ 3] [+ 4] [+ 5] [+ 6]
```
Usuário aperta o número de semitons → todos os acordes da música mudam automaticamente.

---

### PASSO 6 — Dia da missa (modo leitura)

Usuário abre a missa → aperta "Modo Missa" → entra em tela limpa:

```
ENTRADA
[D maior]

Introdução:
D   G   A   D

Parte 1:
D   Em  G   A

Refrão:
G   A   Bm  D
G   A   D
```

Fonte grande. Fundo escuro. Sem botões desnecessários. Desliza pra direita pra próxima música. Desliza pra esquerda pra voltar.

---

## Samples de Piano

Usar biblioteca de samples de piano open source (ex: Tone.js samples ou similar disponível pro Expo).

Cada acorde toca as notas simultâneas correspondentes (tríade ou tétrade básica).
Volume controlável. Som limpo de piano acústico.

---

## Persistência

Tudo salvo localmente com AsyncStorage.
Sem necessidade de login ou backend.
Missas ficam salvas por nome/data e podem ser acessadas depois.

---

## O que NÃO fazer

- ❌ Campos de texto livre pra digitar acordes
- ❌ Teclado do celular abrindo em qualquer momento
- ❌ Menus com muitas opções ao mesmo tempo
- ❌ Qualquer etapa que exija formatação manual
- ❌ Síntese de áudio complexa — usar samples pré-gravados

---

## Resumo das telas

1. **Home** — lista de missas salvas + botão "Nova Missa"
2. **Nova Missa** — campo para colar mensagem do WhatsApp
3. **Missa** — lista de blocos com status
4. **Cifragem** — player YouTube + editor de partes + teclado de acordes
5. **Modo Missa** — leitura limpa para o dia do evento
