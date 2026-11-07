'use strict';
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { criarAnalises } = require('../../frontend/js/funcionalidades/analises.js');
const { prepararHistoricoMensal, definirPeriodoDespesas, prepararDistribuicaoDespesas } = require('../../frontend/js/dominio/calculos.js');
const { formatarCentavos } = require('../../frontend/js/dominio/valores-datas.js');
const { transacao, aporte, resgate } = require('./support/fixtures.cjs');
beforeEach(t=>t.mock.timers.enable({apis:['Date'],now:new Date(2026,10,5,12)}));
function eventos(obj={}) {const ls=new Map();return Object.assign(obj,{ls,addEventListener(t,f){if(!ls.has(t))ls.set(t,new Set());ls.get(t).add(f);},removeEventListener(t,f){ls.get(t)?.delete(f);},emitir(t,e={}){for(const f of [...ls.get(t)??[]])f(e);},quantidade(){return [...ls.values()].reduce((n,s)=>n+s.size,0);}});}
function ambiente(t,{registros=[transacao({data:'2026-10-01',valor:12.34}),transacao({id:'d',tipo:'despesa',classificacao:'Essencial',data:'2026-11-03',valor:5.67})],pagina='resumo',reduzido=false,observador=true}={}) {
    const elementos={},erros=new Map(),desenhos=[],frames=new Map(),todosFrames=[],observadores=[],criadas=[],mapa=new Map(),consultas=[];
    let tempo=0,idFrame=0,ChartDisponivel=true,indisponivel=false;
    const document=eventos({visibilityState:'visible',createElement:tag=>elemento(tag),getElementById:id=>erros.get(id)});
    function elemento(tag='div',id='') {const classes=new Set();let texto='';const e=eventos({tag,id,ownerDocument:document,value:'',hidden:false,children:[],dataset:{},style:{},atributos:{},
        classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),contains:n=>classes.has(n)},
        setAttribute(n,v){this.atributos[n]=v;},removeAttribute(n){delete this.atributos[n];},getAttribute(n){return this.atributos[n];},
        append(...fs){this.children.push(...fs);},appendChild(f){this.children.push(f);},replaceChildren(...fs){this.children=fs;texto='';},
        get options(){return this.children;},contains(alvo){return alvo===this;},
        getBoundingClientRect(){return this.retangulo??{top:100,bottom:300,left:50,right:650};}
    });Object.defineProperty(e,'textContent',{get:()=>texto+e.children.map(c=>typeof c==='string'?c:c.textContent).join(''),set:v=>{texto=v;e.children=[];}});return e;}
    for(const id of ['grafico-distribuicao','area-distribuicao','periodo-distribuicao','mes-inicial-distribuicao','mes-final-distribuicao','estado-distribuicao','total-distribuicao','intervalo-distribuicao','legenda-distribuicao','meses-distribuicao','valor-total-distribuicao','mes-final-historico',...['area','estado','periodo','dados','grafico'].flatMap(p=>['resumo','analises'].map(d=>`${p}-historico-${d}`))])elementos[id]=elemento('div',id);
    for(const id of ['mes-inicial-distribuicao','mes-final-distribuicao'])erros.set('erro-'+id,elemento());
    elementos['periodo-distribuicao'].value='atual';
    const paginas={resumo:elemento(),analises:elemento()};paginas[pagina]?.classList.add('ativa');
    const cards={resumo:{getAnimations:()=>[]},analises:{getAnimations:()=>[]},distribuicao:{getAnimations:()=>[]}};
    for(const chave of ['resumo','analises','distribuicao']) {const canvas=elementos[chave==='distribuicao'?'grafico-distribuicao':`grafico-historico-${chave}`],area=elementos[chave==='distribuicao'?'area-distribuicao':`area-historico-${chave}`];canvas.parentElement=area;canvas.closest=sel=>sel==='.pagina'?paginas[chave==='resumo'?'resumo':'analises']:cards[chave];area.hidden=true;}
    class Chart {
        static getChart(canvas){return mapa.get(canvas);}
        constructor(canvas,config){if(mapa.has(canvas))throw Error('Instância duplicada');this.canvas=canvas;this.config=config;this.data=config.data;this.options=config.options;this.width=600;this.height=240;this.chartArea={left:30,top:10,right:580,bottom:210};this.active=[];this.updates=[];this.resizes=0;this.draws=0;this.destruicoes=0;this.ctx=Object.fromEntries(['save','restore','beginPath','rect','moveTo','arc','closePath','clip','lineTo','setLineDash','stroke'].map(n=>[n,(...args)=>desenhos.push([canvas.id,n,...args])]));this.tooltip={setActiveElements:(v)=>{this.ativoTooltip=v;}};mapa.set(canvas,this);criadas.push(this);this.draw();}
        getActiveElements(){return this.active;}setActiveElements(v){this.active=v;}
        getDatasetMeta(){return {data:[{x:300,y:120,startAngle:-Math.PI/2,endAngle:Math.PI/2},{x:300,y:120,startAngle:Math.PI/2,endAngle:3*Math.PI/2}]};}
        hook(nome,...args){for(const p of this.config.plugins)p[nome]?.(this,...args);}
        update(modo){this.updates.push(modo);this.hook('beforeUpdate');if(this.falhaUpdate)throw Error('update');this.draw();}
        resize(){this.resizes++;this.hook('resize');if(this.falhaResize)throw Error('resize');}
        draw(){this.draws++;if(this.falhaDraw)throw Error('draw');this.hook('beforeDatasetsDraw');this.hook('afterDatasetsDraw');}
        destroy(){this.destruicoes++;this.hook('beforeDestroy');if(this.falhaDestroy)throw Error('destroy');mapa.delete(this.canvas);}
    }
    const window={innerHeight:900,innerWidth:1280,performance:{now:()=>tempo},requestAnimationFrame:f=>{const id=++idFrame;frames.set(id,f);todosFrames.push(f);return id;},cancelAnimationFrame:id=>frames.delete(id)};
    if(observador)window.IntersectionObserver=class {constructor(cb){this.cb=cb;this.alvos=[];this.desconectado=false;observadores.push(this);}observe(e){this.alvos.push(e);}disconnect(){this.desconectado=true;}};
    const botoesDuracao=[3,6,12].map(n=>Object.assign(elemento('button'),{dataset:{duracaoHistorico:String(n)}})),movimento=eventos({matches:reduzido});
    const opcoes={document,window,elementos,botoesDuracao,movimentoReduzidoGraficos:movimento,obterChart:()=>ChartDisponivel?Chart:null,
        obterHistoricoMensal:(fim=null,duracao=6)=>{consultas.push([fim,duracao]);return indisponivel?{disponivel:false,motivo:'Dados bloqueados'}:prepararHistoricoMensal(registros,'2026-11-05',fim,duracao);},
        obterDistribuicaoDespesas:(tipo,inicio,fim)=>{if(indisponivel)return{disponivel:false,motivo:'Dados bloqueados'};const p=definirPeriodoDespesas(tipo,inicio,fim,'2026-11-05');return prepararDistribuicaoDespesas(registros,p.mesInicial,p.mesFinal,'2026-11-05');}};
    const ui=criarAnalises(opcoes);t.after(()=>ui.encerrar());
    const atualizar=()=>{ui.atualizarGraficosHistorico();ui.atualizarDistribuicaoDespesas();};
    const quadro=ms=>{tempo=ms;const pendentes=[...frames.values()];frames.clear();pendentes.forEach(f=>f(ms));};
    const navegar=destino=>{ui.concluirFormacoesAnalises();ui.prepararFormacoesPagina(destino);Object.entries(paginas).forEach(([n,p])=>{p.classList.remove('ativa');if(n===destino)p.classList.add('ativa');});atualizar();ui.agendarFormacaoAnalises(destino==='resumo'?'resumo':'historico');if(destino==='analises')ui.agendarFormacaoAnalises('distribuicao');};
    return {ui,opcoes,elementos,document,window,criadas,mapa,desenhos,frames,todosFrames,observadores,botoesDuracao,movimento,consultas,paginas,cards,atualizar,quadro,navegar,
        grafico:chave=>mapa.get(elementos[chave==='distribuicao'?'grafico-distribuicao':`grafico-historico-${chave}`]),
        registros:novos=>{registros=novos;},bloquear:()=>{indisponivel=true;},biblioteca:ativa=>{ChartDisponivel=ativa;},tempo:ms=>{tempo=ms;}};
}

