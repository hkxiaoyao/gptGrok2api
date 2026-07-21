import type { Ref } from 'vue'
import { registerApi, type LegacyRegisterConfig } from '@/api/register'

export type OutlookResetScope = 'all' | 'retryable' | 'invalid' | 'unused'

type ConfirmOptions = {
  title: string
  message: string
  confirmText: string
}

export type RegisterOutlookPoolRuntimeInput = {
  saving: Ref<boolean>
  confirm: (options: ConfirmOptions) => Promise<boolean>
  applyConfig: (config: LegacyRegisterConfig) => void
  notifySuccess: (message: string) => void
  notifyError: (message: string) => void
}

export const outlookPoolActionItems = [
  { key: 'retryable', label: '释放全部占用/失败' },
  { key: 'invalid', label: '清除异常标记', dividerBefore: true },
  { key: 'unused', label: '删除未使用邮箱', danger: true, dividerBefore: true },
  { key: 'all', label: '重置全部邮箱池', danger: true },
]

const resetCopy: Record<OutlookResetScope, ConfirmOptions> = {
  retryable: {
    title: '释放全部占用/临时失败',
    message: '将释放邮箱池中全部 in_use 和 failed 邮箱，但不会自动启动注册任务。',
    confirmText: '释放',
  },
  invalid: {
    title: '清除异常标记',
    message: '将清除 token_invalid 和 login_required 标记，但不会修复失效的 refresh_token；请确认材料已经重新导入或可重新尝试。',
    confirmText: '清除',
  },
  unused: {
    title: '删除未使用邮箱',
    message: '将从 Outlook 邮箱池配置中永久删除尚未使用、未占用且没有失败或异常记录的邮箱材料。',
    confirmText: '删除',
  },
  all: {
    title: '重置全部邮箱池',
    message: '将重置 Outlook 邮箱池状态，包括可用、占用、失败和已用记录。',
    confirmText: '重置',
  },
}

export function useRegisterOutlookPoolRuntime(input: RegisterOutlookPoolRuntimeInput) {
  async function resetPool(scope: OutlookResetScope) {
    const ok = await input.confirm(resetCopy[scope])
    if (!ok) return
    input.saving.value = true
    try {
      const response = await registerApi.resetOutlookPool(scope)
      input.applyConfig(response.register)
      input.notifySuccess('邮箱池状态已更新')
    } catch (error: any) {
      input.notifyError(error?.message || '邮箱池维护失败')
    } finally {
      input.saving.value = false
    }
  }

  async function retryFailedPool(providerId: string, mailboxIds: string[]) {
    const selected = Array.from(new Set(mailboxIds.filter(Boolean)))
    if (!providerId || selected.length === 0) {
      input.notifyError('请至少选择 1 个本次失败邮箱')
      return
    }
    const ok = await input.confirm({
      title: `重试所选 ${selected.length} 个邮箱`,
      message: `只会释放并重试所选 ${selected.length} 个本次失败邮箱，其他邮箱保持原状态。`,
      confirmText: '重试',
    })
    if (!ok) return
    input.saving.value = true
    try {
      const response = await registerApi.retrySelectedOutlookMailboxes(providerId, selected)
      input.applyConfig(response.register)
      input.notifySuccess(`已启动 ${selected.length} 个所选邮箱的重试任务`)
    } catch (error: any) {
      input.notifyError(error?.message || '重试临时失败邮箱失败')
    } finally {
      input.saving.value = false
    }
  }

  function handleAction(key: string) {
    if (key === 'retryable' || key === 'invalid' || key === 'unused' || key === 'all') {
      void resetPool(key)
    }
  }

  return {
    outlookPoolActionItems,
    resetPool,
    retryFailedPool,
    handleAction,
  }
}
