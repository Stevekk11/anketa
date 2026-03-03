import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../config/.env') });

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Chybí povinná konfigurační proměnná: ${key}`);
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export interface PollConfig {
  id: number;
  title: string;
  options: { key: 'a' | 'b' | 'c'; label: string }[];
}

const polls: PollConfig[] = [
  {
    id: 1,
    title: required('POLL1_TITLE'),
    options: [
      { key: 'a', label: required('POLL1_OPTION_A') },
      { key: 'b', label: required('POLL1_OPTION_B') },
      { key: 'c', label: required('POLL1_OPTION_C') },
    ],
  },
  {
    id: 2,
    title: required('POLL2_TITLE'),
    options: [
      { key: 'a', label: required('POLL2_OPTION_A') },
      { key: 'b', label: required('POLL2_OPTION_B') },
      { key: 'c', label: required('POLL2_OPTION_C') },
    ],
  },
];

const config = {
  port: parseInt(optional('PORT', '3000'), 10),
  resetToken: required('RESET_TOKEN'),
  logLevel: optional('LOG_LEVEL', 'info'),
  polls,
};

export default config;

