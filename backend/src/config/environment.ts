import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  cors: {
    origin: string[];
  };
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
    pool: {
      min: number;
      max: number;
    };
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  oauth: {
    github: {
      clientID: string;
      clientSecret: string;
      callbackURL: string;
    };
    gitlab: {
      clientID: string;
      clientSecret: string;
      callbackURL: string;
    };
  };
  storage: {
    type: 'local' | 's3';
    local: {
      path: string;
    };
    s3: {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
  };
  recording: {
    enabled: boolean;
    fps: number;
    bitrate: string;
    outputFormat: string;
  };
}

const schema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),
  DB_POOL_MIN: Joi.number().default(2),
  DB_POOL_MAX: Joi.number().default(10),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow(''),
  REDIS_DB: Joi.number().default(0),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  GITHUB_CLIENT_ID: Joi.string().allow(''),
  GITHUB_CLIENT_SECRET: Joi.string().allow(''),
  GITHUB_CALLBACK_URL: Joi.string().default('http://localhost:3000/auth/github/callback'),
  GITLAB_CLIENT_ID: Joi.string().allow(''),
  GITLAB_CLIENT_SECRET: Joi.string().allow(''),
  GITLAB_CALLBACK_URL: Joi.string().default('http://localhost:3000/auth/gitlab/callback'),
  STORAGE_TYPE: Joi.string().valid('local', 's3').default('local'),
  STORAGE_LOCAL_PATH: Joi.string().default('./storage'),
  S3_BUCKET: Joi.string().allow(''),
  S3_REGION: Joi.string().allow(''),
  S3_ACCESS_KEY_ID: Joi.string().allow(''),
  S3_SECRET_ACCESS_KEY: Joi.string().allow(''),
  RECORDING_ENABLED: Joi.boolean().default(true),
  RECORDING_FPS: Joi.number().default(30),
  RECORDING_BITRATE: Joi.string().default('2500k'),
  RECORDING_FORMAT: Joi.string().default('mp4')
}).unknown(true);

const { value: validatedEnv, error } = schema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

export const config: Config = {
  nodeEnv: validatedEnv.NODE_ENV as any,
  port: validatedEnv.PORT,
  cors: {
    origin: validatedEnv.CORS_ORIGIN.split(',').map((url: string) => url.trim())
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