test('Análises: import sem DOM, Chart, armazenamento, observers, frames ou listeners',()=>{
    const url=pathToFileURL(resolve(__dirname,'../../frontend/js/funcionalidades/analises.js')).href;execFileSync(process.execPath,['--input-type=module','-e',`for(const n of ['document','window','localStorage','Chart','IntersectionObserver'])Object.defineProperty(globalThis,n,{get(){throw Error(n)}});globalThis.requestAnimationFrame=globalThis.addEventListener=()=>{throw Error('efeito')};await import(${JSON.stringify(url)});`]);
});
test('Análises: fábrica inerte, inicialização explícita/idempotente e listeners únicos',t=>{const a=ambiente(t);assert.equal(a.criadas.length,0);assert.equal(a.document.quantidade(),0);assert.equal(a.observadores.length,0);a.ui.inicializar();a.ui.inicializar();assert.equal(a.document.quantidade(),1);assert.equal(a.observadores.length,1);assert.equal(a.observadores[0].alvos.length,3);assert.equal(a.movimento.quantidade(),1);assert.ok(a.botoesDuracao.every(b=>b.quantidade()===1));});
test('Análises: três gráficos compartilham formação, preservam configuração, cores e tooltips exatos',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();assert.equal(a.criadas.length,3);const resumo=a.grafico('resumo'),historico=a.grafico('analises'),rosca=a.grafico('distribuicao');
    assert.strictEqual(resumo.config.plugins[1],historico.config.plugins[1]);assert.strictEqual(rosca.config.plugins[0],historico.config.plugins[1]);
    for(const grafico of [resumo,historico]){assert.equal(grafico.config.type,'line');assert.equal(grafico.options.animation,false);assert.equal(grafico.options.elements.point.radius,0);assert.equal(grafico.options.elements.line.cubicInterpolationMode,'monotone');assert.equal(grafico.options.scales.y.beginAtZero,true);assert.deepEqual(grafico.data.datasets.map(d=>d.borderColor),['#14966D','#E76F65']);}
    assert.equal(rosca.config.type,'doughnut');assert.equal(rosca.options.cutout,'65%');assert.equal(rosca.data.datasets[0].backgroundColor[0],'#289568');
    assert.equal(historico.options.plugins.tooltip.callbacks.title([{dataIndex:5}]),'Novembro de 2026');assert.equal(historico.options.plugins.tooltip.callbacks.label({dataset:{label:'Despesas'},datasetIndex:1,dataIndex:5}),`Despesas: ${formatarCentavos(567)}`);
    assert.ok(a.elementos['dados-historico-analises'].textContent.includes('Novembro de 2026: receitas R$'));assert.ok(a.elementos['legenda-distribuicao'].textContent.includes('Necessidades:'));assert.equal(a.elementos['valor-total-distribuicao'].textContent,formatarCentavos(567));
});
test('Análises: atualizações reutilizam instâncias, opções/tooltip e datasets novos',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();const anteriores=[...a.mapa.values()];a.registros([transacao({data:'2026-11-01',valor:21.43}),transacao({id:'d',tipo:'despesa',classificacao:'Desejo',valor:9.99,data:'2026-11-02'})]);a.atualizar();assert.equal(a.criadas.length,3);assert.deepEqual([...a.mapa.values()],anteriores);assert.deepEqual(a.grafico('analises').data.datasets[0].data,[0,0,0,0,0,21.43]);assert.ok(a.grafico('analises').updates.every(m=>m==='none'));assert.equal(a.grafico('distribuicao').data.labels[0],'Desejos');assert.ok(a.grafico('distribuicao').options.plugins.tooltip.callbacks.label({dataIndex:0}).includes(formatarCentavos(999)));
});
test('Análises: 3/6/12 meses independentes do compacto, mês final e limites válidos',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();const seletor=a.elementos['mes-final-historico'];assert.deepEqual(seletor.children.map(c=>c.value),['2026-11','2026-10']);
    seletor.value='2026-10';seletor.emitir('change',{target:seletor});for(const [i,n]of [3,6,12].entries()){a.botoesDuracao[i].emitir('click');assert.equal(a.grafico('analises').data.labels.length,n);assert.equal(a.grafico('analises').data.labels.at(-1),'Outubro de 2026');assert.equal(a.grafico('resumo').data.labels.length,6);assert.equal(a.botoesDuracao[i].getAttribute('aria-pressed'),'true');}assert.ok(!a.elementos['periodo-historico-analises'].textContent.includes('Dados até hoje'));
    a.registros([transacao({data:'2026-11-01'})]);a.ui.atualizarGraficosHistorico();assert.equal(seletor.value,'2026-11');
});
test('Análises: distribuição atual/anterior/personalizada e erros por campo sem alterar histórico',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();const e=a.elementos,antes=a.grafico('analises').updates.length;
    e['periodo-distribuicao'].value='anterior';e['periodo-distribuicao'].emitir('change');assert.equal(e['intervalo-distribuicao'].textContent,'Outubro de 2026');assert.equal(e['area-distribuicao'].hidden,true);
    e['periodo-distribuicao'].value='personalizado';e['mes-inicial-distribuicao'].value='2026-10';e['mes-final-distribuicao'].value='2026-11';e['periodo-distribuicao'].emitir('change');assert.equal(e['meses-distribuicao'].hidden,false);assert.equal(e['intervalo-distribuicao'].textContent,'Outubro de 2026 — Novembro de 2026');assert.equal(e['area-distribuicao'].hidden,false);
    e['mes-final-distribuicao'].value='2026-09';e['mes-final-distribuicao'].emitir('change');assert.equal(e['total-distribuicao'].hidden,true);assert.equal(e['mes-final-distribuicao'].getAttribute('aria-invalid'),'true');assert.equal(a.grafico('analises').updates.length,antes);
});
for(const bloqueado of [false,true])test(`Análises: estado ${bloqueado?'indisponível':'vazio'} remove gráficos e não apresenta zeros indevidos`,t=>{const a=ambiente(t);a.ui.inicializar();a.atualizar();const antigos=[...a.mapa.values()];if(bloqueado)a.bloquear();else a.registros([]);a.atualizar();assert.equal(a.mapa.size,0);assert.ok(antigos.every(g=>g.destruicoes===1));assert.equal(a.elementos['area-historico-resumo'].hidden,true);assert.equal(a.elementos['mes-final-historico'].disabled,true);assert.equal(a.elementos['total-distribuicao'].hidden,bloqueado);assert.equal(a.elementos['valor-total-distribuicao'].textContent,bloqueado?'':formatarCentavos(0));assert.ok(a.elementos['estado-historico-analises'].textContent.includes(bloqueado?'indisponível':'Nenhuma transação'));});
test('Análises: Chart indisponível preserva alternativa textual, total e legenda válidos',t=>{const a=ambiente(t);a.ui.inicializar();a.biblioteca(false);assert.doesNotThrow(a.atualizar);assert.equal(a.criadas.length,0);assert.ok(a.elementos['estado-historico-analises'].textContent.includes('biblioteca'));assert.ok(a.elementos['dados-historico-analises'].textContent.includes('Novembro'));assert.equal(a.elementos['total-distribuicao'].hidden,false);assert.equal(a.elementos['legenda-distribuicao'].children.length,1);a.biblioteca(true);a.atualizar();assert.equal(a.criadas.length,3);});
for(const falha of ['falhaUpdate','falhaResize'])test(`Análises: ${falha} e destroy excepcionais não interrompem atualização e recuperação`,t=>{const a=ambiente(t);a.ui.inicializar();a.atualizar();const antigo=a.grafico('analises');antigo[falha]=true;assert.doesNotThrow(a.atualizar);assert.equal(antigo.destruicoes,1);assert.equal(a.grafico('analises'),undefined);a.atualizar();assert.notStrictEqual(a.grafico('analises'),antigo);a.grafico('analises').falhaDestroy=true;a.registros([]);assert.doesNotThrow(a.atualizar);assert.equal(a.elementos['area-historico-analises'].hidden,true);});
test('Análises: revelação horizontal efetiva no compacto e histórico com geometria final intacta',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();a.quadro(0);a.desenhos.length=0;a.quadro(225);const rect=a.desenhos.find(([id,op])=>id==='grafico-historico-resumo'&&op==='rect');assert.ok(rect);assert.ok(rect[4]>0&&rect[4]<550);assert.equal(a.desenhos.filter(([,op])=>op==='save').length,a.desenhos.filter(([,op])=>op==='restore').length);assert.equal(a.grafico('resumo').data.datasets[0].data[4],12.34);
    a.navegar('analises');a.quadro(300);a.desenhos.length=0;a.quadro(550);assert.ok(a.desenhos.some(([id,op,,,largura])=>id==='grafico-historico-analises'&&op==='rect'&&largura>0&&largura<550));assert.ok(a.desenhos.some(([id,op])=>id==='grafico-distribuicao'&&op==='arc'));
});
test('Análises: criação oculta não consome formação; exposição abaixo da dobra aguarda observador',t=>{const a=ambiente(t);a.ui.inicializar();a.atualizar();assert.equal(a.frames.size,1);a.ui.concluirFormacoesAnalises();a.elementos['area-historico-resumo'].retangulo={top:1000,bottom:1200,left:10,right:600};a.ui.agendarFormacaoAnalises('resumo');assert.equal(a.frames.size,0);a.elementos['area-historico-resumo'].retangulo={top:100,bottom:300,left:10,right:600};a.observadores[0].cb([{target:a.elementos['area-historico-resumo'],isIntersecting:true}]);assert.equal(a.frames.size,1);});
test('Análises: formação aguarda metade da entrada do card e mantém 450 ms do compacto',t=>{const a=ambiente(t);a.cards.resumo.getAnimations=()=>[{animationName:'entrada-pagina',currentTime:0,effect:{getTiming:()=>({delay:110,duration:400})}}];a.ui.inicializar();a.atualizar();a.quadro(0);a.desenhos.length=0;a.quadro(200);assert.equal(a.desenhos.find(([,op])=>op==='rect')[4],0);a.quadro(760);assert.equal(a.frames.size,0);});
test('Análises: retorno rápido não repete, retorno após 5 segundos repete por gráfico',t=>{const a=ambiente(t);a.ui.inicializar();a.atualizar();a.quadro(0);a.quadro(450);a.tempo(1000);a.navegar('analises');a.quadro(1000);a.quadro(1500);a.tempo(2000);a.navegar('resumo');assert.equal(a.frames.size,0);a.tempo(5001);a.navegar('resumo');assert.equal(a.frames.size,1);a.quadro(5001);a.desenhos.length=0;a.quadro(5200);assert.ok(a.desenhos.some(([id,op])=>id==='grafico-historico-resumo'&&op==='rect'));});
test('Análises: troca de período, dados e resize concluem formação sem reiniciar',t=>{const a=ambiente(t,{pagina:'analises'});a.ui.inicializar();a.atualizar();a.quadro(0);a.quadro(100);a.botoesDuracao[2].emitir('click');assert.equal(a.frames.size,1);a.tempo(6000);a.navegar('analises');a.quadro(6000);a.grafico('analises').resize();assert.equal(a.frames.size,1);a.ui.atualizarDistribuicaoDespesas();assert.equal(a.frames.size,0);});
test('Análises: reduced motion, aba oculta e ausência de observador mantêm desenho completo',t=>{const a=ambiente(t,{reduzido:true});a.ui.inicializar();a.atualizar();a.quadro(0);assert.equal(a.frames.size,0);assert.ok(!a.desenhos.some(([,op])=>op==='rect'));a.movimento.matches=false;a.tempo(6000);a.navegar('resumo');a.quadro(6000);a.movimento.matches=true;a.movimento.emitir('change');assert.equal(a.frames.size,0);a.document.visibilityState='hidden';a.ui.agendarFormacaoAnalises('resumo');assert.equal(a.frames.size,0);const b=ambiente(t,{observador:false});b.ui.inicializar();b.atualizar();assert.equal(b.frames.size,0);});
test('Análises: pointer fora e saída de interação removem marcador/tooltip e restauram canvas',t=>{const a=ambiente(t);a.ui.inicializar();a.atualizar();a.ui.concluirFormacoesAnalises();const g=a.grafico('analises');g.active=[{element:{x:200}}];a.desenhos.length=0;g.draw();assert.ok(a.desenhos.some(([,op,args])=>op==='setLineDash'&&args[0]===2));assert.equal(a.desenhos.filter(([,op])=>op==='save').length,a.desenhos.filter(([,op])=>op==='restore').length);a.document.emitir('pointerdown',{target:{}});assert.deepEqual(g.active,[]);g.active=[{element:{x:100}}];const args={event:{type:'touchcancel'},inChartArea:true};g.hook('afterEvent',args);assert.equal(args.changed,true);assert.deepEqual(g.active,[]);});
test('Análises: encerramento cancela frames, observer, listeners e instâncias; reabre sem duplicar',t=>{const a=ambiente(t);a.ui.inicializar();a.atualizar();a.quadro(0);const pendente=a.todosFrames.at(-1),antigos=[...a.mapa.values()],observer=a.observadores[0];a.ui.encerrar();a.ui.encerrar();assert.equal(a.frames.size,0);assert.equal(a.mapa.size,0);assert.equal(a.document.quantidade(),0);assert.equal(a.movimento.quantidade(),0);assert.ok(a.botoesDuracao.every(b=>b.quantidade()===0));assert.equal(observer.desconectado,true);const desenhos=a.desenhos.length;pendente(250);observer.cb([{target:a.elementos['area-historico-resumo'],isIntersecting:true}]);assert.equal(a.desenhos.length,desenhos);assert.ok(antigos.every(g=>g.destruicoes===1));a.ui.inicializar();a.atualizar();assert.equal(a.mapa.size,3);assert.equal(a.observadores.length,2);assert.equal(a.document.quantidade(),1);});

