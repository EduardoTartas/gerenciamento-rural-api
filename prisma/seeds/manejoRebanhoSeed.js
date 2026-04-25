// prisma/seeds/manejoRebanhoSeed.js

import { faker } from '@faker-js/faker/locale/pt_BR';

const TIPOS_MANEJO = ['Vacinação', 'Pesagem', 'Vermifugação'];

const VACINAS = [
  'Aftosa - Boehringer', 'Carbúnculo - Ouro Fino', 'Brucelose - B19',
  'Raiva - Biovet', 'Clostridioses - MSD', 'IBR/BVD - Zoetis',
  'Leptospirose - Ourofino', 'Tristeza Parasitária - EMBRAPA',
];

const VERMIFUGOS = [
  'Ivermectina 1%', 'Doramectina 1%', 'Moxidectina 1%',
  'Albendazol 10%', 'Levamisol 7.5%', 'Fenbendazol 10%',
];

const OBSERVACOES = {
  'Vacinação': [
    'Campanha estadual de vacinação.',
    'Vacinação obrigatória conforme IDARON.',
    'Revacinação de lote após 30 dias.',
    'Vacinação de bezerros recém-desmamados.',
  ],
  'Pesagem': [
    'Pesagem mensal de controle.',
    'Pesagem para acompanhamento de ganho de peso.',
    'Pesagem pré-abate.',
    'Pesagem de avaliação corporal.',
    'Lote pronto para abate em 30 dias.',
  ],
  'Vermifugação': [
    'Protocolo semestral de vermifugação.',
    'Aplicação preventiva no início das chuvas.',
    'Tratamento após detecção de verminose.',
    'Vermifugação de bezerros ao desmame.',
  ],
};

/**
 * Seed de manejos de rebanho (vacinações, pesagens, vermifugações).
 * Cria N manejos por rebanho com dados aleatórios.
 */
export async function seedManejoRebanhos(prisma, rebanhos, catalogos, quantidadePorRebanho = 3) {
  console.log('Semeando manejos de rebanho...');

  let count = 0;

  for (const rebanho of rebanhos) {
    for (let i = 0; i < quantidadePorRebanho; i++) {
      const tipoManejoObj = faker.helpers.arrayElement(catalogos.manejosRebanho);
      const dataAtividade = faker.date.recent({ days: 120 });
      // Fallback pra observacoes caso não tenha mapeado pelo nome exatamente
      const observacoes = OBSERVACOES[tipoManejoObj.nome] ? faker.helpers.arrayElement(OBSERVACOES[tipoManejoObj.nome]) : 'Manejo de rotina.';

      let medicamentoVacina = null;
      let pesoRegistrado = null;

      switch (tipoManejoObj.nome) {
        case 'Vacinação':
          medicamentoVacina = faker.helpers.arrayElement(VACINAS);
          break;
        case 'Vermifugação':
          medicamentoVacina = faker.helpers.arrayElement(VERMIFUGOS);
          break;
        case 'Pesagem':
          pesoRegistrado = faker.number.float({ min: 120, max: 550, fractionDigits: 1 });
          break;
      }

      await prisma.manejoRebanho.create({
        data: {
          rebanhoId: rebanho.id,
          tipoManejoId: tipoManejoObj.id,
          medicamentoVacina,
          pesoRegistrado,
          dataAtividade,
          observacoes,
        },
      });

      count++;
    }
  }

  console.log(`  - ${count} manejo(s) de rebanho registrado(s)`);
}
