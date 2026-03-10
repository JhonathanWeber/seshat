/**
 * @seshat/shared - Tipos, utilitários e configuração compartilhados
 */

// Environment loader
export { ENV_LOADED } from "./env.js";

// Types
export * from "./types/index.js";
export * from "./types/interfaces.js";

// Utils
export * from "./utils/index.js";

// Config
export {
  Config,
  config,
  defaultConfig,
  type ServerConfig,
  SeshatConfig,
  defaultSeshatConfig,
  configExamples,
  getConfigDir,
  getConfigPath,
  configExists,
  loadConfig,
  saveConfig,
  initConfig,
  getConfigForEnv
} from "./config/index.js";
