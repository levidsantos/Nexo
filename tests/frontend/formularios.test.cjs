'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const helpers = require('../../frontend/js/ui/formularios.js');
const { mostrarErro, limparErros, limparErroCampo, focarPrimeiroErro } = helpers;

// Doubles apenas para as operações usadas pelos helpers; sem emulação de layout.
function criarFormulario(ids) {
    const mensagens = new Map(ids.map((id) => [`erro-${id}`, { textContent: '' }]));
    const consultas = [], focos = [];
    const ownerDocument = {
        getElementById(id) { consultas.push(id); return mensagens.get(id) ?? null; }
    };
    const campos = ids.map((id) => {
        const classes = new Set(['campo-existente']);
        const atributos = new Map([['aria-describedby', `ajuda-${id} erro-${id}`]]);
        return { id, ownerDocument, value: 'valor preservado', hidden: false,
            classList: {
                add: (classe) => classes.add(classe),
                remove: (classe) => classes.delete(classe),
                contains: (classe) => classes.has(classe)
            },
            setAttribute: (nome, valor) => atributos.set(nome, valor),
            removeAttribute: (nome) => atributos.delete(nome),
            getAttribute: (nome) => atributos.get(nome) ?? null,
            focus: () => focos.push(id)
        };
    });
    const formulario = {
        querySelectorAll(seletor) {
            if (seletor === '.erro-campo') return [...mensagens.values()];
            assert.equal(seletor, '.invalido');
            return campos.filter((campo) => campo.classList.contains('invalido'));
        },
        querySelector(seletor) {
            assert.equal(seletor, '.invalido');
            return campos.find((campo) => campo.classList.contains('invalido')) ?? null;
        }
    };
    return { campos, mensagens, consultas, focos, formulario };
}

test('API preserva nomes e quantidade de parâmetros dos quatro helpers', () => {
    assert.deepEqual(Object.keys(helpers).sort(), ['mostrarErro', 'limparErros', 'limparErroCampo', 'focarPrimeiroErro', 'criarConfirmacaoFinanceira'].sort());
    for (const [nome, quantidade] of [['mostrarErro', 2], ['limparErros', 1], ['limparErroCampo', 1], ['focarPrimeiroErro', 1]]) {
        assert.equal(helpers[nome].name, nome);
        assert.equal(helpers[nome].length, quantidade);
    }
});

test('mostrarErro usa o documento do campo e a convenção de ID, preservando a mensagem literal', () => {
    const app = criarFormulario(['nome']), campo = app.campos[0];
    const mensagem = 'Informe um nome. <strong>Texto literal</strong>';
    assert.equal(mostrarErro(campo, mensagem), undefined);
    assert.deepEqual(app.consultas, ['erro-nome']);
    assert.equal(app.mensagens.get('erro-nome').textContent, mensagem);
    assert.equal(campo.classList.contains('invalido'), true);
    assert.equal(campo.getAttribute('aria-invalid'), 'true');
    assert.equal(campo.getAttribute('aria-describedby'), 'ajuda-nome erro-nome');
    assert.equal(campo.value, 'valor preservado');
    assert.deepEqual(app.focos, []);
});

test('novo erro substitui a mensagem do mesmo campo sem alterar outros campos', () => {
    const app = criarFormulario(['nome', 'valor']);
    mostrarErro(app.campos[0], 'Anterior');
    mostrarErro(app.campos[0], 'Nova mensagem');
    assert.equal(app.mensagens.get('erro-nome').textContent, 'Nova mensagem');
    assert.equal(app.mensagens.get('erro-valor').textContent, '');
    assert.equal(app.campos[1].getAttribute('aria-invalid'), null);
});

test('limparErroCampo remove somente o erro solicitado e conserva classes e descrições existentes', () => {
    const app = criarFormulario(['nome', 'valor']);
    app.campos.forEach((campo) => mostrarErro(campo, `Erro ${campo.id}`));
    assert.equal(limparErroCampo(app.campos[0]), undefined);
    assert.equal(app.mensagens.get('erro-nome').textContent, '');
    assert.equal(app.campos[0].classList.contains('invalido'), false);
    assert.equal(app.campos[0].classList.contains('campo-existente'), true);
    assert.equal(app.campos[0].getAttribute('aria-invalid'), null);
    assert.equal(app.campos[0].getAttribute('aria-describedby'), 'ajuda-nome erro-nome');
    assert.equal(app.mensagens.get('erro-valor').textContent, 'Erro valor');
    assert.equal(app.campos[1].getAttribute('aria-invalid'), 'true');
    assert.deepEqual(app.focos, []);
});

test('limparErros limpa todas as mensagens e campos inválidos somente dentro do formulário recebido', () => {
    const app = criarFormulario(['nome', 'valor']), outro = criarFormulario(['conta']);
    [...app.campos, ...outro.campos].forEach((campo) => mostrarErro(campo, 'Erro'));
    assert.equal(limparErros(app.formulario), undefined);
    for (const campo of app.campos) {
        assert.equal(app.mensagens.get(`erro-${campo.id}`).textContent, '');
        assert.equal(campo.classList.contains('invalido'), false);
        assert.equal(campo.getAttribute('aria-invalid'), null);
        assert.equal(campo.value, 'valor preservado');
    }
    assert.equal(outro.mensagens.get('erro-conta').textContent, 'Erro');
    assert.equal(outro.campos[0].getAttribute('aria-invalid'), 'true');
    assert.deepEqual(app.focos, []);
});

