"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const joi_1 = __importDefault(require("joi"));
dotenv_1.default.config();
const schema = joi_1.default.object({
    NODE_ENV: joi_1.default.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: joi_1.default.number().port().default(3000),
    CORS_ORIGIN: joi_1.default.string().default('http://localhost:3000'),
    DB_PORT: joi_1.default.number().port().default(5432),
    DB_USER: joi_1.default.string().required(),
    DB_PASSWORD: joi_1.default.string().required(),
    DB_NAME: joi_1.default.string().required(),
    DB_SSL: joi_1.default.boolean().default(false),
    DB_POOL_MIN: joi_1.default.number().default(2),
    DB_POOL_MAX: joi_1.default.number().default(10),
    REDIS_HOST: joi_1.default.string().default('localhost'),
    REDIS_PORT: joi_1.default.number().port().default(6379),
    REDIS_PASSWORD: joi_1.default.string().allow(''),
    REDIS_DB: joi_1.default.number().default(0),
    JWT_SECRET: joi_1.default.string().min(32).required(),
    JWT_EXPIRES_IN: joi_1.default.string().default('7d'),
    GITHUB_CLIENT_ID: joi_1.default.string().allow(''),
    GITHUB_CLIENT_SECRET: joi_1.default.string().allow(''),
    GITHUB_CALLBACK_URL: joi_1.default.string().default('http://localhost:3000/auth/github/callback'),
    GITLAB_CLIENT_ID: joi_1.default.string().allow(''),
    GITLAB_CLIENT_SECRET: joi_1.default.string().allow(''),
    GITLAB_CALLBACK_URL: joi_1.default.string().default('http://localhost:3000/auth/gitlab/callback'),
    STORAGE_TYPE: joi_1.default.string().valid('local', 's3').default('local'),
    STORAGE_LOCAL_PATH: joi_1.default.string().default('./storage'),
    S3_BUCKET: joi_1.default.string().allow(''),
    S3_REGION: joi_1.default.string().allow(''),
    S3_ACCESS_KEY_ID: joi_1.default.string().allow(''),
    S3_SECRET_ACCESS_KEY: joi_1.default.string().allow(''),
    RECORDING_ENABLED: joi_1.default.boolean().default(true),
    RECORDING_FPS: joi_1.default.number().default(30),
    RECORDING_BITRATE: joi_1.default.string().default('2500k'),
    RECORDING_FORMAT: joi_1.default.string().default('mp4')
}).unknown(true);
const { value: validatedEnv, error } = schema.validate(process.env);
if (error) {
    throw new Error(`Environment validation error: ${error.message}`);
}
exports.config = {
    nodeEnv: validatedEnv.NODE_ENV,
    port: validatedEnv.PORT,
    cors: {
        origin: validatedEnv.CORS_ORIGIN.split(',').map((url) => url.trim())
    },
    database: {
        host: validatedEnv.DB_HOST,
        port: validatedEnv.DB_PORT,
        user: validatedEnv.DB_USER,
        password: validatedEnv.DB_PASSWORD,
        database: validatedEnv.DB_NAME,
        ssl: validatedEnv.DB_SSL,
        pool: {
            min: validatedEnv.DB_POOL_MIN,
            max: validatedEnv.DB_POOL_MAX
        }
    },
    redis: {
        host: validatedEnv.REDIS_HOST,
        port: validatedEnv.REDIS_PORT,
        password: validatedEnv.REDIS_PASSWORD || undefined,
        db: validatedEnv.REDIS_DB
    },
    jwt: {
        secret: validatedEnv.JWT_SECRET,
        expiresIn: validatedEnv.JWT_EXPIRES_IN
    },
    oauth: {
        github: {
            clientID: validatedEnv.GITHUB_CLIENT_ID,
            clientSecret: validatedEnv.GITHUB_CLIENT_SECRET,
            callbackURL: validatedEnv.GITHUB_CALLBACK_URL
        },
        gitlab: {
            clientID: validatedEnv.GITLAB_CLIENT_ID,
            clientSecret: validatedEnv.GITLAB_CLIENT_SECRET,
            callbackURL: validatedEnv.GITLAB_CALLBACK_URL
        }
    },
    storage: {
        type: validatedEnv.STORAGE_TYPE,
        local: {
            path: validatedEnv.STORAGE_LOCAL_PATH
        },
        s3: {
            bucket: validatedEnv.S3_BUCKET,
            region: validatedEnv.S3_REGION,
            accessKeyId: validatedEnv.S3_ACCESS_KEY_ID,
            secretAccessKey: validatedEnv.S3_SECRET_ACCESS_KEY
        }
    },
    recording: {
        enabled: validatedEnv.RECORDING_ENABLED,
        fps: validatedEnv.RECORDING_FPS,
        bitrate: validatedEnv.RECORDING_BITRATE,
        outputFormat: validatedEnv.RECORDING_FORMAT
    }
};
//# sourceMappingURL=environment.js.map