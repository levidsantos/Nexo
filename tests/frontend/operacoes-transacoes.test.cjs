'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { Script, createContext } = require('node:vm');
const { criarOperacoesTransacoes } = require('../../frontend/js/funcionalidades/operacoes-transacoes.js');
const { ehMovimentacaoInvestimento } = require('../../frontend/js/dominio/validacoes.js');
const { criarEstadoDisponibilidade } = require('../../frontend/js/dados/estado.js');
const { conta, transacao, investimento, aporte, resgate } = require('./support/fixtures.cjs');

beforeEach((t) => t.mock.timers.enable({ apis: ['Date'], now: new Date(2026,10,5,12) }));

function ambiente({ registros=[], contas=[conta()], investimentos=[investimento()], confirmar }={}) {
    const mensagens=new Map(), efeitos=[], gravacoes=[];
    let selecao=[], falhar=false, id=0;
    const document={getElementById:(id)=>mensagens.get(id),createElement:(tag)=>elemento(tag)};
    function elemento(tag='div',id='') {
        const classes=new Set(),atributos=new Map(),eventos=new Map();
        return {tag,id,ownerDocument:document,value:'',textContent:'',children:[],validity:{valid:true},
            classList:{add:(c)=>classes.add(c),remove:(c)=>classes.delete(c),contains:(c)=>classes.has(c)},
            setAttribute:(n,v)=>atributos.set(n,v),removeAttribute:(n)=>atributos.delete(n),getAttribute:(n)=>atributos.get(n),
            set innerHTML(v){this.children=[];},appendChild(el){this.children.push(el);},
            addEventListener(tipo,cb){if(!eventos.has(tipo))eventos.set(tipo,new Set());eventos.get(tipo).add(cb);},
            removeEventListener(tipo,cb){eventos.get(tipo)?.delete(cb);},
            emitir(tipo,target=this){return Promise.all([...eventos.get(tipo)??[]].map(cb=>cb({target,preventDefault(){}})));},
            listeners(){return [...eventos.values()].reduce((n,itens)=>n+itens.size,0);},
            focus(){efeitos.push(['foco',id]);}
        };
    }
    const elementos=Object.fromEntries(['addReceita','addDespesa','modalOverlay','modalTitle','campoClassificacao','campoPagamento',
        'formTransacao','campoNome','campoValor','campoCategoria','selectClassificacao','selectPagamento','campoConta','campoData',
        'botaoSalvarTransacao','modalExclusao','mensagemExclusao','botaoCancelarExclusao','botaoConfirmarExclusao'].map(n=>[n,elemento('div',n)]));
    const nomes={nome:'campoNome',valor:'campoValor',categoria:'campoCategoria',classificacao:'selectClassificacao',pagamento:'selectPagamento',conta:'campoConta',data:'campoData'};
    const campos=Object.values(nomes).map(n=>elementos[n]);
    campos.forEach(c=>mensagens.set(`erro-${c.id}`,elemento()));
    elementos.formTransacao.elements={namedItem:(nome)=>elementos[nomes[nome]]};
    elementos.formTransacao.reset=()=>campos.forEach(c=>{c.value='';});
    elementos.formTransacao.querySelectorAll=(seletor)=>seletor==='.erro-campo'?[...mensagens.values()]:campos.filter(c=>c.classList.contains('invalido'));
    elementos.formTransacao.querySelector=()=>campos.find(c=>c.classList.contains('invalido'));
    elementos.botoesFechar=[elemento('button','x'),elemento('button','cancelar')];
    const estado=criarEstadoDisponibilidade({ler:(chave)=>({sucesso:true,dados:chave==='contas'?contas:chave==='transacoes'?registros:investimentos}),
        gravar:(chave,dados)=>{efeitos.push(['gravar',chave]);if(falhar)return{sucesso:false,erro:new Error('Quota')};gravacoes.push([chave,dados]);return{sucesso:true};}});
    estado.inicializarTransacoes();estado.inicializarContas();estado.inicializarInvestimentos();estado.verificarTransacoesCarregadas();estado.prepararCompatibilidadeTransacoes();
    const api=criarOperacoesTransacoes({elementos,consultas:estado,confirmarTransacoes: async (candidatas) =>{
        if (confirmar) return confirmar(candidatas, estado);
        const resultado=(await estado.confirmarTransacoes(candidatas));if(!resultado.sucesso)efeitos.push(['falha',resultado.motivo]);return resultado.sucesso;},
        consultarSelecao:()=>[...selecao],validarContaTransacao:(id)=>!estado.colecaoEstaBloqueada('contas')&&estado.consultarContas().some(c=>c.id===id),
        modais:{abrirModal:(modal,foco)=>{efeitos.push(['abrir',modal.id]);foco.focus();},fecharModal:(modal,limpar)=>{efeitos.push(['fechar',modal.id]);if(limpar)limpar();}},
        mostrarToast:(...args)=>efeitos.push(['toast',...args]),aposPersistir:()=>{selecao=[];efeitos.push(['atualizar']);},
        aposFecharExclusao:()=>efeitos.push(['investimentos']),gerarId:()=>`nova-${++id}`});
    const preencher=(alteracoes={})=>{elementos.campoNome.value=' Movimento ';elementos.campoValor.value='12.34';elementos.campoCategoria.value=' Categoria ';
        elementos.campoConta.value=conta().id;elementos.campoData.value='2026-11-03';elementos.selectClassificacao.value='Essencial';elementos.selectPagamento.value='Pix';
        Object.entries(alteracoes).forEach(([nome,valor])=>{elementos[nome].value=valor;});};
    return {api,elementos,estado,efeitos,gravacoes,mensagens,preencher,
        selecionar:(ids)=>{selecao=[...ids];},selecao:()=>[...selecao],falhar:()=>{falhar=true;}};
}

