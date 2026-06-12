"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = void 0;
const auth_1 = __importDefault(require("./auth"));
const messages_1 = __importDefault(require("./messages"));
const sessions_1 = __importDefault(require("./sessions"));
const analytics_1 = __importDefault(require("./analytics"));
const code_review_1 = __importDefault(require("./code-review"));
const recordings_1 = __importDefault(require("./recordings"));
const debug_1 = __importDefault(require("./debug"));
const encryption_1 = __importDefault(require("./encryption"));
const enterprise_1 = __importDefault(require("./enterprise"));
const logger_1 = require("../utils/logger");
const setupRoutes = (app, pool) => {
    logger_1.logger.info('Setting up routes');
    app.use('/api/auth', auth_1.default);
    app.use('/api/messages', messages_1.default);
    app.use('/api/sessions', sessions_1.default);
    app.use('/api/analytics', analytics_1.default);
    app.use('/api/code-review', code_review_1.default);
    app.use('/api/recordings', recordings_1.default);
    app.use('/api/debug', debug_1.default);
    app.use('/api/keys', encryption_1.default);
    // Enterprise features
    app.use('/api/enterprise', (0, enterprise_1.default)(pool));
    app.use('/api/rbac', (0, enterprise_1.default)(pool));
    app.use('/api/audit', (0, enterprise_1.default)(pool));
    logger_1.logger.info('Routes configured successfully');
};
exports.setupRoutes = setupRoutes;
//# sourceMappingURL=index.js.map