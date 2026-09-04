import type { IntegrationProvider } from "./types";
import { FeishuProvider } from "./feishu";
import { DingTalkProvider } from "./dingtalk";
import { WeComProvider } from "./wecom";

class ProviderRegistry {
  private providers = new Map<string, IntegrationProvider>();

  constructor() {
    // 默认内置的平台连接器
    this.register(new FeishuProvider());
    this.register(new DingTalkProvider());
    this.register(new WeComProvider());
  }

  public register(provider: IntegrationProvider): void {
    this.providers.set(provider.id, provider);
  }

  public get(id: string): IntegrationProvider | undefined {
    return this.providers.get(id);
  }

  public getAll(): IntegrationProvider[] {
    return Array.from(this.providers.values());
  }

  public getAvailable(): IntegrationProvider[] {
    return this.getAll().filter((p) => p.status === "available");
  }
}

export const providerRegistry = new ProviderRegistry();
