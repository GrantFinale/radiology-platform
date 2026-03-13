import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3004),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  database: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(5432),
    name: z.string().default('radiology_integration'),
    user: z.string().default('postgres'),
    password: z.string().default('postgres'),
    ssl: z.coerce.boolean().default(false),
  }),

  redis: z.object({
    host: z.string().default('localhost'),
    port: z.coerce.number().default(6379),
    password: z.string().optional(),
  }),

  fhir: z.object({
    serverUrl: z.string().default('http://localhost:8080/fhir'),
    authType: z.enum(['none', 'basic', 'bearer', 'oauth2']).default('none'),
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
  }),

  emr: z.object({
    epic: z.object({
      baseUrl: z.string().default(''),
      clientId: z.string().default(''),
      privateKeyPath: z.string().default(''),
      fhirVersion: z.string().default('R4'),
      defaultFhirEndpoint: z.string().default('/api/FHIR/R4'),
    }),
    cerner: z.object({
      baseUrl: z.string().default(''),
      clientId: z.string().default(''),
      clientSecret: z.string().default(''),
      tokenEndpoint: z.string().default('/oauth2/token'),
      fhirEndpoint: z.string().default('/fhir/r4'),
    }),
  }),

  hl7: z.object({
    defaultSendingApp: z.string().default('RADIOLOGY_PLATFORM'),
    defaultSendingFacility: z.string().default('RAD_FAC'),
    defaultReceivingApp: z.string().default('EMR_SYSTEM'),
    defaultReceivingFacility: z.string().default('EMR_FAC'),
    retryAttempts: z.coerce.number().default(3),
    retryDelayMs: z.coerce.number().default(5000),
  }),

  queue: z.object({
    concurrency: z.coerce.number().default(5),
    maxRetries: z.coerce.number().default(3),
    retryDelay: z.coerce.number().default(5000),
  }),
});

type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  return configSchema.parse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,

    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      name: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL,
    },

    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    },

    fhir: {
      serverUrl: process.env.FHIR_SERVER_URL,
      authType: process.env.FHIR_AUTH_TYPE,
      username: process.env.FHIR_USERNAME,
      password: process.env.FHIR_PASSWORD,
      token: process.env.FHIR_TOKEN,
    },

    emr: {
      epic: {
        baseUrl: process.env.EPIC_BASE_URL,
        clientId: process.env.EPIC_CLIENT_ID,
        privateKeyPath: process.env.EPIC_PRIVATE_KEY_PATH,
        fhirVersion: process.env.EPIC_FHIR_VERSION,
        defaultFhirEndpoint: process.env.EPIC_FHIR_ENDPOINT,
      },
      cerner: {
        baseUrl: process.env.CERNER_BASE_URL,
        clientId: process.env.CERNER_CLIENT_ID,
        clientSecret: process.env.CERNER_CLIENT_SECRET,
        tokenEndpoint: process.env.CERNER_TOKEN_ENDPOINT,
        fhirEndpoint: process.env.CERNER_FHIR_ENDPOINT,
      },
    },

    hl7: {
      defaultSendingApp: process.env.HL7_SENDING_APP,
      defaultSendingFacility: process.env.HL7_SENDING_FACILITY,
      defaultReceivingApp: process.env.HL7_RECEIVING_APP,
      defaultReceivingFacility: process.env.HL7_RECEIVING_FACILITY,
      retryAttempts: process.env.HL7_RETRY_ATTEMPTS,
      retryDelayMs: process.env.HL7_RETRY_DELAY_MS,
    },

    queue: {
      concurrency: process.env.QUEUE_CONCURRENCY,
      maxRetries: process.env.QUEUE_MAX_RETRIES,
      retryDelay: process.env.QUEUE_RETRY_DELAY,
    },
  });
}

export const config = loadConfig();
export type { Config };
