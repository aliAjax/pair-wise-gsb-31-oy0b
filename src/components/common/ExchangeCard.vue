<template>
  <article class="exchange-card">
    <header>
      <span class="status-pill" :class="statusToneClass(exchange.status)">
        {{ formatExchangeStatus(exchange.status) }}
      </span>
      <small>{{ formatDate(exchange.updated_at) }}</small>
    </header>
    <div class="exchange-card__items">
      <div>
        <span>拿出</span>
        <strong>{{ fromItem?.title ?? '未知物品' }}</strong>
        <small v-if="fromItem" class="exchange-card__item-status">{{ formatItemStatus(fromItem.status) }}</small>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
        <small v-if="toItem" class="exchange-card__item-status">{{ formatItemStatus(toItem.status) }}</small>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <p v-if="exchange.status === ExchangeStatus.ACCEPTED" class="exchange-card__hint">{{ confirmHint }}</p>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="showPendingActions" class="exchange-card__actions">
        <button type="button" @click="$emit('accept', exchange.id)">同意</button>
        <button type="button" @click="$emit('reject', exchange.id)">拒绝</button>
      </div>
      <div v-else-if="showAcceptedActions" class="exchange-card__actions">
        <button type="button" :disabled="iConfirmed" @click="$emit('confirm', exchange.id)">
          {{ iConfirmed ? '已确认，等待对方' : '确认完成' }}
        </button>
        <button type="button" @click="$emit('withdraw', exchange.id)">撤回</button>
      </div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { ExchangeStatus } from '@/constants/exchange';
import type { Exchange } from '@/models/exchange';
import type { Item } from '@/models/item';
import type { User } from '@/models/user';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatExchangeStatus, formatItemStatus, formatStatusMessage, statusToneClass } from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  confirm: [id: string];
  withdraw: [id: string];
}>();

const authStore = useAuthStore();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));
const isFromUser = computed(() => authStore.currentUser?.id === props.exchange.from_user_id);
const isToUser = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
const isParty = computed(() => Boolean(isFromUser.value || isToUser.value));
const showPendingActions = computed(() => props.exchange.status === ExchangeStatus.PENDING && isToUser.value);
const showAcceptedActions = computed(() => props.exchange.status === ExchangeStatus.ACCEPTED && isParty.value);
const iConfirmed = computed(() =>
  Boolean(authStore.currentUser && props.exchange.confirmed_by.includes(authStore.currentUser.id)),
);
const otherConfirmed = computed(() => {
  const otherId = isFromUser.value ? props.exchange.to_user_id : props.exchange.from_user_id;
  return props.exchange.confirmed_by.includes(otherId);
});
const confirmHint = computed(() => {
  if (iConfirmed.value) return '你已确认完成，等待对方确认';
  if (otherConfirmed.value) return '对方已确认完成，等待你确认';
  return '双方确认完成后，两件物品才会标记为已交换';
});
</script>