test('Operações: importação não acessa DOM, storage, eventos, timers ou crypto',async () =>{
    const url=pathToFileURL(resolve(__dirname,'../../frontend/js/funcionalidades/operacoes-transacoes.js')).href;
    execFileSync(process.execPath,['--input-type=module','-e',`for(const n of ['document','window','localStorage','crypto'])Object.defineProperty(globalThis,n,{get(){throw Error(n)}});globalThis.setTimeout=globalThis.addEventListener=()=>{throw Error('efeito')};await import(${JSON.stringify(url)});`]);
});

test('Operações: inicialização explícita/idempotente e encerramento sem listeners restantes',async () =>{
    const a=ambiente();assert.equal(a.elementos.formTransacao.listeners(),0);a.api.inicializar();a.api.inicializar();assert.equal(a.elementos.formTransacao.listeners(),1);
    a.api.encerrar();a.api.encerrar();assert.equal(a.elementos.formTransacao.listeners(),0);assert.equal(a.elementos.botoesFechar[0].listeners(),0);
    a.api.inicializar();await a.elementos.addReceita.emitir('click');assert.equal(a.efeitos.filter(([n])=>n==='abrir').length,1);
});

test('Operações: alternância limpa campos e erros, preserva título, foco e campos condicionais',async () =>{
    const a=ambiente();a.api.inicializar();a.api.abrirDespesa();a.preencher();
    a.elementos.campoNome.classList.add('invalido');a.mensagens.get('erro-campoNome').textContent='Erro';a.api.abrirReceita();
    assert.equal(a.elementos.campoNome.value,'');assert.equal(a.mensagens.get('erro-campoNome').textContent,'');
    assert.equal(a.elementos.modalTitle.textContent,'Adicionar Receita');assert.equal(a.elementos.campoClassificacao.classList.contains('hidden'),true);
    assert.equal(a.elementos.selectClassificacao.required,false);assert.equal(a.elementos.campoPagamento.classList.contains('hidden'),true);
    assert.deepEqual(a.efeitos.at(-1),['foco','campoNome']);a.api.abrirDespesa();assert.equal(a.elementos.selectClassificacao.required,true);
    assert.equal(a.elementos.campoPagamento.classList.contains('hidden'),false);
});

