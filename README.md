# Nexo

Organizador financeiro pessoal desenvolvido como projeto de estudo e para uso prático. A primeira fase implementa um frontend em HTML, CSS e JavaScript puro, com persistência local no navegador.

## Funcionalidades implementadas

- **Resumo:** saldo disponível, receitas/despesas registradas, cinco transações recentes, até três contas e histórico compacto.
- **Transações:** receitas, despesas, aportes e resgates; cadastro, edição, exclusão, busca, filtros combináveis, seleção e paginação (seis registros até 850 px; oito acima).
- **Contas:** contas e reservas, saldo inicial com data de referência, saldo atual calculado e exclusão protegida por vínculos.
- **Análises:** histórico mensal de 3, 6 ou 12 meses e distribuição de despesas por classificação, com períodos independentes.
- **Investimentos:** cadastro, atualização manual, capital aplicado, valor estimado e histórico único de aportes/resgates.
- Interface responsiva, navegação inferior mobile, validação por campo, modais com controle de foco, notificações e motion com movimento reduzido.

Cartões de crédito, transferências, cotações, juros e rentabilidade automáticos não estão implementados.

## Tecnologias e estrutura

Sem framework, bundler ou dependências de testes externas. Chart.js **4.5.1** é carregado por CDN; o JavaScript utiliza ES Modules nativos.

```text
frontend/
  index.html                     # Documento único da SPA
  assets/                        # Recursos visuais
  css/
    style.css                    # Imports na ordem da cascata
    base.css
    componentes.css
    interface.css
    interface-complementar.css
  js/
    script.js                    # Bootstrap, navegação e coordenação
    dominio/                     # Valores, datas, validações e cálculos
    dados/                       # Estado financeiro e repositório local
    ui/                          # Formulários, modais e notificações
    funcionalidades/             # Apresentação, operações, listagens e gráficos
tests/frontend/
  *.test.cjs                     # Suíte nativa do Node.js
  support/                       # Fixtures e ambientes isolados
```

O estado financeiro pertence a `dados/estado.js`; o repositório concentra o armazenamento. Confirmações são assíncronas e os consumidores aguardam o resultado antes de apresentar sucesso. A gravação interna continua síncrona. O domínio não acessa DOM ou armazenamento.

A ordem dos quatro imports CSS é intencional. Media queries e motion permanecem junto dos blocos existentes; reordená-los exige verificar novamente a cascata.

## Execução local por HTTP

Não abra o HTML por `file://`. Na raiz do repositório, com **Node.js 24**, este servidor local funciona sem instalar pacotes (PowerShell):

```powershell
@'
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const raiz = path.resolve('frontend');
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const nome = path.resolve(raiz, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!nome.startsWith(raiz + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(nome, (erro, dados) => {
        if (erro) { res.writeHead(404); return res.end(); }
        const tipos = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
        res.setHeader('Content-Type', tipos[path.extname(nome)] || 'text/html');
        res.end(dados);
    });
}).listen(8080, '127.0.0.1');
'@ | node
```

Abra **http://127.0.0.1:8080/** e encerre com `Ctrl+C`. O exemplo serve somente para desenvolvimento local. Também é possível utilizar um servidor HTTP já disponível no editor. O CDN deve estar acessível para renderizar os gráficos; há mensagens de indisponibilidade e alternativas textuais quando a biblioteca falha.

## Testes

Validados com Node.js **24.16.0**, `node:test` e `node:assert/strict`, sem dependências externas:

```powershell
node --test --unhandled-rejections=strict tests/frontend/*.test.cjs
git diff --check
```

Nos três fusos (PowerShell):

```powershell
$tzAnterior = $env:TZ
try {
    foreach ($fuso in 'America/Sao_Paulo', 'UTC', 'Pacific/Kiritimati') {
        $env:TZ = $fuso
        node --test --unhandled-rejections=strict tests/frontend/*.test.cjs
        if ($LASTEXITCODE -ne 0) { throw "Falha no fuso $fuso" }
    }
} finally { $env:TZ = $tzAnterior }
```

Referência da auditoria final: **443 testes aprovados em cada fuso**. A suíte cobre centavos e limites, datas, validações, cálculos, estado, vínculos, compatibilidade legada, persistência simulada, controladores, falhas, Promises controladas e motion. Parte dos testes de coordenação usa `node:vm` e recortes reais de `script.js`; doubles de DOM não substituem verificações em navegador e leitor de tela.

## Persistência e regras importantes

- Dados ficam nas chaves `contas`, `transacoes` e `investimentos` do localStorage. Não há sincronização remota ou backup/exportação implementado.
- Protocolo, host e porta diferentes utilizam origens distintas. Limpar os dados do site ou usar outro perfil/origem pode resultar em dados diferentes ou ausentes.
- Dados inválidos são preservados e podem bloquear coleções; não há migração ou limpeza automática.
- Valores são validados e calculados em centavos inteiros seguros. Falhas de gravação preservam a memória anterior e os campos preenchidos.
- Saldos usam movimentos posteriores à referência e até hoje. Totais de receitas/despesas do Resumo incluem datas futuras; gráficos as excluem.
- Aportes/resgates são registros únicos em Transações e ficam fora dos totais e gráficos de receitas/despesas.
- Valores iniciais de investimentos não movimentam contas. O valor estimado deriva do valor manual e dos movimentos elegíveis, sem cotação automática.

Consulte [AGENTS.md](AGENTS.md) para regras detalhadas e orientações de manutenção.

## Limitações conhecidas e roadmap

- **Concorrência entre abas:** sem comparação de versões, Web Locks ou listener de storage. Duas abas podem sobrescrever alterações e invalidar vínculos. Use uma única aba para editar. As confirmações assíncronas não resolvem esse risco.
- **Virada do dia:** sem recálculo agendado à meia-noite em uma aba continuamente visível; recarregar ou retornar à aplicação recalcula com a data local.
- **Acessibilidade localizada (P2):** após renomear um investimento, a linha e a busca resolvem o nome atual, mas o checkbox da movimentação ainda usa somente o nome armazenado. Uma correção futura deve preservar registros e vínculos.
- **Limites de validação:** auditoria amostral em um navegador desktop com viewports mobile; não representa certificação WCAG, teste com leitor de tela ou cobertura de todos os navegadores/dispositivos.

Evoluções futuras, sem implementação nesta fase: detecção e resolução de conflitos entre abas, backup/exportação, backend Java/Spring Boot com API REST e banco SQL, autenticação se necessária e ampliação dos testes reais de navegador/acessibilidade. Java, Spring Boot e banco de dados são planos, não componentes implementados.
