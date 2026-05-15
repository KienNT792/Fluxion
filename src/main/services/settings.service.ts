import { app, safeStorage } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { ProviderSettingsSummaryPayload } from '@shared'

interface PersistedSettingsDocument {
  openaiApiKey?: string
  openaiApiKeyEncrypted?: boolean
  updatedAt?: string
}

function maskSecret(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length <= 8) {
    return '••••••••'
  }

  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`
}

export class SettingsService {
  private static instance: SettingsService

  private constructor() {
    // Singleton
  }

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService()
    }

    return SettingsService.instance
  }

  private getSettingsFilePath(): string {
    return path.join(app.getPath('userData'), 'fluxion-settings.json')
  }

  private async readSettingsDocument(): Promise<PersistedSettingsDocument> {
    try {
      const rawContent = await fs.readFile(this.getSettingsFilePath(), 'utf-8')
      const parsed = JSON.parse(rawContent) as PersistedSettingsDocument
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  private async writeSettingsDocument(document: PersistedSettingsDocument): Promise<void> {
    const filePath = this.getSettingsFilePath()
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8')
  }

  private decodeStoredOpenAIApiKey(document: PersistedSettingsDocument): string | null {
    if (typeof document.openaiApiKey !== 'string' || document.openaiApiKey.trim().length === 0) {
      return null
    }

    if (document.openaiApiKeyEncrypted) {
      if (!safeStorage.isEncryptionAvailable()) {
        return null
      }

      try {
        const encryptedBuffer = Buffer.from(document.openaiApiKey, 'base64')
        return safeStorage.decryptString(encryptedBuffer).trim() || null
      } catch {
        return null
      }
    }

    return document.openaiApiKey.trim() || null
  }

  public async getStoredOpenAIApiKey(): Promise<string | null> {
    const document = await this.readSettingsDocument()
    return this.decodeStoredOpenAIApiKey(document)
  }

  public async resolveOpenAIApiKey(): Promise<string | null> {
    const storedApiKey = await this.getStoredOpenAIApiKey()
    if (storedApiKey) {
      return storedApiKey
    }

    const envApiKey = process.env.OPENAI_API_KEY?.trim()
    return envApiKey && envApiKey.length > 0 ? envApiKey : null
  }

  public async updateOpenAIApiKey(apiKey: string | null): Promise<ProviderSettingsSummaryPayload> {
    const normalizedKey = typeof apiKey === 'string' ? apiKey.trim() : ''

    if (!normalizedKey) {
      await this.writeSettingsDocument({})
      return this.getProviderSettingsSummary()
    }

    const shouldEncrypt = safeStorage.isEncryptionAvailable()
    const nextDocument: PersistedSettingsDocument = {
      openaiApiKey: shouldEncrypt
        ? safeStorage.encryptString(normalizedKey).toString('base64')
        : normalizedKey,
      openaiApiKeyEncrypted: shouldEncrypt,
      updatedAt: new Date().toISOString()
    }

    await this.writeSettingsDocument(nextDocument)
    return this.getProviderSettingsSummary()
  }

  public async getProviderSettingsSummary(): Promise<ProviderSettingsSummaryPayload> {
    const document = await this.readSettingsDocument()
    const storedApiKey = this.decodeStoredOpenAIApiKey(document)

    if (storedApiKey) {
      return {
        openaiApiKeyConfigured: true,
        openaiApiKeySource: 'stored',
        openaiApiKeyMasked: maskSecret(storedApiKey),
        storageMode: document.openaiApiKeyEncrypted ? 'secure' : 'plain'
      }
    }

    const envApiKey = process.env.OPENAI_API_KEY?.trim()
    if (envApiKey) {
      return {
        openaiApiKeyConfigured: true,
        openaiApiKeySource: 'env',
        openaiApiKeyMasked: maskSecret(envApiKey),
        storageMode: 'env'
      }
    }

    return {
      openaiApiKeyConfigured: false,
      openaiApiKeySource: 'none',
      storageMode: 'none'
    }
  }
}

export const settingsService = SettingsService.getInstance()
