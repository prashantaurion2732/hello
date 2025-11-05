import Joi from 'joi';
import { config } from '../config';

export const validators = {
  interests: Joi.array()
    .items(
      Joi.string()
        .trim()
        .min(1)
        .max(config.security.maxInterestLength)
        .pattern(/^[a-zA-Z0-9\s-_]+$/)
    )
    .max(config.security.maxInterests)
    .default([]),

  message: Joi.string()
    .trim()
    .min(1)
    .max(config.security.maxMessageLength)
    .required(),

  reportReason: Joi.string()
    .trim()
    .min(5)
    .max(500)
    .required(),
};

export const validateInterests = (interests: string[]): { valid: boolean; error?: string } => {
  const { error } = validators.interests.validate(interests);
  if (error) {
    return { valid: false, error: error.message };
  }
  return { valid: true };
};

export const validateMessage = (message: string): { valid: boolean; error?: string } => {
  const { error } = validators.message.validate(message);
  if (error) {
    return { valid: false, error: error.message };
  }
  return { valid: true };
};

export const validateReportReason = (reason: string): { valid: boolean; error?: string } => {
  const { error } = validators.reportReason.validate(reason);
  if (error) {
    return { valid: false, error: error.message };
  }
  return { valid: true };
};

export const sanitizeInterests = (interests: string[]): string[] => {
  return interests
    .map((i) => i.trim().toLowerCase())
    .filter((i) => i.length > 0)
    .slice(0, config.security.maxInterests);
};
