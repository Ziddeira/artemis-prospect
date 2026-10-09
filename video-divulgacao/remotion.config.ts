// Configuração do Remotion (vale para o "npm run dev" e o "npm run render").
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
// Qualidade do MP4: quanto menor o número, melhor a imagem (e maior o arquivo).
Config.setCrf(18);
Config.setOverwriteOutput(true);
