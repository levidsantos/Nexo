const { criarOperacoesInvestimentos } = require('../../../frontend/js/funcionalidades/operacoes-investimentos.js');
const { criarEstadoDisponibilidade } = require('../../../frontend/js/dados/estado.js');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { Script } = require('node:vm');
const { conta, investimento, INVESTIMENTO_ID } = require('./fixtures.cjs');
const fonte = readFileSync(resolve(__dirname, '../../../frontend/js/script.js'), 'utf8');
// Exercita o preparador ainda mantido no coordenador, sem copiar sua regra.
const prepararMovimentacaoInvestimento = new Script(fonte.match(/^function prepararMovimentacaoInvestimento\([^]*?^\}/m)[0] + '\nprepararMovimentacaoInvestimento').runInNewContext();

function prepararOperacoes({ carteira = [investimento()], registros = [], contas = [conta()], estado: externo, mostrarToast } = {}) {
    const efeitos = [], gravacoes = [], armazenado = new Map(), elementos = {}, erros = new Map();
    let falha = false, id = 1;
    const document = { getElementById: n => erros.get(n), createElement: tag => elemento(tag) };
    function elemento(tag = 'div', nome = '') {
        const classes = new Set(), atributos = new Map(), listeners = new Map(); let value = '';
        return { tag, id: nome, ownerDocument: document, textContent: '', children: [], dataset: {}, checked: false, validity: { valid: true },
            get value() { return value; }, set value(v) { value = String(v); },
            classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n), toggle(n,on) { if(on) classes.add(n); else classes.delete(n); } },
            setAttribute: (n,v) => atributos.set(n,v), removeAttribute: n => atributos.delete(n), getAttribute: n => atributos.get(n),
            addEventListener(tipo, cb) { if(!listeners.has(tipo)) listeners.set(tipo, new Set()); listeners.get(tipo).add(cb); },
            removeEventListener(tipo, cb) { listeners.get(tipo)?.delete(cb); },
            emitir(tipo, target = this) { for (const cb of [...listeners.get(tipo) ?? []]) cb({target,preventDefault(){}}); },
            listeners() { return [...listeners.values()].reduce((n,s)=>n+s.size,0); },
            focus() { document.activeElement = this; efeitos.push(['foco',nome]); },
            replaceChildren(...filhos) { this.children = filhos; }, add(opcao) { this.children.push(opcao); }
        };
    }
    // IDs obtidos dos consumidores reais, incluindo campos gerados por nome.
    const origem = readFileSync(resolve(__dirname, '../../../frontend/js/funcionalidades/operacoes-investimentos.js'), 'utf8');
    const ids = [...new Set([...origem.matchAll(/obterElemento\("([^"]+)"\)/g)].map(m=>m[1]).concat([
        'aviso-retroativo-investimento','aviso-retroativo-manual',
        ...['investimento','conta','valor','capital','baixa','data','observacoes'].map(n=>n+'-movimentacao')]))];
    for(const nome of ids) { elementos[nome] = elemento('div',nome); const erro=elemento(); erro.classList.add('erro-campo'); erros.set('erro-'+nome,erro); }
    const campos = {
        investimento: ['nome','tipo','instituicao','capital','valor','referencia','referencia-valor','observacoes'].map(n=>elementos[n+'-investimento']),
        manual: [elementos['valor-manual-investimento'],elementos['data-valor-manual']],
        movimento: ['investimento','conta','valor','capital','baixa','data','observacoes'].map(n=>elementos[n+'-movimentacao'])
    };
    for(const [nome,grupo] of [['form-investimento',campos.investimento],['form-valor-investimento',campos.manual],['form-movimentacao',campos.movimento]]) {
        const form=elementos[nome]; form.reset=()=>grupo.forEach(c=>{c.value='';c.checked=false;});
        form.querySelectorAll=sel=>sel==='.erro-campo'?grupo.map(c=>erros.get('erro-'+c.id)):grupo.filter(c=>c.classList.contains('invalido'));
        form.querySelector=()=>grupo.find(c=>c.classList.contains('invalido'));
    }
    elementos.botoesMovimentacao=['aporte','resgate'].map(tipo=>{const e=elemento();e.dataset.movimentacao=tipo;return e;});
    const estado = externo ?? criarEstadoDisponibilidade({ler:chave=>({sucesso:true,dados:chave==='contas'?contas:chave==='transacoes'?registros:carteira}),
        gravar:(chave,dados)=>{efeitos.push(['gravar',chave]);if(falha)return{sucesso:false,erro:new Error('Quota')};gravacoes.push([chave,dados]);armazenado.set(chave,JSON.stringify(dados));return{sucesso:true};}});
    if(!externo){estado.inicializarTransacoes();estado.inicializarContas();estado.inicializarInvestimentos();estado.verificarTransacoesCarregadas();estado.prepararCompatibilidadeTransacoes();}
    const confirmar=(chave,api,dados)=>{const r=estado[api](dados);if(!r.sucesso)efeitos.push(['falha',chave,r.motivo]);return r.sucesso;};
    const opcoes={elementos,consultas:estado,
        confirmarInvestimentos:dados=>confirmar('investimentos','confirmarInvestimentos',dados), confirmarTransacoes:dados=>confirmar('transacoes','confirmarTransacoes',dados),
        validarContaTransacao:id=>!estado.colecaoEstaBloqueada('contas')&&estado.consultarContas().some(c=>c.id===id), prepararMovimentacaoInvestimento,
        obterRestricaoMovimentacaoInvestimentos:()=>['contas','transacoes','investimentos'].some(c=>estado.colecaoEstaBloqueada(c))?{mensagem:'Dados indisponíveis',tipo:'erro'}:!estado.consultarContas().length||!estado.consultarInvestimentos().length?{mensagem:'Cadastre conta e investimento',tipo:'informacao'}:null,
        formatarDataInvestimento:data=>data.split('-').reverse().join('/'),
        modais:{abrirModal:(modal,foco)=>{efeitos.push(['abrir',modal.id]);foco.focus();},fecharModal:(modal,limpar)=>{efeitos.push(['fechar',modal.id]);limpar?.();}},
        mostrarToast:mostrarToast??((...args)=>efeitos.push(['toast',...args])),
        aposSalvarInvestimento:(r,editando)=>efeitos.push(['salvar',r.id,editando]), aposExcluirInvestimento:()=>efeitos.push(['excluir']),
        aposAtualizarValor:r=>efeitos.push(['manual',r.id]), aposSalvarMovimentacao:()=>efeitos.push(['movimento']),
        gerarId:()=>`22222222-2222-4222-8222-${String(id++).padStart(12,'0')}`};
    const api=criarOperacoesInvestimentos(opcoes);
    const preencher=(valores={})=>{for(const [nome,v] of Object.entries(valores))elementos[nome].value=v;};
    const cadastro=(extras={})=>preencher({'nome-investimento':' Novo ','tipo-investimento':' Tipo livre ','capital-investimento':'0','valor-investimento':'10.25','referencia-investimento':'2026-10-31','referencia-valor-investimento':'2026-10-31',...extras});
    const movimentacao=(extras={})=>preencher({'investimento-movimentacao':INVESTIMENTO_ID,'conta-movimentacao':conta().id,'valor-movimentacao':'10.25','data-movimentacao':'2026-11-03',...extras});
    return {api,opcoes,elementos,erros,estado,efeitos,gravacoes,armazenado,document,preencher,cadastro,movimentacao,falhar:(valor=true)=>{falha=valor;},enviar:n=>elementos[n].emitir('submit')};
}
module.exports = { prepararOperacoes };
