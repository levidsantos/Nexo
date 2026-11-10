const { test } = require('node:test');
const assert = require('node:assert/strict');
const { INDICADORES, normalizarIndicador, intervaloIndicador } = require('../../frontend/js/dominio/indicadores-economicos.js');
const { consultarIndicador } = require('../../frontend/js/dados/api-bcb.js');
const { criarCacheIndicadores } = require('../../frontend/js/dados/cache-indicadores.js');
const { criarIndicadoresEconomicos } = require('../../frontend/js/funcionalidades/indicadores-economicos.js');
const bruto = [{ data: '01/09/2026', valor: '-0.12' }];
const pontos = [{ data: '2026-09-01', valor: '-0.12' }];
test('Indicadores: códigos e TTLs oficiais configurados separadamente', () => {
    assert.deepEqual(Object.values(INDICADORES).map(i => i.codigo), [432, 433, 13522, 1]);
    assert.equal(INDICADORES.selic.ttl, 21600000);
    assert.equal(INDICADORES.ipca.ttl, 86400000);
});
test('Indicadores: normalização preserva negativo, zero, quatro casas e entradas', () => {
    assert.deepEqual(normalizarIndicador(bruto, INDICADORES.ipca, '2025-01-01', '2026-11-09'), pontos);
    assert.equal(bruto[0].data, '01/09/2026');
    for (const valor of ['0', '5.5146']) assert.equal(normalizarIndicador([{data:'09/11/2026',valor}], INDICADORES.dolar,'2026-01-01','2026-11-09')[0].valor, valor);
});
for (const invalido of [null, {}, [{data:'31/02/2026',valor:'1'}], [{data:'01/09/2026',valor:'1,2'}], [{data:'01/12/2026',valor:'1'}], [...bruto,...bruto]]) {
    test(`Indicadores: rejeita payload inválido ${JSON.stringify(invalido)}`, () => assert.throws(() => normalizarIndicador(invalido, INDICADORES.ipca, '2025-01-01','2026-11-09')));
}
test('API: usa domínio oficial, intervalo explícito e não preenche observações', async () => {
    let url;
    const dados = await consultarIndicador('ipca','2025-01-01','2026-11-09',{solicitar:async u => {url=u;return {ok:true,json:async()=>bruto}}});
    assert.deepEqual(dados,pontos); assert.match(url,/^https:\/\/api.bcb.gov.br\/dados\/serie\/bcdata.sgs.433\/dados\?/);
    assert.match(url,/dataFinal=09%2F11%2F2026/); assert.doesNotMatch(url,/ultimos/);
});
test('API: vazio legítimo e 404 de ausência são vazios; outros erros falham', async () => {
    assert.deepEqual(await consultarIndicador('ipca','2026-01-01','2026-11-09',{solicitar:async()=>({ok:true,json:async()=>[]})}),[]);
    assert.deepEqual(await consultarIndicador('dolar','2026-11-08','2026-11-08',{solicitar:async()=>({status:404,json:async()=>({erro:{detail:'Value(s) not found'}})})}),[]);
    for (const status of [404,406,500]) await assert.rejects(consultarIndicador('ipca','2026-01-01','2026-11-09',{solicitar:async()=>({status,ok:false,json:async()=>({})})}));
});
test('API: timeout cancela a consulta e erro de JSON não é sucesso', async () => {
    await assert.rejects(consultarIndicador('ipca','2026-01-01','2026-11-09',{timeout:5,solicitar:(_, {signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('abort'))))}),/demorou/);
    await assert.rejects(consultarIndicador('ipca','2026-01-01','2026-11-09',{solicitar:async()=>({ok:true,json:async()=>{throw new Error('JSON')}})}),/JSON/);
});
function ambiente() {
    let tempo = Date.parse('2026-11-09T12:00:00Z'), falhar = false, chamadas = 0;
    const itens = new Map();
    const opcoes = { hoje:()=> '2026-11-09', agora:()=>tempo, armazenamento:()=>({getItem:k=>itens.get(k)??null,setItem:(k,v)=>itens.set(k,v)}), consultar:async()=>{chamadas++; if(falhar)throw new Error('rede'); return pontos} };
    return {opcoes,itens,expirar:()=>{tempo+=86400001},falhar:()=>{falhar=true},chamadas:()=>chamadas};
}
test('Cache: consulta deduplicada, TTL e reutilização entre instâncias', async () => {
    const a=ambiente(), cache=criarCacheIndicadores(a.opcoes);
    const [r,s]=await Promise.all([cache.obter('ipca'),cache.obter('ipca')]);
    assert.equal(a.chamadas(),1);assert.equal(r.estado,'atual');assert.deepEqual(r,s);
    await cache.obter('ipca');await criarCacheIndicadores(a.opcoes).obter('ipca');assert.equal(a.chamadas(),1);
    a.expirar();await cache.obter('ipca');assert.equal(a.chamadas(),2);
});
test('Cache: expiração com falha mantém último bom identificado', async () => {
    const a=ambiente(),cache=criarCacheIndicadores(a.opcoes);const original=await cache.obter('ipca');a.expirar();a.falhar();
    const r=await cache.obter('ipca');assert.equal(r.estado,'anterior');assert.deepEqual(r.observacao,original.observacao);
});
test('Cache: corrompido ou armazenamento bloqueado não impede consulta', async () => {
    const a=ambiente();a.itens.set('nexo-indicadores:v1:ipca','{');assert.equal((await criarCacheIndicadores(a.opcoes).obter('ipca')).estado,'atual');
    a.opcoes.armazenamento=()=>{throw new Error('bloqueado')};const cache=criarCacheIndicadores(a.opcoes);await cache.obter('ipca');await cache.obter('ipca');assert.equal(a.chamadas(),2);
});
test('Cache: sem dados válidos não fabrica zero e preserva chaves pessoais', async () => {
    const a=ambiente();a.itens.set('contas','original');a.falhar();assert.equal((await criarCacheIndicadores(a.opcoes).obter('ipca')).estado,'indisponivel');assert.equal(a.itens.get('contas'),'original');
    a.opcoes.consultar=async()=>[];assert.equal((await criarCacheIndicadores(a.opcoes).obter('ipca')).estado,'indisponivel');
    assert.deepEqual(intervaloIndicador('2026-11-09'),{inicio:'2025-01-01',fim:'2026-11-09'});
});
test('Cache: falha em uma série não bloqueia as demais', async () => {
    const a=ambiente();a.opcoes.consultar=async chave=>{if(chave==='selic')throw new Error('rede');return pontos};
    const cache=criarCacheIndicadores(a.opcoes);
    assert.equal((await cache.obter('selic')).estado,'indisponivel');
    assert.equal((await cache.obter('ipca')).estado,'atual');
});
test('Cache: metadados inválidos e observação futura são ignorados', async () => {
    for(const alteracao of [{versao:2},{codigo:1},{consultadoEm:Infinity},{fim:'2026-12-01'},{dados:[{data:'01/12/2026',valor:'1'}]}]) {
        const a=ambiente();await criarCacheIndicadores(a.opcoes).obter('ipca');
        const chave='nexo-indicadores:v1:ipca';a.itens.set(chave,JSON.stringify({...JSON.parse(a.itens.get(chave)),...alteracao}));
        await criarCacheIndicadores(a.opcoes).obter('ipca');assert.equal(a.chamadas(),2);
    }
});
test('Apresentação: referências independentes, quatro casas, falha parcial e cache anterior', async () => {
    const alvos=Object.fromEntries(Object.keys(INDICADORES).map(chave=>[`indicador-${chave}`,{filhos:[],replaceChildren(){this.filhos=[]},appendChild(e){this.filhos.push(e)}}]));
    const document={getElementById:id=>alvos[id],createElement:()=>({})};
    const ui=criarIndicadoresEconomicos({document,cache:{obter:async chave=>chave==='selic'?{estado:'indisponivel'}:{estado:chave==='ipca12'?'anterior':'atual',observacao:{data:chave==='dolar'?'2026-11-09':chave==='ipca'?'2026-09-01':'2026-08-01',valor:chave==='dolar'?'5.5146':'0.00'},consultadoEm:Date.parse('2026-11-09T12:00:00Z')}}});
    await ui.carregar();const texto=chave=>alvos[`indicador-${chave}`].filhos.map(e=>e.textContent).join(' ');
    assert.match(texto('selic'),/indisponíveis/);assert.match(texto('dolar'),/5,5146/);
    assert.match(texto('ipca'),/setembro de 2026/);assert.match(texto('ipca12'),/agosto de 2026/);assert.match(texto('ipca12'),/Dados anteriores/);
});
