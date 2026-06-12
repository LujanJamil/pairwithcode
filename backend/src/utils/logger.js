"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const environment_1 = require("./environment");
const isDev = environment_1.config.nodeEnv === 'development';
exports.logger = (0, pino_1.default)({
    level: isDev ? 'debug' : 'info',
    transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        }
        : undefined,
    timestamp: !isDev ? pino_1.default.stdTimeFunctions.isoTime : undefined
});
//# sourceMappingURL=logger.js.map