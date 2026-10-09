'use strict';

// A baixa guarda o aviso junto dos itens, no mesmo INSERT. Se a fila estiver
// indisponível, o Kuru retoma esse aviso sem repetir a baixa nem o envio.
function anexarAviso(baixa, bloco) {
  baixa.itens[0] = { ...baixa.itens[0], aviso_whatsapp: {
    origem: 'expedicao-celular', pendente: true, bloco,
  } };
  return baixa;
}

function registroNaFila(baixa) {
  const aviso = baixa.itens?.[0]?.aviso_whatsapp;
  const id = String(baixa.id ?? '');
  if (aviso?.origem !== 'expedicao-celular' || !aviso.pendente || !/^[1-9]\d*$/.test(id)) return null;
  if (BigInt(id) > 9223372036854775807n || !aviso.bloco?.itens?.length || !baixa.cliente) return null;
  // IDs automáticos da fila são positivos. O negativo do ID da baixa reserva
  // uma chave estável para este aviso, inclusive entre servidor e vários PCs.
  return {
    id: '-' + id, tipo: 'expedicao', cliente: baixa.cliente,
    itens: [aviso.bloco], ultimo_evento_em: baixa.evento_em,
  };
}

function criarFilaExpedicaoCelular(db) {
  async function enfileirar(baixa) {
    const registro = registroNaFila(baixa);
    if (!registro) return false;
    try {
      await db.inserir('pcp_avisos_whatsapp', registro);
    } catch (err) {
      // A chave primária garante um aviso só. Nunca faz upsert, que poderia
      // devolver um aviso já enviado para o estado pendente.
      if (err.codigo !== '23505') throw err;
    }
    const itens = baixa.itens.map((item, i) => i ? item : {
      ...item, aviso_whatsapp: { ...item.aviso_whatsapp, pendente: false },
    });
    await db.atualizar('expedicao_baixas', { id: baixa.id }, { itens });
    return true;
  }

  async function recuperar(limite = 50) {
    const { linhas } = await db.selecionar('expedicao_baixas', {
      colunas: ['id', 'cliente', 'itens', 'evento_em'],
      filtros: [
        { coluna: 'itens->0->aviso_whatsapp->>origem', operador: 'igual', valor: 'expedicao-celular' },
        { coluna: 'itens->0->aviso_whatsapp->>pendente', operador: 'igual', valor: 'true' },
      ],
      ordem: [{ coluna: 'id' }], limite,
    });
    let enfileirados = 0;
    for (const baixa of linhas) {
      try { if (await enfileirar(baixa)) enfileirados++; }
      catch (err) { console.warn('[expedicao-whatsapp] aviso permanece pendente:', err.codigo || 'rede'); }
    }
    return enfileirados;
  }

  return { enfileirar, recuperar };
}

module.exports = { anexarAviso, registroNaFila, criarFilaExpedicaoCelular };
