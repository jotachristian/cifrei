Agora só tem um outro problema, você foi mexer no que não pedi, isso é nas cifras. agora elas não estão no lugar certo. umas cifras estão em um canto e as letras em outro canto. Vamos corrigir essa bagunça que você fez.

ao salvar ou editar cifras elas sempre seguem uma hierarquia. O que pode mudar é apenas o nome das partes da música.

como por exemplo:

[intro]

[parte 1]

[refrão]

[Parte 2]

dentro desses trechos as cifras sempre serão colocadas acima das linhas.


o que o programa deve fazer é fatiar as linhas. ele não precisa mostrar isso pro usuário na edição/adição. eu simplesmente mandaria o texto já com o nome das partes. tipo por exemplo:

exemplo:

[refrão]

Tão natural quanto a luz do dia
Mas que preguiça boa, me deixa aqui à toa
Hoje ninguém vai estragar meu dia
Só vou gastar energia pra beijar sua boca

[estrofe]

Fica comigo então, não me abandona, não
Alguém te perguntou como é que foi seu dia?
Uma palavra amiga, uma notícia boa
Isso faz falta no dia a dia
A gente nunca sabe quem são essas pessoas

eu mandaria assim com esses parametros de chaves "[]" dividindo as partes. o sistema automaticamente fatia isso em linhas.

em outro trecho eu preencho as cifras:

[refrão]
G C
Am D7 G
Em Am7
D7


[estrofe]
G C
Am D7 G
Em Am7
D7
Em Am7


o sistema junta tudo assim:

[refrão]
G C
Tão natural quanto a luz do dia
Am D7 G
Mas que preguiça boa, me deixa aqui à toa
Em Am7
Hoje ninguém vai estragar meu dia
D7 [...]

só que ai teriamos 2 problemas ainda:

1 - as cifras não vão estar exatamente em cima de onde eu quero (exatamente em cima das sílabas que são tocadas)

2 - As vezes colocamos acordes de passagem em momentos que a música não tem a letra, isso pode ou não ser confuso.

pq essa separação de acordes e letras?? editar letras com acorde é bem ruim pq exige mt digitação para cifrar pelo celular. Por isso a ideia é usar um "Teclado de Acordes" que é um mecanismo que eu aperto no acorde e ele escreve na tela. Mas advinha só: VOCÊ APAGOU O QUE TINHA.  

Agora vamos ver qual saida tomar e como vc implementa essas funções novas.