for(const tipo of ['receita','despesa'])test(`Operações: cadastro de ${tipo} confirma uma escrita antes de atualizar e fechar`,async () =>{
    const a=ambiente();a.api.inicializar();tipo==='receita'?a.api.abrirReceita():a.api.abrirDespesa();a.preencher();a.efeitos.length=0;
    await a.elementos.formTransacao.emitir('submit');assert.deepEqual(a.efeitos.map(([n])=>n),['gravar','atualizar','fechar','toast']);assert.equal(a.gravacoes.length,1);
    const registro=a.estado.consultarTransacoes()[0];assert.equal(registro.nome,'Movimento');assert.equal(registro.categoria,'Categoria');assert.equal(registro.valor,12.34);
    assert.equal(registro.tipo,tipo);assert.equal(registro.contaId,conta().id);assert.equal(registro.classificacao,tipo==='despesa'?'Essencial':null);assert.equal(registro.pagamento,tipo==='despesa'?'Pix':null);
});

for(const [campo,valor,mensagem]of [['campoNome','','nome da transação'],['campoCategoria','','categoria'],['campoValor','0','maior que zero'],['campoValor','-1','maior que zero'],
    ['campoValor','0.006','duas casas'],['campoValor','100000000000000','limite permitido'],['campoValor','abc','duas casas'],['campoData','2026-02-30','data válida'],
    ['campoConta','ausente','conta cadastrada'],['selectClassificacao','','classificação válida']])test(`Operações: rejeita ${campo}=${valor}, anuncia erro e não grava`,async () =>{
    const a=ambiente();a.api.inicializar();a.api.abrirDespesa();a.preencher({[campo]:valor});a.efeitos.length=0;await a.elementos.formTransacao.emitir('submit');
    assert.equal(a.gravacoes.length,0);assert.match(a.mensagens.get(`erro-${campo}`).textContent,new RegExp(mensagem));assert.equal(a.elementos[campo].getAttribute('aria-invalid'),'true');
    assert.equal(a.efeitos.some(([n])=>n==='atualizar'||n==='fechar'),false);assert.deepEqual(a.efeitos.at(-1),['foco',campo]);
});

test('Operações: validade nativa também rejeita entrada; classificação correta limpa apenas seu erro',async () =>{
    const a=ambiente();a.api.inicializar();a.api.abrirDespesa();a.preencher({selectClassificacao:''});await a.elementos.formTransacao.emitir('submit');
    a.elementos.selectClassificacao.value='desconhecida';await a.elementos.selectClassificacao.emitir('change');assert.equal(a.elementos.selectClassificacao.getAttribute('aria-invalid'),'true');
    a.elementos.selectClassificacao.value='Desejo';await a.elementos.selectClassificacao.emitir('change');assert.equal(a.elementos.selectClassificacao.getAttribute('aria-invalid'),undefined);
    a.elementos.campoValor.validity.valid=false;await a.elementos.formTransacao.emitir('submit');assert.equal(a.gravacoes.length,0);
    await a.elementos.campoValor.emitir('input');assert.equal(a.elementos.campoValor.getAttribute('aria-invalid'),undefined);
});

for(const tipo of ['receita','despesa'])test(`Operações: edição retroativa de ${tipo} preserva ID e campos adicionais`,async () =>{
    const a=ambiente({registros:[transacao({tipo,classificacao:tipo==='despesa'?'Essencial':null,extra:'preservar'})]});a.api.inicializar();a.api.editarTransacao(transacao().id);
    assert.equal(a.elementos.botaoSalvarTransacao.textContent,'Salvar Alterações');a.preencher({campoData:'2020-01-01'});await a.elementos.formTransacao.emitir('submit');
    const atual=a.estado.consultarTransacoes()[0];assert.equal(atual.id,transacao().id);assert.equal(atual.data,'2020-01-01');assert.equal(atual.extra,'preservar');assert.equal(a.gravacoes.length,1);
});