test('limparErros também limpa mensagens sem classe invalido no campo', () => {
    const app = criarFormulario(['nome']);
    app.mensagens.get('erro-nome').textContent = 'Mensagem existente';
    limparErros(app.formulario);
    assert.equal(app.mensagens.get('erro-nome').textContent, '');
});

test('limpeza sem erros e repetida preserva o comportamento e retorno undefined', () => {
    const app = criarFormulario(['nome']);
    for (let i = 0; i < 2; i++) {
        assert.equal(limparErros(app.formulario), undefined);
        assert.equal(limparErroCampo(app.campos[0]), undefined);
    }
    assert.equal(limparErros(criarFormulario([]).formulario), undefined);
    assert.equal(app.campos[0].classList.contains('campo-existente'), true);
    assert.equal(app.campos[0].getAttribute('aria-invalid'), null);
});

test('focarPrimeiroErro respeita a ordem do formulário, não a ordem de registro dos erros', () => {
    const app = criarFormulario(['nome', 'valor', 'conta']);
    mostrarErro(app.campos[2], 'Erro conta');
    mostrarErro(app.campos[1], 'Erro valor');
    assert.equal(focarPrimeiroErro(app.formulario), undefined);
    assert.deepEqual(app.focos, ['valor']);
    assert.equal(app.mensagens.get('erro-valor').textContent, 'Erro valor');
});

test('focarPrimeiroErro sem campo inválido conserva a precondição existente (TypeError)', () => {
    const app = criarFormulario(['nome']);
    assert.throws(() => focarPrimeiroErro(app.formulario), TypeError);
    assert.deepEqual(app.focos, []);
});

test('campos condicionais/ocultos não recebem filtragem adicional dos helpers', () => {
    const app = criarFormulario(['classificacao', 'valor']);
    app.campos[0].hidden = true;
    mostrarErro(app.campos[0], 'Selecione uma classificação válida para a despesa.');
    mostrarErro(app.campos[1], 'Informe um valor.');
    focarPrimeiroErro(app.formulario);
    // Registra a tentativa: um double não decide se o navegador pode focar um elemento oculto.
    assert.deepEqual(app.focos, ['classificacao']);
    limparErros(app.formulario);
    assert.equal(app.mensagens.get('erro-classificacao').textContent, '');
    assert.equal(app.campos[0].getAttribute('aria-invalid'), null);
    assert.equal(app.campos[0].hidden, true);
});

test('documentos independentes com os mesmos IDs não compartilham mensagens', () => {
    const primeiro = criarFormulario(['nome']), segundo = criarFormulario(['nome']);
    mostrarErro(primeiro.campos[0], 'Primeiro');
    mostrarErro(segundo.campos[0], 'Segundo');
    limparErroCampo(primeiro.campos[0]);
    assert.equal(segundo.mensagens.get('erro-nome').textContent, 'Segundo');
});

test('mensagem ausente conserva a precondição da estrutura HTML, sem mutações parciais no campo', () => {
    const app = criarFormulario(['nome']);
    app.mensagens.clear();
    assert.throws(() => mostrarErro(app.campos[0], 'Erro'), TypeError);
    assert.throws(() => limparErroCampo(app.campos[0]), TypeError);
    assert.equal(app.campos[0].getAttribute('aria-invalid'), null);
});

test('importação não acessa DOM, armazenamento, listeners ou temporizadores', () => {
    const url = pathToFileURL(resolve(__dirname, '../../frontend/js/ui/formularios.js')).href;
    execFileSync(process.execPath, ['--input-type=module', '-e', `
        for (const nome of ['document', 'window', 'localStorage', 'addEventListener', 'setTimeout', 'requestAnimationFrame']) {
            Object.defineProperty(globalThis, nome, { get() { throw new Error('Acesso durante import: ' + nome); } });
        }
        const modulo = await import(${JSON.stringify(url)});
        if (Object.keys(modulo).length !== 5) throw new Error('API inesperada');
    `], { stdio: 'pipe' });
});

for (const resultado of [true, false, 'rejeicao']) {
    test(`confirmação financeira controlada: ${resultado}, sem duplo envio e com liberação`, async () => {
        let resolver, rejeitar, chamadas = 0;
        const espera = new Promise((resolve, reject) => { resolver = resolve; rejeitar = reject; });
        const mensagens = [], botao = { disabled: false };
        const confirmacao = helpers.criarConfirmacaoFinanceira((...args) => mensagens.push(args));
        const acao = () => { chamadas++; return espera; };
        const primeira = confirmacao.confirmar(acao, [], botao);
        assert.equal(confirmacao.estaPendente(), true);
        assert.equal(botao.disabled, true);
        assert.equal(await confirmacao.confirmar(acao, [], botao), false);
        assert.equal(chamadas, 1);
        if (resultado === 'rejeicao') rejeitar(new Error('Falha assíncrona')); else resolver(resultado);
        assert.equal(await primeira, resultado === true);
        assert.equal(confirmacao.estaPendente(), false);
        assert.equal(botao.disabled, false);
        assert.equal(mensagens.length, resultado === 'rejeicao' ? 1 : 0);
        assert.equal(await confirmacao.confirmar(async () => true, [], botao), true);
    });
}
