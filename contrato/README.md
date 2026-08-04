# Contrato de regras

`casos_de_regra.json` é a fonte única dos casos que verificam as regras que
existem **nos dois lados** — no Zod e nos services da API, e em Dart no
aplicativo.

A duplicação da regra é decisão, não defeito: a validação precisa acontecer no
aparelho, offline, no momento em que o produtor digita. Se ela só existisse na
API, o cadastro seria aceito na tela, viraria item de fila e só tomaria erro
horas depois, longe de quem poderia corrigir.

O que a torna segura é este arquivo. Os mesmos casos alimentam as duas
implementações e exigem o mesmo veredito. Divergiu, um dos dois runners quebra.

- API: `test/casosDeRegra.test.js`
- Aplicativo: definido na spec de sincronização do lado cliente

Ao mudar uma regra, mude o caso aqui primeiro. Os dois lados devem passar antes
do merge.
