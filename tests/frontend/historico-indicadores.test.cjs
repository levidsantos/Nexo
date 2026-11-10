const {test}=require('node:test');
const assert=require('node:assert/strict');
const {INDICADORES,intervaloHistorico}=require('../../frontend/js/dominio/indicadores-economicos.js');
const {criarCacheIndicadores}=require('../../frontend/js/dados/cache-indicadores.js');
const {criarIndicadoresEconomicos}=require('../../frontend/js/funcionalidades/indicadores-economicos.js');
for(const [chave,config] of Object.entries(INDICADORES)) for(const meses of config.periodos) {
    test(`Histórico: período permitido ${chave}/${meses}`,()=>{
        const r=intervaloHistorico(chave,meses,'2026-11-09');assert.equal(r.fim,'2026-11-09');assert.ok(r.inicio<r.fim);
        if(config.mensal)assert.ok(r.inicio.endsWith('-01'));
    });
}
test('Histórico: fim de mês, ano bissexto e rejeições',()=>{
    assert.equal(intervaloHistorico('dolar',1,'2024-03-31').inicio,'2024-02-29');
    assert.equal(intervaloHistorico('ipca',12,'2026-11-09').inicio,'2025-12-01');
    assert.throws(()=>intervaloHistorico('selic',60,'2026-11-09'));assert.throws(()=>intervaloHistorico('ipca',12,'2026-02-30'));
});
test('Histórico: cache de período isolado, deduplicado e vazio legítimo reutilizado',async()=>{
    let n=0;const memoria=new Map(),args=[];
    const cache=criarCacheIndicadores({hoje:()=> '2026-11-09',agora:()=>Date.parse('2026-11-09T12:00:00Z'),armazenamento:()=>({getItem:k=>memoria.get(k)??null,setItem:(k,v)=>memoria.set(k,v)}),consultar:async(...a)=>{n++;args.push(a);return []}});
    await Promise.all([cache.obter('ipca',12),cache.obter('ipca',12)]);await cache.obter('ipca',12);
    assert.equal(n,1);assert.deepEqual(args[0],['ipca','2025-12-01','2026-11-09']);
    await cache.obter('ipca',24);assert.equal(n,2);assert.equal(memoria.size,2);
});
test('Histórico: cache expirado preserva dados e intervalo anterior na falha',async()=>{
    let tempo=Date.parse('2026-11-09T12:00:00Z'),falhar=false;
    const cache=criarCacheIndicadores({hoje:()=> '2026-11-09',agora:()=>tempo,armazenamento:()=>{throw Error('sem storage')},consultar:async()=>{if(falhar)throw Error('rede');return [{data:'2026-09-01',valor:'-0.12'}]}});
    await cache.obter('ipca',12);tempo+=86400001;falhar=true;const r=await cache.obter('ipca',12);assert.equal(r.estado,'anterior');assert.equal(r.dados[0].valor,'-0.12');
});
function ambiente(obter, ambienteMotion) {
    const alvos={};
    const elemento=()=>({filhos:[],hidden:false,value:'',listeners:{},textContent:'',replaceChildren(){this.filhos=[]},appendChild(e){this.filhos.push(e)},setAttribute(k,v){this[k]=v},addEventListener(k,v){this.listeners[k]=v},emitir(){this.listeners.change?.()}});
    for(const id of ['selecao-indicador','periodo-indicador','estado-historico-indicador','grafico-indicadores','valores-historico-indicador','referencia-historico-indicador','contexto-historico-indicador','fonte-historico-indicador',...Object.keys(INDICADORES).map(k=>'indicador-'+k)])alvos[id]=elemento();
    const instancias=[];let falharUpdate=false,falharDestroy=false;
    class Chart {
        constructor(canvas,config){this.config=config;this.data=config.data;this.options=config.options;this.updates=0;this.recortes=[];this.saldo=0;this.chartArea={left:10,top:20,right:210,bottom:120};this.scales={y:{getPixelForValue:()=>80}};this.ctx={save:()=>this.saldo++,restore:()=>this.saldo--,beginPath(){},rect:(_x,_y,w)=>this.recortes.push(w),clip(){}};instancias.push(this);this.draw()}
        update(m){if(m!==undefined)assert.equal(m,'none');this.updates++;if(falharUpdate)throw Error('update');this.draw()}
        draw(){for(const plugin of this.config.plugins??[])plugin.beforeDatasetsDraw?.(this);for(const plugin of this.config.plugins??[])plugin.afterDatasetsDraw?.(this)}
        stop(){this.paradas=(this.paradas??0)+1}
        destroy(){this.destruido=true;if(falharDestroy)throw Error('destroy')}
    }
    const document={body:{},getElementById:id=>alvos[id],createElement:elemento};
    const chamadas=[];
    const cache={obter:async(k,m)=>{chamadas.push([k,m]);return obter?obter(k,m):resultado(k)}};
    const ui=criarIndicadoresEconomicos({document,cache,obterChart:()=>Chart,obterEstilo:()=>({getPropertyValue:()=> '#7652af'}),...(ambienteMotion?{ambiente:ambienteMotion}:{})});
    return {ui,alvos,instancias,chamadas,falhar:()=>{falharUpdate=true;falharDestroy=true}};
}
function resultado(chave) {return {estado:'atual',inicio:'2025-12-01',fim:'2026-11-09',consultadoEm:Date.parse('2026-11-09T12:00:00Z'),observacao:{data:'2026-09-01',valor:'1.23'},dados:[{data:'01/08/2026',valor:chave==='ipca'?'-0.12':'1.23'},{data:'01/09/2026',valor:'0.00'}]}}
const concluir=()=>new Promise(resolve=>setImmediate(resolve));
test('Gráfico: degraus, colunas negativas e zero, defaults e tema sem consulta/recriação',async()=>{
    const a=ambiente();await a.ui.carregar();await concluir();assert.equal(a.instancias.length,1);
    assert.equal(a.instancias[0].data.datasets[0].stepped,'after');assert.equal(a.instancias[0].options.animation,false);
    a.alvos['selecao-indicador'].value='ipca';a.alvos['selecao-indicador'].emitir();await concluir();
    assert.equal(a.instancias.length,1);assert.equal(a.instancias[0].config.type,'bar');assert.equal(a.instancias[0].options.scales.y.beginAtZero,true);
    assert.deepEqual(a.instancias[0].data.datasets[0].data.map(p=>p.y),[-.12,0]);
    for(const [k,p]of [['ipca12','24'],['dolar','3']]){a.alvos['selecao-indicador'].value=k;a.alvos['selecao-indicador'].emitir();await concluir();assert.equal(a.alvos['periodo-indicador'].value,p)}
    const n=a.chamadas.length;a.ui.atualizarAparencia();assert.equal(a.chamadas.length,n);assert.equal(a.instancias.length,1);
    const configuracao=a.instancias[0];
    assert.match(configuracao.options.plugins.tooltip.callbacks.label({parsed:{y:5.5146}}),/5,5146 R\$\/US\$/);
    assert.equal(configuracao.data.datasets[0].segment.borderColor({p0:{parsed:{x:0}},p1:{parsed:{x:5*86400000}}}),'transparent');
    const eixo={chart:{width:320}};configuracao.options.scales.x.afterBuildTicks(eixo);
    assert.deepEqual(eixo.ticks.map(t=>t.value),configuracao.data.datasets[0].data.map(p=>p.x));
});
test('Gráfico: resposta antiga não substitui seleção mais recente',async()=>{
    let liberar;
    const a=ambiente((k,m)=>k==='selic'&&m?new Promise(r=>{liberar=r}):resultado(k));await a.ui.carregar();
    a.alvos['selecao-indicador'].value='dolar';a.alvos['selecao-indicador'].emitir();await concluir();
    liberar(resultado('selic'));await concluir();assert.equal(a.instancias.length,1);assert.equal(a.instancias[0].data.datasets[0].label,'Dólar PTAX venda');
});
test('Gráfico: falhas de update e destroy mantêm alternativa textual',async()=>{
    const a=ambiente();await a.ui.carregar();await concluir();a.falhar();a.ui.atualizarAparencia();
    assert.match(a.alvos['estado-historico-indicador'].textContent,/Gráfico indisponível/);assert.equal(a.alvos['valores-historico-indicador'].filhos.length,2);assert.equal(a.alvos['grafico-indicadores'].hidden,true);
});
test('Gráfico: vazio, erro e dados anteriores não são confundidos',async()=>{
    for(const estado of ['vazio','indisponivel','anterior']){
        const a=ambiente((k,m)=>m?{...resultado(k),estado:estado==='vazio'?'atual':estado,dados:estado==='vazio'?[]:resultado(k).dados}:resultado(k));await a.ui.carregar();await concluir();
        assert.match(a.alvos['estado-historico-indicador'].textContent,estado==='vazio'?/Nenhuma observação/:estado==='indisponivel'?/Não foi possível consultar/:/Dados anteriores/);
    }
});
function motion() {
    let id=0;const quadros=new Map(),media={matches:false,addEventListener(_tipo,fn){this.alterar=fn}};
    return {media,quadros,matchMedia:()=>media,requestAnimationFrame:fn=>{quadros.set(++id,fn);return id},cancelAnimationFrame:i=>quadros.delete(i),passo(tempo){const lista=[...quadros.values()];quadros.clear();lista.forEach(fn=>fn(tempo))}};
}
test('Motion: recorte horizontal intermediário preserva geometria, patamares e canvas',async()=>{
    const m=motion(),a=ambiente(undefined,m);await a.ui.carregar();await concluir();const chart=a.instancias[0];
    assert.equal(m.quadros.size,1);m.passo(0);m.passo(300);
    assert.ok(chart.recortes.some(w=>w>0&&w<200));assert.equal(chart.saldo,0);assert.equal(chart.data.datasets[0].stepped,'after');
    assert.deepEqual(chart.data.datasets[0].data.map(p=>p.y),[1.23,0]);m.passo(600);assert.equal(m.quadros.size,0);
});
test('Motion: colunas usam baseline zero nativa, inclusive valores negativos',async()=>{
    const m=motion(),a=ambiente(undefined,m);await a.ui.carregar();await concluir();
    a.alvos['selecao-indicador'].value='ipca';a.alvos['selecao-indicador'].emitir();await concluir();const chart=a.instancias[0];
    assert.equal(a.instancias.length,1);assert.equal(m.quadros.size,0);assert.equal(chart.options.animation.duration,600);
    assert.equal(chart.options.animations.y.from({chart}),80);assert.deepEqual(chart.data.datasets[0].data.map(p=>p.y),[-.12,0]);
});
test('Motion: tema, resultados idênticos e conclusão cancelam quadros sem nova formação',async()=>{
    const m=motion(),a=ambiente(undefined,m);await a.ui.carregar();await concluir();assert.equal(m.quadros.size,1);
    a.ui.atualizarAparencia();assert.equal(m.quadros.size,0);const n=a.chamadas.length;
    a.ui.atualizarAparencia();assert.equal(a.chamadas.length,n);await a.ui.carregar();await concluir();assert.equal(m.quadros.size,0);
    a.alvos['periodo-indicador'].value='3';a.alvos['periodo-indicador'].emitir();await concluir();assert.equal(m.quadros.size,1);
    a.ui.concluirAnimacao();assert.equal(m.quadros.size,0);assert.equal(a.instancias.length,1);
});
test('Motion: preferência reduzida inicial e alterações ao vivo não deixam animações pendentes',async()=>{
    const m=motion(),a=ambiente(undefined,m);m.media.matches=true;await a.ui.carregar();await concluir();assert.equal(m.quadros.size,0);
    m.media.matches=false;m.media.alterar();a.alvos['periodo-indicador'].value='3';a.alvos['periodo-indicador'].emitir();await concluir();assert.equal(m.quadros.size,1);
    m.media.matches=true;m.media.alterar();assert.equal(m.quadros.size,0);assert.equal(a.instancias[0].options.animation,false);
    a.alvos['selecao-indicador'].value='ipca';a.alvos['selecao-indicador'].emitir();await concluir();assert.equal(a.instancias[0].options.animation,false);
});
test('Motion: dados alterados animam; trocas rápidas mantêm somente uma formação',async()=>{
    let valor='1.23';const m=motion(),a=ambiente(k=>{const r=resultado(k);r.dados[0].valor=valor;return r},m);
    await a.ui.carregar();await concluir();m.passo(0);m.passo(600);assert.equal(m.quadros.size,0);
    valor='1.24';await a.ui.carregar();await concluir();assert.equal(m.quadros.size,1);
    for(const k of ['dolar','selic','ipca12']){a.alvos['selecao-indicador'].value=k;a.alvos['selecao-indicador'].emitir()}
    await concluir();assert.equal(m.quadros.size,1);assert.equal(a.instancias.length,1);assert.equal(a.instancias[0].data.datasets[0].label,'IPCA acumulado em 12 meses');
});
