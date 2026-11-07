'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const { prepararOperacoes } = require('./support/operacoes-investimentos.cjs');
const { investimento, conta, transacao, aporte, resgate, INVESTIMENTO_ID } = require('./support/fixtures.cjs');
const { calcularSaldos, calcularCapitaisAplicados, calcularValoresInvestimentos } = require('../../frontend/js/dominio/calculos.js');
beforeEach(t => t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,5,12)}));
const gravarCadastro = async a => {a.api.abrirModalInvestimento();a.cadastro();await a.enviar('form-investimento');};
const sucesso = a => a.efeitos.filter(([tipo])=>['salvar','manual','movimento','excluir'].includes(tipo));

test('Operações Investimentos: import sem DOM, armazenamento, crypto, timers ou listeners',async () =>{
    const url=pathToFileURL(resolve(__dirname,'../../frontend/js/funcionalidades/operacoes-investimentos.js')).href;
    execFileSync(process.execPath,['--input-type=module','-e',`for(const n of ['document','window','localStorage','crypto'])Object.defineProperty(globalThis,n,{get(){throw Error(n)}});globalThis.setTimeout=globalThis.addEventListener=()=>{throw Error('efeito')};await import(${JSON.stringify(url)});`]);
});
test('Operações Investimentos: inicialização explícita/idempotente, encerramento e reinicialização',async () =>{
    const a=prepararOperacoes();const campos=Object.values(a.elementos).filter(e=>!Array.isArray(e));
    assert.ok(campos.every(e=>e.listeners()===0));a.api.inicializar();a.api.inicializar();
    for(const nome of ['form-investimento','form-valor-investimento','form-movimentacao'])assert.equal(a.elementos[nome].listeners(),1);
    a.api.encerrar();a.api.encerrar();assert.ok(campos.every(e=>e.listeners()===0));assert.ok(a.elementos.botoesMovimentacao.every(e=>e.listeners()===0));
    await a.enviar('form-investimento');assert.equal(a.gravacoes.length,0);a.api.inicializar();await gravarCadastro(a);assert.equal(a.gravacoes.length,1);
});
test('Operações Investimentos: cadastro normaliza texto, aceita zero e confirma uma única gravação',async () =>{
    const a=prepararOperacoes();a.api.inicializar();await gravarCadastro(a);const salvo=a.estado.consultarInvestimentos().at(-1);
    assert.equal(salvo.nome,'Novo');assert.equal(salvo.tipo,'Tipo livre');assert.equal(salvo.capitalInicial,0);assert.equal(salvo.valorInformado,10.25);assert.equal(salvo.observacoes,'');
    assert.equal(salvo.instituicao,'');assert.equal(salvo.atualizadoEm,new Date().toISOString());assert.equal(a.gravacoes.length,1);assert.equal(a.gravacoes[0][0],'investimentos');
    assert.deepEqual(a.efeitos.filter(([tipo])=>['gravar','salvar','fechar','toast'].includes(tipo)).map(([tipo])=>tipo),['gravar','salvar','fechar','toast']);
});
test('Operações Investimentos: edição conserva ID e instante da avaliação inalterada',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalInvestimento(INVESTIMENTO_ID);a.preencher({'nome-investimento':'Renomeado'});await a.enviar('form-investimento');
    const salvo=a.estado.consultarInvestimentos()[0];assert.equal(salvo.id,INVESTIMENTO_ID);assert.equal(salvo.nome,'Renomeado');assert.equal(salvo.atualizadoEm,investimento().atualizadoEm);assert.equal(a.gravacoes.length,1);assert.deepEqual(sucesso(a),[['salvar',INVESTIMENTO_ID,true]]);
});
for(const [campo,valor] of [['nome-investimento',''],['tipo-investimento',''],['capital-investimento','-1'],['valor-investimento','0.006'],['valor-investimento','100000000000000'],['referencia-investimento','2026-11-06'],['referencia-valor-investimento','2026-02-30'],['observacoes-investimento','a'.repeat(501)]])test(`Operações Investimentos: cadastro rejeita ${campo} ${valor.slice(0,20)}`,async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalInvestimento();a.cadastro({[campo]:valor});await a.enviar('form-investimento');assert.equal(a.gravacoes.length,0);assert.ok(a.erros.get('erro-'+campo).textContent);assert.equal(a.elementos[campo].getAttribute('aria-invalid'),'true');assert.strictEqual(a.document.activeElement,a.elementos[campo]);
    await a.elementos[campo].emitir('input');assert.equal(a.erros.get('erro-'+campo).textContent,'');assert.equal(a.elementos[campo].getAttribute('aria-invalid'),undefined);
});
for(const fluxo of ['cadastro','edicao','manual','aporte','resgate','exclusao'])test(`Operações Investimentos: falha em ${fluxo} preserva memória, campos e modal sem sucesso`,async () =>{
    const a=prepararOperacoes();a.api.inicializar();const antesI=a.estado.consultarInvestimentos(),antesT=a.estado.consultarTransacoes();let form;
    if(fluxo==='cadastro'){a.api.abrirModalInvestimento();a.cadastro();form='form-investimento';}
    if(fluxo==='edicao'){a.api.abrirModalInvestimento(INVESTIMENTO_ID);a.preencher({'nome-investimento':'Editado'});form='form-investimento';}
    if(fluxo==='manual'){a.api.abrirAtualizacaoValor(INVESTIMENTO_ID);a.preencher({'valor-manual-investimento':'80'});form='form-valor-investimento';}
    if(['aporte','resgate'].includes(fluxo)){a.api.abrirModalMovimentacao(fluxo);a.movimentacao(fluxo==='resgate'?{'capital-movimentacao':'8'}:{});form='form-movimentacao';}
    if(fluxo==='exclusao')a.api.solicitarExclusaoInvestimento(INVESTIMENTO_ID);
    const campos=Object.values(a.elementos).filter(e=>!Array.isArray(e)).map(e=>[e,e.value]);a.efeitos.length=0;a.falhar();
    if(form)await a.enviar(form);else await a.elementos['confirmar-exclusao-investimento'].emitir('click');
    assert.strictEqual(a.estado.consultarInvestimentos(),antesI);assert.strictEqual(a.estado.consultarTransacoes(),antesT);assert.equal(a.gravacoes.length,0);assert.equal(sucesso(a).length,0);assert.ok(!a.efeitos.some(([tipo])=>tipo==='fechar'||tipo==='toast'));for(const [campo,valor] of campos)assert.equal(campo.value,valor);
});
test('Operações Investimentos: exclusão sem vínculo, cancelamento e nova confirmação',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.solicitarExclusaoInvestimento(INVESTIMENTO_ID);assert.match(a.elementos['mensagem-exclusao-investimento'].textContent,/Investimento de teste/);
    a.api.fecharExclusaoInvestimento();await a.elementos['confirmar-exclusao-investimento'].emitir('click');assert.equal(a.gravacoes.length,0);
    a.api.solicitarExclusaoInvestimento(INVESTIMENTO_ID);await a.elementos['confirmar-exclusao-investimento'].emitir('click');assert.equal(a.estado.consultarInvestimentos().length,0);assert.equal(a.gravacoes.length,1);assert.equal(sucesso(a).length,1);
});
for(const movimento of [aporte({data:'2026-01-01'}),resgate({data:'2026-12-01'})])test(`Operações Investimentos: impede exclusão com ${movimento.tipo} histórico/futuro`,async () =>{
    const a=prepararOperacoes({registros:[movimento]});a.api.inicializar();a.api.solicitarExclusaoInvestimento(INVESTIMENTO_ID);assert.equal(a.gravacoes.length,0);assert.ok(a.efeitos.some(([tipo,msg])=>tipo==='toast'&&msg.includes('vinculados')));
});
test('Operações Investimentos: revalida vínculos ao confirmar exclusão já aberta',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.solicitarExclusaoInvestimento(INVESTIMENTO_ID);assert.equal((await a.estado.confirmarTransacoes([aporte()])).sucesso,true);a.gravacoes.length=0;
    await a.elementos['confirmar-exclusao-investimento'].emitir('click');assert.equal(a.estado.consultarInvestimentos().length,1);assert.equal(a.gravacoes.length,0);
});
test('Operações Investimentos: atualização manual aceita zero sem alterar capital ou contas',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirAtualizacaoValor(INVESTIMENTO_ID);assert.match(a.elementos['avaliacao-anterior-investimento'].textContent,/31\/10\/2026/);
    a.preencher({'valor-manual-investimento':'0','data-valor-manual':'2026-11-05'});await a.enviar('form-valor-investimento');const salvo=a.estado.consultarInvestimentos()[0];assert.equal(salvo.valorInformado,0);assert.equal(salvo.capitalInicial,100);assert.equal(a.gravacoes[0][0],'investimentos');assert.equal(a.gravacoes.length,1);
});
test('Operações Investimentos: confirmação retroativa reseta ao mudar a data manual',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirAtualizacaoValor(INVESTIMENTO_ID);a.preencher({'data-valor-manual':'2026-10-30'});a.elementos['confirmar-retroativo-manual'].checked=true;await a.elementos['data-valor-manual'].emitir('input');assert.equal(a.elementos['confirmar-retroativo-manual'].checked,false);assert.equal(a.elementos['aviso-retroativo-manual'].classList.contains('hidden'),false);
    await a.enviar('form-valor-investimento');assert.equal(a.gravacoes.length,0);assert.match(a.erros.get('erro-data-valor-manual').textContent,/Confirme/);
});
test('Operações Investimentos: aporte único atualiza saldos, capital e posição pelos cálculos reais',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalMovimentacao('aporte',INVESTIMENTO_ID);a.movimentacao();await a.enviar('form-movimentacao');const t=a.estado.consultarTransacoes();assert.equal(t.length,1);assert.equal(t[0].valor,10.25);assert.equal(t[0].tipo,'aporte');assert.equal(t[0].contaId,conta().id);assert.equal(t[0].investimentoId,INVESTIMENTO_ID);assert.equal(a.gravacoes.length,1);assert.equal(a.gravacoes[0][0],'transacoes');
    assert.equal(calcularSaldos(a.estado.consultarContas(),t,undefined,a.estado.consultarInvestimentos()).saldosPorContaCentavos.get(conta().id),8975);assert.equal(calcularCapitaisAplicados(a.estado.consultarInvestimentos(),t).capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID),11025);assert.equal(calcularValoresInvestimentos(a.estado.consultarInvestimentos(),t).valoresPorInvestimento.get(INVESTIMENTO_ID).valorCentavos,13025);
});
for(const baixa of ['', '11.50'])test(`Operações Investimentos: resgate preserva três significados e baixa ${baixa||'opcional'}`,async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalMovimentacao('resgate');a.movimentacao({'capital-movimentacao':'8','baixa-movimentacao':baixa});await a.enviar('form-movimentacao');const salvo=a.estado.consultarTransacoes()[0];assert.equal(salvo.valor,10.25);assert.equal(salvo.capitalRetirado,8);assert.equal(salvo.valorRetiradoInvestimento,baixa?11.5:10.25);assert.equal(a.gravacoes.length,1);
});
test('Operações Investimentos: edição da movimentação mantém ID e não duplica registro',async () =>{
    const a=prepararOperacoes({registros:[aporte()]});a.api.inicializar();a.api.abrirModalMovimentacao('aporte',INVESTIMENTO_ID,aporte().id);a.preencher({'valor-movimentacao':'21.25'});await a.enviar('form-movimentacao');assert.equal(a.estado.consultarTransacoes().length,1);assert.equal(a.estado.consultarTransacoes()[0].id,aporte().id);assert.equal(a.estado.consultarTransacoes()[0].valor,21.25);assert.equal(a.gravacoes.length,1);
});
test('Operações Investimentos: resgate retroativo não compromete capital futuro',async () =>{
    const a=prepararOperacoes({registros:[resgate({data:'2026-11-07',capitalRetirado:80})]});a.api.inicializar();a.api.abrirModalMovimentacao('resgate');a.movimentacao({'capital-movimentacao':'30','data-movimentacao':'2026-11-02'});await a.enviar('form-movimentacao');assert.equal(a.gravacoes.length,0);assert.equal(sucesso(a).length,0);assert.equal(a.estado.consultarTransacoes().length,1);
});
test('Operações Investimentos: resgate futuro válido fica registrado sem afetar posição atual',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalMovimentacao('resgate');a.movimentacao({'capital-movimentacao':'10','data-movimentacao':'2026-11-07'});await a.enviar('form-movimentacao');assert.equal(a.gravacoes.length,1);assert.equal(calcularCapitaisAplicados(a.estado.consultarInvestimentos(),a.estado.consultarTransacoes()).capitaisPorInvestimentoCentavos.get(INVESTIMENTO_ID),10000);
});
test('Operações Investimentos: disponibilidade parcial preserva formulário e bloqueio de confirmação',async () =>{
    const a=prepararOperacoes();a.estado.bloquearColecao('transacoes');a.api.inicializar();await gravarCadastro(a);assert.equal(a.gravacoes.length,0);assert.ok(a.efeitos.some(([tipo])=>tipo==='abrir'));assert.equal(sucesso(a).length,0);a.api.abrirModalMovimentacao('aporte');assert.ok(a.efeitos.some(([tipo,msg])=>tipo==='toast'&&msg==='Dados indisponíveis'));assert.equal(a.api.podeExcluirInvestimento(INVESTIMENTO_ID),false);
});
test('Operações Investimentos: despesas legadas permanecem intactas após aporte',async () =>{
    const legado=transacao({tipo:'despesa',classificacao:'',pagamento:'Pix'}),a=prepararOperacoes({registros:[legado]});a.api.inicializar();a.api.abrirModalMovimentacao('aporte');a.movimentacao();await a.enviar('form-movimentacao');assert.equal(a.gravacoes.length,1);assert.deepEqual(a.estado.consultarTransacoes()[0],legado);
});
test('Operações Investimentos: reabertura usa coleções atuais e limpa campos condicionais',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalMovimentacao('resgate');a.movimentacao({'capital-movimentacao':'8'});await a.elementos['cancelar-movimentacao'].emitir('click');
    (await a.estado.confirmarInvestimentos([investimento({nome:'Nome atualizado'})]));a.api.abrirModalMovimentacao('aporte');assert.equal(a.elementos['investimento-movimentacao'].children[1].textContent,'Nome atualizado');assert.equal(a.elementos['capital-movimentacao'].value,'');assert.equal(a.elementos['capital-movimentacao'].disabled,true);assert.equal(a.elementos['campos-resgate'].classList.contains('hidden'),true);
});
test('Operações Investimentos: referências removidas durante edição não geram nova gravação',async () =>{
    const a=prepararOperacoes();a.api.inicializar();a.api.abrirModalInvestimento(INVESTIMENTO_ID);(await a.estado.confirmarInvestimentos([]));a.gravacoes.length=0;await a.enviar('form-investimento');assert.equal(a.gravacoes.length,0);assert.equal(sucesso(a).length,0);
});