test('Operações: receitas futuras continuam válidas e dispensa classificação',async () =>{
    const a=ambiente();a.api.inicializar();a.api.abrirReceita();a.preencher({campoData:'2027-01-01',selectClassificacao:''});await a.elementos.formTransacao.emitir('submit');
    assert.equal(a.estado.consultarTransacoes()[0].data,'2027-01-01');
});

test('Operações: legado intacto permanece em cadastro independente e edição exige corrigir classificação',async () =>{
    const legado=transacao({tipo:'despesa',classificacao:null});const a=ambiente({registros:[legado]});a.api.inicializar();a.api.abrirReceita();a.preencher();await a.elementos.formTransacao.emitir('submit');
    assert.deepEqual(a.estado.consultarTransacoes()[0],legado);a.api.editarTransacao(legado.id);a.preencher({selectClassificacao:''});await a.elementos.formTransacao.emitir('submit');
    assert.equal(a.gravacoes.length,1);a.elementos.selectClassificacao.value='Essencial';await a.elementos.formTransacao.emitir('submit');assert.equal(a.gravacoes.length,2);
    assert.equal(a.estado.consultarTransacoes()[0].classificacao,'Essencial');
});

for(const operacao of ['cadastro','edicao','exclusao'])test(`Operações: falha de persistência na ${operacao} mantém estado, seleção e formulário`,async () =>{
    const a=ambiente({registros:[transacao()]});a.api.inicializar();a.selecionar([transacao().id]);
    if(operacao==='edicao')a.api.editarTransacao(transacao().id);else a.api.abrirReceita();a.preencher();a.falhar();const antes=a.estado.consultarTransacoes();a.efeitos.length=0;
    if(operacao==='exclusao')await a.api.confirmarExclusao();else await a.elementos.formTransacao.emitir('submit');
    assert.strictEqual(a.estado.consultarTransacoes(),antes);assert.deepEqual(a.selecao(),[transacao().id]);assert.equal(a.elementos.campoNome.value,' Movimento ');
    assert.deepEqual(a.efeitos.map(([n])=>n),['gravar','falha']);assert.equal(a.gravacoes.length,0);
});

test('Operações: ausência de conta e dados bloqueados impedem abertura; investimentos isolados não bloqueiam receita',async () =>{
    const vazio=ambiente({contas:[]});vazio.api.abrirReceita();assert.match(vazio.efeitos.at(-1)[1],/cadastrar uma conta/);
    for(const chave of ['contas','transacoes']){const a=ambiente();a.estado.bloquearColecao(chave);a.api.abrirDespesa();assert.equal(a.efeitos.some(([n])=>n==='abrir'),false);}
    const a=ambiente();a.estado.bloquearColecao('investimentos');a.api.inicializar();a.api.abrirReceita();a.preencher();await a.elementos.formTransacao.emitir('submit');assert.equal(a.gravacoes.length,1);
});

for(const ids of [['r'],['r','d']])test(`Operações: exclusão de ${ids.length} registros preserva mensagem e sequência`,async () =>{
    const a=ambiente({registros:[transacao({id:'r'}),transacao({id:'d',tipo:'despesa',classificacao:'Desejo'})]});a.api.inicializar();a.selecionar(ids);a.api.solicitarExclusao();
    assert.match(a.elementos.mensagemExclusao.textContent,new RegExp(`${ids.length} transa`));a.efeitos.length=0;await a.elementos.botaoConfirmarExclusao.emitir('click');
    assert.equal(a.estado.consultarTransacoes().length,2-ids.length);assert.deepEqual(a.selecao(),[]);assert.equal(a.gravacoes.length,1);
    assert.deepEqual(a.efeitos.map(([n])=>n),['gravar','atualizar','fechar','investimentos','toast']);
});