test('Análises: callback de frame antigo não altera uma nova formação na mesma instância',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();a.quadro(0);const antigo=a.todosFrames.at(-1);a.tempo(6000);a.navegar('resumo');a.quadro(6000);const antes=a.desenhos.length;assert.equal(a.frames.size,1);antigo(6100);assert.equal(a.desenhos.length,antes);assert.equal(a.frames.size,1);
});
test('Análises: observador desconectado não cancela formação após reinicialização',t=>{
    const a=ambiente(t);a.ui.inicializar();a.atualizar();const antigo=a.observadores[0];a.ui.encerrar();a.ui.inicializar();a.atualizar();const frames=a.frames.size;antigo.cb([{target:a.elementos['area-historico-resumo'],isIntersecting:false}]);assert.equal(a.frames.size,frames);
});
test('Análises: classificação incompatível bloqueia somente distribuição e preserva histórico',t=>{
    const a=ambiente(t,{registros:[transacao({tipo:'despesa',classificacao:'',data:'2026-11-03'})]});a.ui.inicializar();a.atualizar();assert.equal(a.mapa.size,2);assert.equal(a.elementos['area-historico-analises'].hidden,false);assert.equal(a.elementos['total-distribuicao'].hidden,true);assert.ok(a.elementos['estado-distribuicao'].textContent.includes('indisponível'));
});
test('Análises: aportes, resgates e transações futuras não alteram os datasets apresentados',t=>{
    const base=[transacao({data:'2026-11-01',valor:12.34}),transacao({id:'d',tipo:'despesa',classificacao:'Essencial',data:'2026-11-03',valor:5.67})];const a=ambiente(t,{registros:base});a.ui.inicializar();a.atualizar();const antes=structuredClone(a.grafico('analises').data),total=a.elementos['valor-total-distribuicao'].textContent;
    a.registros([...base,aporte(),resgate(),transacao({id:'futuro',data:'2026-11-06',valor:100})]);a.atualizar();assert.deepEqual(a.grafico('analises').data,antes);assert.equal(a.elementos['valor-total-distribuicao'].textContent,total);
});