test('Operações Investimentos: coordenador real preserva ordem das atualizações e encaminha uma confirmação',async () =>{
    const {readFileSync}=require('node:fs'),{Script,createContext}=require('node:vm');
    const fonte=readFileSync(resolve(__dirname,'../../frontend/js/script.js'),'utf8');
    const trecho=fonte.slice(fonte.indexOf('const operacoesInvestimentos = criarOperacoesInvestimentos('),fonte.indexOf('operacoesInvestimentos.inicializar();'));
    const efeitos=[];let opcoes;
    const registrar=nome=>(...args)=>{efeitos.push([nome,...args]);return true;};
    const consultas={colecaoEstaBloqueada:()=>false,consultarInvestimentos:()=>[],consultarTransacoes:()=>[],consultarContas:()=>[]};
    new Script(trecho).runInContext(createContext({
        elementosOperacoesInvestimentos:{}, disponibilidadeColecoes:consultas,
        criarOperacoesInvestimentos:recebidas=>{opcoes=recebidas;return{};},persistirColecao:registrar('persistir'),
        validarContaTransacao(){},prepararMovimentacaoInvestimento(){},obterRestricaoMovimentacaoInvestimentos(){},formatarDataInvestimento(){},
        abrirModal(){},fecharModal(){},mostrarToast(){},listaTransacoes:'recentes',
        renderizarInvestimentos:registrar('investimentos'),renderizarTransacoes:registrar('recentes'),atualizarTabelaCompleta:registrar('tabela'),
        prepararRetornoFocoInvestimento:registrar('foco'),limparSelecao:registrar('selecao'),atualizarCategorias:registrar('categorias'),atualizarResumo:registrar('resumo')
    }));
    assert.deepEqual(efeitos,[]);
    const candidatos=[];assert.equal((await opcoes.confirmarInvestimentos(candidatos)),true);assert.strictEqual(efeitos[0][2],candidatos);assert.equal(efeitos[0][1],'investimentos');efeitos.length=0;
    opcoes.aposSalvarInvestimento({id:'id'},true);assert.deepEqual(efeitos,[['investimentos'],['recentes','recentes',5],['tabela'],['foco','id','editar']]);efeitos.length=0;
    opcoes.aposExcluirInvestimento();assert.deepEqual(efeitos,[['investimentos']]);efeitos.length=0;
    opcoes.aposAtualizarValor({id:'id'});assert.deepEqual(efeitos,[['investimentos'],['foco','id','atualizar']]);efeitos.length=0;
    opcoes.aposSalvarMovimentacao();assert.deepEqual(efeitos,[['selecao'],['categorias'],['recentes','recentes',5],['tabela'],['resumo'],['investimentos']]);
});

