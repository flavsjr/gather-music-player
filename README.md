# Gather Music Player

Player de música em página única, feito pra virar um objeto interativo no [Gather](https://www.gather.town/). Alguém encosta no objeto, abre o player, ouve.

O áudio vem do **YouTube**. Ninguém baixa arquivo, ninguém faz login, o repositório não guarda mp3. Você só lista os vídeos num JSON.

A interface é toda própria — o YouTube fica escondido:

- vinil girando com a capa do vídeo
- equalizador animado
- barra de progresso
- paleta de cores sorteada a cada faixa (fundo, botões, barra, tudo acompanha)
- controles de play/pause, anterior/próxima, volume e mudo

---

## Por que YouTube e não Spotify

A API do Spotify **não serve** pra esse caso:

| | Spotify Web Playback SDK | YouTube IFrame API |
|---|---|---|
| Visitante precisa logar | sim | **não** |
| Visitante precisa de Premium | sim | **não** |
| Limite de usuários | 25 (Development Mode) | **nenhum** |
| Funciona em iframe do Gather | não (DRM/EME bloqueia) | **sim** |

Token do Spotify é por usuário, não por app — não existe "token do dono" que toque pra todo mundo. Por isso: YouTube.

---

## Como colocar músicas

Tudo mora em **`playlist.json`**, na raiz. Dois modos. Se os dois vierem preenchidos, `list` ganha.

### Modo A — playlist inteira do YouTube

Pega o ID na URL da playlist, o pedaço depois de `list=`:

```
https://www.youtube.com/playlist?list=PLabc123XYZ
                                      ^^^^^^^^^^^^
```

```json
{
  "list": "PLabc123XYZ",
  "shuffle": true
}
```

⚠️ A playlist precisa estar **Pública** ou **Não listada**. Privada não carrega em embed — é o erro mais comum.

Nesse modo o player usa o shuffle nativo do YouTube e avança sozinho até o fim, depois volta pro começo.

### Modo B — faixas na mão

Pega o ID de cada vídeo, o pedaço depois de `v=`:

```
https://www.youtube.com/watch?v=Cf3GeYytJvI&pp=ygUTeXVuayB2aW5v
                                ^^^^^^^^^^^
```

Ignore o `&pp=...` e qualquer outro parâmetro. Só o `v=` importa.

```json
{
  "list": "",
  "shuffle": true,
  "videos": [
    { "id": "Cf3GeYytJvI" },
    { "id": "47KfZNEMYqY" }
  ]
}
```

### Corrigir título e artista

Sem `title`/`artist`, o player usa o título do próprio vídeo e limpa o lixo (`(Official Video)`, `[4K]`, `(Clipe Oficial)`…). Crédito de produção — `(prod. fulano)` — fica.

Título de YouTube costuma vir como `Artista - Música`, e o parser assume essa ordem. Quando o vídeo foge do padrão, sobrescreve na mão:

```json
{ "id": "Cf3GeYytJvI", "title": "Vida Nova", "artist": "Yunk Vino" }
```

Pode preencher só um dos dois — o que faltar sai do vídeo.

### Opções

| Campo | O que faz |
|---|---|
| `list` | ID da playlist do YouTube. Vazio = modo B. |
| `shuffle` | `true` embaralha; `false` mantém a ordem. Vale nos dois modos. |
| `videos` | Lista do modo B: `{ id, title?, artist? }`. |

---

## Rodar local

**Não funciona abrindo o `index.html` com duplo clique.** Vira `file://`, e `file://` bloqueia o `fetch` do `playlist.json`.

Sobe um servidor na pasta do projeto:

```bash
python -m http.server 8000
```

Abre `http://localhost:8000`.

---

## Publicar no GitHub Pages

Settings → Pages → Source: `Deploy from a branch` → escolhe a branch e a pasta `/ (root)`.

Sai em `https://<usuario>.github.io/<repositorio>/`.

Pages é servidor HTTP com HTTPS, então o `fetch` funciona sem nenhuma configuração extra. E Pages não manda header `X-Frame-Options`, ou seja: a página **pode** ser embedada — que é o que o Gather precisa.

---

## Usar no Gather

Objeto → interação **Embedded website** → cola a URL do Pages (`https://`, obrigatório).

Duas escolhas:

- **Embedded website:** abre num painel dentro do Gather. Fechou o painel, a música para.
- **External call / link:** abre em aba nova. A música continua enquanto a pessoa anda pelo mapa.

---

## O som no primeiro clique

Browser nenhum deixa uma página tocar áudio sozinha sem interação do usuário. Não é limitação do código — é política de origem, e não tem override. Clique sintético (`el.click()`) não vale: `isTrusted: false` não conta como gesto.

O que o player faz:

1. Tenta tocar **com som**.
2. Se o browser barrar, toca **mudo** — vinil girando, eq pulando — e mostra o aviso `🔇 clique para ligar o som`.
3. Qualquer clique ou tecla, em qualquer lugar da página, liga o áudio e o aviso some.

Autoplay mudo é sempre liberado, inclusive dentro de iframe. Então nunca fica tela parada.

Dois detalhes:

- **Chrome MEI:** o Chrome mantém um score por origem (sobe quando você ouve áudio ≥7s com a aba visível). Passou do limiar, aquela origem ganha autoplay com som — mas só no seu perfil. `localhost` e o domínio do Pages são origens diferentes: testar local não constrói reputação pro Pages.
- **No Gather pode nem aparecer o aviso.** A pessoa clica no objeto pra abrir, então o documento pai já tem user activation; se o iframe do Gather vier com `allow="autoplay"`, a ativação é delegada e o som entra direto. Isso não dá pra simular em `localhost` — só testando no Gather de verdade.

---

## Estrutura

```
index.html      markup do player
style.css       visual, animações, paleta por variável CSS
script.js       playlist, controles, integração com a IFrame API
playlist.json   o que toca  ← é aqui que você mexe
```

---

## Limites conhecidos

- **Não é escuta sincronizada.** Cada pessoa que abre começa a playlist do zero, no volume dela. São N players independentes, não uma rádio compartilhada.
- **Vídeo com embed bloqueado não toca.** O dono do vídeo pode proibir reprodução fora do YouTube. O player mostra `faixa indisponivel (erro 101)` ou `150` e pula pra próxima. Nesse caso, troca o vídeo.
- **Equalizador é decorativo.** O iframe não entrega o sinal de áudio, então a animação não reage à música de verdade.
- **Mobile:** embed + autoplay são bem mais capengas no app do Gather. Assume desktop.
