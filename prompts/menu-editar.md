Agora vamos recriar a função mais importante do app. A função de Criação/ Edição das Cifras. Você vai apagar o menu atual e recriar um novo com novos recursos e funções.

O menu será dividido em Etapas (Steps)

Tela da primeira etapa abaixo (a primeira etapa também é dividida em 2 subetapas):

Subetapa 1

Título lateral com o seguinte-> 1  Criar Cifra

imput com label "Musica" e campo para digitar o nome da música -> Música 

imput com label "Artista" e campo para digitar o nome da Artista -> O sistema faz uma busca no banco de dados pelos artistas já registrados no sistema e eu posso selecionar um artista já registrado.

Subetapa 2

Tom da música: Nessa sessão você pode reaproveitar o componente já criado da página de cifras para alterar o tom. Ele vai puxar todos os tons necessários, só cuidado com a lógica de tons maiores e menores.


Adicionar Capotraste (Sim ou não). Se sim -> Você coloca um botãozinho que vai descendo no "-" e subindo no "+" começando de zero até doze. O "0" significa que o capotraste não está sendo usado.

Adicionar Timbres e Estilos de Acompanhamento:

sim ou não? se sim:
timbres: 
Input de Texto para que eu coloque o nome dos estilos
style: 
Input de Texto para que eu coloque o nome dos ritmos

Campo de anotações: imput para adicionar informações extras.


Tela da Segunda etapa abaixo: (será dividido em 2 subetapas):

Subetapa 1: Letras e sessões

Aqui você tem 2 opções: 1 adicionar um só campo de texto aonde eu vou incluir toda a letra da música já dividida entre sessões, usando paramentros chaves como "[Intro], [Parte 1], [Refrão], [Parte 2]..." e você cortará em pedaços essa letra. Ou você adiciona um campo de incluir e nesse campo um imput com:

- nome da sessão
- letra da sessão

ai eu vou adicionando mais sessões conforme a música e adicionando a letra da sessão. 

Na subetapa 1 o teclado do dispositivo que está usando a aplicação é fundamental.

Subetapa 2: Cifras nas sessões.

nessa subetapa você me entrega a sessão dividida (me entrega uma sessão de cada vez, dividida por linhas separadas e eu vou incluindo manualmente nessas linhas a cifra). Nela você vai criar uma função de acordes, um modal ou sessão div em que eu vou clicando e adicionando acordes acima de cada linha. Exatamente aonde estiver o meu cursor será aonde ficará o acorde na sessão. 

na verdade vamos incluir a função de alternar entre teclado modal de acordes e o teclado do sistema. Isso tem que ficar bem responsivo. O teclado modal de acordes começa mostrando ao usuário os acordes de acordo com o tom que o usuário está. Ao clicar em um acorde ele sugere abaixo variações do mesmo. Quero que pense em fazer algo exatamente assim:

Titulo-> Cifras
Tom: G
Sessão 1 - [Parte 1]

G  D                   Em     
Tu,   te abeiraste da praia
            Am
Não buscaste

G  D                   Em     
Tu,   te abeiraste da praia
            Am
Não buscaste

Teclado abaixo do conteúdo:

[G] [Am] [Bm]
[C] [D] [Em]
    [F#°]

dar dois clics ou apertar e segurar (não sei) no acorde abre mais opções pra ele, que podem incluir empréstimos modais, acordes suspensos, tétrades ou tensões. Suponha que apertei e segurei em "Bm", pode aparecer:

Bm7 Bm9 Bm7(9) Bm7(4/9)
B B4 B7 B9 B7(4/9) B7(9)
B° Bb

é só alguns exemplos, você pode pesquisar na internet para entender melhor.


Posso usar também o teclado nativo do sistema se eu quiser alternar pra ele.

Basicamente é isso, só incluir um botão de salvar.

mesmo fluxo deve ser tanto pra adição quanto pra edição da cifra.
