// src/repository/index.js
// Barrel file — exporta instâncias singleton de cada Repository.
// Evita instâncias duplicadas quando múltiplos Services compartilham o mesmo Repository.

import UserRepository from './UserRepository.js';
import PropriedadeRepository from './PropriedadeRepository.js';
import PastoRepository from './PastoRepository.js';
import RebanhoRepository from './RebanhoRepository.js';
import CatalogoRepository from './CatalogoRepository.js';
import ManejoPastoRepository from './ManejoPastoRepository.js';
import ManejoRebanhoRepository from './ManejoRebanhoRepository.js';
import MovimentacaoRepository from './MovimentacaoRepository.js';
import UploadRepository from './UploadRepository.js';
import InsumoRepository from './InsumoRepository.js';
import MovimentacaoInsumoRepository from './MovimentacaoInsumoRepository.js';
import RegimeConsumoInsumoRepository from './RegimeConsumoInsumoRepository.js';

export const userRepository = new UserRepository();
export const propriedadeRepository = new PropriedadeRepository();
export const pastoRepository = new PastoRepository();
export const rebanhoRepository = new RebanhoRepository();
export const catalogoRepository = new CatalogoRepository();
export const manejoPastoRepository = new ManejoPastoRepository();
export const manejoRebanhoRepository = new ManejoRebanhoRepository();
export const movimentacaoRepository = new MovimentacaoRepository();
export const uploadRepository = new UploadRepository();
export const insumoRepository = new InsumoRepository();
export const movimentacaoInsumoRepository = new MovimentacaoInsumoRepository();
export const regimeConsumoInsumoRepository = new RegimeConsumoInsumoRepository();