test('Operações: exclusão de aporte que sustenta resgate futuro é rejeitada; exclusão conjunta é validada pelo estado',async () =>{
    const ap=aporte({valor:20}),re=resgate({data:'2026-11-06',valor:10,capitalRetirado:10,valorRetiradoInvestimento:10});
    const a=ambiente({registros:[ap,re],investimentos:[investimento({capitalInicial:0,valorInformado:0})]});a.selecionar([ap.id]);const antes=a.estado.consultarTransacoes();
    await a.api.confirmarExclusao();assert.strictEqual(a.estado.consultarTransacoes(),antes);assert.deepEqual(a.selecao(),[ap.id]);assert.equal(a.gravacoes.length,0);
    assert.deepEqual(a.efeitos,[['falha','integridade']]);a.selecionar([ap.id,re.id]);await a.api.confirmarExclusao();assert.equal(a.gravacoes.length,1);assert.equal(a.estado.consultarTransacoes().length,0);
});

test('Operações: edição direta de aporte/resgate não abre formulário comum; cadastro independente preserva movimentos',async () =>{
    const a=ambiente({registros:[aporte(),resgate()]});a.api.editarTransacao(aporte().id);a.api.editarTransacao(resgate().id);assert.equal(a.efeitos.length,0);
    const antes=a.estado.consultarTransacoes();a.api.inicializar();a.api.abrirReceita();a.preencher();await a.elementos.formTransacao.emitir('submit');
    assert.deepEqual(a.estado.consultarTransacoes().slice(0,2),antes);
});

test('Operações: estado atualizado e conta renomeada são consultados ao abrir, sem snapshot permanente',async () =>{
    const a=ambiente({registros:[transacao()]});a.api.editarTransacao(transacao().id);(await a.estado.confirmarContas([conta({nome:'Conta renomeada'})]));a.api.atualizarOpcoesContas();
    assert.equal(a.elementos.campoConta.value,conta().id);assert.equal(a.elementos.campoConta.children[0].textContent,'Conta renomeada');
    (await a.estado.confirmarTransacoes([transacao({nome:'Registro atual'})]));a.api.editarTransacao(transacao().id);assert.equal(a.elementos.campoNome.value,'Registro atual');
});

test('Operações: Cancelar, X e clique externo respeitam limpeza e não apagam seleção',async () =>{
    const a=ambiente({registros:[transacao()]});a.api.inicializar();a.selecionar([transacao().id]);
    for(const botao of a.elementos.botoesFechar){a.api.editarTransacao(transacao().id);a.preencher();botao.emitir('click');assert.equal(a.elementos.campoNome.value,'');}
    a.api.cancelarExclusao();await a.elementos.modalExclusao.emitir('click');assert.deepEqual(a.selecao(),[transacao().id]);assert.equal(a.gravacoes.length,0);
    a.api.abrirReceita();a.preencher();await a.elementos.formTransacao.emitir('submit');assert.equal(a.estado.consultarTransacoes().length,2);
});