for (const operacao of ['cadastro', 'exclusao', 'manual', 'aporte', 'resgate']) {
    test(`Investimentos: ${operacao} aguarda confirmação e impede reenvio pendente`, async () => {
        let liberar, chamadas = 0;
        const espera = new Promise(resolve => { liberar = resolve; });
        const a = prepararOperacoes({ confirmar: async (chave, dados, estado) => {
            chamadas++; await espera;
            return (await estado[chave === 'investimentos' ? 'confirmarInvestimentos' : 'confirmarTransacoes'](dados)).sucesso;
        }});
        a.api.inicializar();
        let alvo, tipo = 'submit';
        if (operacao === 'cadastro') { a.api.abrirModalInvestimento(); a.cadastro(); alvo = a.elementos['form-investimento']; }
        if (operacao === 'exclusao') { a.api.solicitarExclusaoInvestimento(INVESTIMENTO_ID); alvo = a.elementos['confirmar-exclusao-investimento']; tipo = 'click'; }
        if (operacao === 'manual') {
            a.api.abrirAtualizacaoValor(INVESTIMENTO_ID);
            a.preencher({'valor-manual-investimento':'150','data-valor-manual':'2026-11-04'});
            alvo = a.elementos['form-valor-investimento'];
        }
        if (['aporte','resgate'].includes(operacao)) {
            a.api.abrirModalMovimentacao(operacao); a.movimentacao({'capital-movimentacao':'5'}); alvo = a.elementos['form-movimentacao'];
        }
        a.efeitos.length = 0;
        const antes = a.estado.consultarInvestimentos(), transacoesAntes = a.estado.consultarTransacoes();
        const primeira = alvo.emitir(tipo);
        await alvo.emitir(tipo);
        assert.equal(chamadas, 1);
        assert.strictEqual(a.estado.consultarInvestimentos(), antes);
        assert.strictEqual(a.estado.consultarTransacoes(), transacoesAntes);
        assert.equal(a.gravacoes.length, 0);
        assert.equal(sucesso(a).length, 0);
        assert.equal(a.efeitos.some(([tipo]) => tipo === 'fechar'), false);
        liberar(); await primeira;
        assert.equal(a.gravacoes.length, 1);
        assert.equal(sucesso(a).length, 1);
    });
}

