// prisma/seeds/catalogoSeed.js

export async function seedCatalogos(prisma) {
  console.log('Semeando catalogos globais...');

  const racas = ['Nelore', 'Angus', 'Anelorado', 'Brahman', 'Hereford', 'Senepol', 'Mestiço', 'Guzerá', 'Tabapuã', 'Gir'];
  const sistemas = ['Cria', 'Recria', 'Engorda'];
  const regimes = ['Pasto', 'Confinamento', 'Semi-confinamento'];
  const manejosRebanho = ['Vacinação', 'Pesagem', 'Vermifugação'];
  const manejosPasto = ['Roçagem', 'Adubação', 'Reforma de Cerca', 'Limpeza', 'Calagem', 'Dessecação', 'Plantio de Forrageira', 'Irrigação'];

  const catalogos = {};

  // Raças
  catalogos.racas = [];
  for (const raca of racas) {
    const item = await prisma.raca.upsert({
      where: { nome: raca },
      update: {},
      create: { nome: raca },
    });
    catalogos.racas.push(item);
  }

  // Sistemas de Produção
  catalogos.sistemasProducao = [];
  for (const sistema of sistemas) {
    const item = await prisma.sistemaProducao.upsert({
      where: { nome: sistema },
      update: {},
      create: { nome: sistema },
    });
    catalogos.sistemasProducao.push(item);
  }

  // Regimes Alimentares
  catalogos.regimesAlimentares = [];
  for (const regime of regimes) {
    const item = await prisma.regimeAlimentar.upsert({
      where: { nome: regime },
      update: {},
      create: { nome: regime },
    });
    catalogos.regimesAlimentares.push(item);
  }

  // Manejos Rebanho
  catalogos.manejosRebanho = [];
  for (const manejo of manejosRebanho) {
    const item = await prisma.tipoManejoRebanho.upsert({
      where: { nome: manejo },
      update: {},
      create: { nome: manejo },
    });
    catalogos.manejosRebanho.push(item);
  }

  // Manejos Pasto
  catalogos.manejosPasto = [];
  for (const manejo of manejosPasto) {
    const item = await prisma.tipoManejoPasto.upsert({
      where: { nome: manejo },
      update: {},
      create: { nome: manejo },
    });
    catalogos.manejosPasto.push(item);
  }

  console.log('  Catalogos globais registrados');

  return catalogos;
}