test('Operações: coordenador real mantém atualização antes de fechar e encaminha edição dos movimentos',async () =>{
    const fonte=readFileSync(resolve(__dirname,'../../frontend/js/script.js'),'utf8');
    const trecho=fonte.slice(fonte.indexOf('const operacoesTransacoes ='),fonte.indexOf('operacoesTransacoes.inicializar();'));
    const efeitos=[],elementos={};for(const [n]of trecho.match(/elementos: \{([^]*?)\}/)[1].matchAll(/\b\w+\b/g))elementos[n]={};
    let opcoes;new Script(trecho).runInContext(createContext({...elementos,disponibilidadeColecoes:{},criarOperacoesTransacoes:(args)=>{opcoes=args;},
        listaTransacoes:{},listagensTransacoes:{definirSelecao:()=>efeitos.push('selecao')},validarContaTransacao(){},abrirModal(){},fecharModal(){},mostrarToast(){},
        renderizarTransacoes:()=>efeitos.push('recentes'),atualizarCategorias:()=>efeitos.push('categorias'),atualizarTabelaCompleta:()=>efeitos.push('tabela'),
        atualizarResumo:()=>efeitos.push('resumo'),atualizarBarraAcoes:()=>efeitos.push('acoes'),renderizarInvestimentos:()=>efeitos.push('investimentos')}));
    opcoes.aposPersistir();assert.deepEqual(efeitos,['selecao','recentes','categorias','tabela','resumo','acoes']);opcoes.aposFecharExclusao();assert.equal(efeitos.at(-1),'investimentos');
    const editar=fonte.match(/^function solicitarEdicaoTransacaoSelecionada\([^]*?^\}/m)[0];
    for(const registro of [transacao(),aporte(),resgate()]){
        const chamadas=[];new Script(editar+'\nsolicitarEdicaoTransacaoSelecionada()').runInContext(createContext({
            listagensTransacoes:{consultarSelecao:()=>[registro.id]},disponibilidadeColecoes:{consultarTransacoes:()=>[registro]},
            ehMovimentacaoInvestimento,abrirModalMovimentacao:(...args)=>chamadas.push(args),operacoesTransacoes:{editarTransacao:(id)=>chamadas.push(id)}}));
        assert.deepEqual(chamadas,registro.tipo==='receita'?[registro.id]:[[registro.tipo,registro.investimentoId,registro.id]]);
    }
});

for (const excluir of [false, true]) {
    test(`Transações: ${excluir ? 'exclusão' : 'cadastro'} só conclui após confirmação controlada`, async () => {
        let liberar, chamadas = 0;
        const espera = new Promise(resolve => { liberar = resolve; });
        const a = ambiente({ registros: excluir ? [transacao()] : [], confirmar: async (dados, estado) => {
            chamadas++; await espera; return (await estado.confirmarTransacoes(dados)).sucesso;
        }});
        a.api.inicializar();
        if (excluir) a.selecionar([transacao().id]); else { a.api.abrirReceita(); a.preencher(); }
        const alvo = excluir ? a.elementos.botaoConfirmarExclusao : a.elementos.formTransacao;
        const tipo = excluir ? 'click' : 'submit';
        a.efeitos.length = 0;
        const antes = a.estado.consultarTransacoes();
        const primeira = alvo.emitir(tipo);
        await alvo.emitir(tipo);
        assert.equal(chamadas, 1);
        assert.strictEqual(a.estado.consultarTransacoes(), antes);
        assert.equal(a.gravacoes.length, 0);
        assert.equal(a.efeitos.some(([tipo]) => ['atualizar','fechar','toast'].includes(tipo)), false);
        liberar(); await primeira;
        assert.equal(a.gravacoes.length, 1);
        assert.equal(a.estado.consultarTransacoes().length, excluir ? 0 : 1);
    });
}

test('Transações: rejeição pendente mantém campos/modal e permite tentar novamente', async () => {
    let rejeitar, tentativas = 0;
    const espera = new Promise((resolve, reject) => { rejeitar = reject; });
    const a = ambiente({ confirmar: async (dados, estado) => {
        if (++tentativas === 1) return espera;
        return (await estado.confirmarTransacoes(dados)).sucesso;
    }});
    a.api.inicializar(); a.api.abrirDespesa(); a.preencher(); a.efeitos.length = 0;
    const primeira = a.elementos.formTransacao.emitir('submit');
    rejeitar(new Error('Rejeição controlada')); await primeira;
    assert.equal(a.elementos.botaoSalvarTransacao.disabled, undefined);
    assert.equal(a.elementos.campoNome.value, ' Movimento ');
    assert.equal(a.gravacoes.length, 0);
    assert.equal(a.efeitos.some(([tipo]) => ['atualizar','fechar'].includes(tipo)), false);
    assert.match(a.efeitos.at(-1)[1], /erro inesperado/);
    await a.elementos.formTransacao.emitir('submit');
    assert.equal(a.gravacoes.length, 1);
});