test('Investimentos: rejeição preserva campos e libera nova tentativa sem sucesso antecipado', async () => {
    let rejeitar, chamadas = 0;
    const espera = new Promise((resolve, reject) => { rejeitar = reject; });
    const a = prepararOperacoes({ confirmar: async (chave, dados, estado) => {
        if (++chamadas === 1) return espera;
        return (await estado.confirmarInvestimentos(dados)).sucesso;
    }});
    a.api.inicializar(); a.api.abrirModalInvestimento(); a.cadastro(); a.efeitos.length = 0;
    const primeira = a.enviar('form-investimento');
    await a.elementos['cancelar-investimento'].emitir('click');
    assert.equal(a.efeitos.some(([tipo]) => tipo === 'fechar'), false);
    rejeitar(new Error('Rejeição controlada')); await primeira;
    assert.equal(a.elementos['salvar-investimento'].disabled, undefined);
    assert.equal(a.elementos['nome-investimento'].value, ' Novo ');
    assert.equal(a.gravacoes.length, 0);
    assert.equal(sucesso(a).length, 0);
    assert.match(a.efeitos.at(-1)[1], /erro inesperado/);
    await a.enviar('form-investimento');
    assert.equal(a.gravacoes.length, 1);
    assert.equal(sucesso(a).length, 1);
});
