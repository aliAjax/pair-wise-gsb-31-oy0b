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
        <em v-if="fromItem" class="status-pill" :class="statusToneClass(fromItem.status)">
          {{ formatItemStatus(fromItem.status) }}
        </em>
      </div>
      <div>
        <span>换取</span>
        <strong>{{ toItem?.title ?? '未知物品' }}</strong>
        <em v-if="toItem" class="status-pill" :class="statusToneClass(toItem.status)">
          {{ formatItemStatus(toItem.status) }}
        </em>
      </div>
    </div>
    <p>{{ exchange.message || formatStatusMessage(exchange.status) }}</p>
    <div v-if="exchange.status === ExchangeStatus.ACCEPTED" class="exchange-card__confirm">
      <span :class="{ 'confirm-done': exchange.from_confirmed_at }">
        发起方{{ exchange.from_confirmed_at ? `已确认 · ${formatDate(exchange.from_confirmed_at)}` : '未确认' }}
      </span>
      <span :class="{ 'confirm-done': exchange.to_confirmed_at }">
        物主{{ exchange.to_confirmed_at ? `已确认 · ${formatDate(exchange.to_confirmed_at)}` : '未确认' }}
      </span>
    </div>
    <footer>
      <span v-if="fromUser && toUser">{{ fromUser.nickname }} → {{ toUser.nickname }}</span>
      <div v-if="canOperate" class="exchange-card__actions">
        <template v-if="exchange.status === ExchangeStatus.PENDING">
          <button type="button" @click="$emit('accept', exchange.id)">同意</button>
          <button type="button" @click="$emit('reject', exchange.id)">拒绝</button>
        </template>
        <template v-else-if="exchange.status === ExchangeStatus.ACCEPTED">
          <button type="button" @click="$emit('withdraw', exchange.id)">撤回</button>
          <button type="button" :disabled="selfConfirmed" @click="$emit('confirm', exchange.id)">
            {{ selfConfirmed ? '已确认，等待对方' : '确认完成' }}
          </button>
        </template>
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
import {
  formatDate,
  formatExchangeStatus,
  formatItemStatus,
  formatStatusMessage,
  statusToneClass,
} from '@/utils/formatters';

const props = defineProps<{
  exchange: Exchange;
  items: Item[];
  users: User[];
}>();

defineEmits<{
  accept: [id: string];
  reject: [id: string];
  withdraw: [id: string];
  confirm: [id: string];
}>();

const authStore = useAuthStore();
const fromItem = computed(() => props.items.find((item) => item.id === props.exchange.from_item_id));
const toItem = computed(() => props.items.find((item) => item.id === props.exchange.to_item_id));
const fromUser = computed(() => props.users.find((user) => user.id === props.exchange.from_user_id));
const toUser = computed(() => props.users.find((user) => user.id === props.exchange.to_user_id));
const isFromUser = computed(() => authStore.currentUser?.id === props.exchange.from_user_id);
const isToUser = computed(() => authStore.currentUser?.id === props.exchange.to_user_id);
const isParty = computed(() => isFromUser.value || isToUser.value);
const selfConfirmed = computed(() => {
  if (isFromUser.value) return Boolean(props.exchange.from_confirmed_at);
  if (isToUser.value) return Boolean(props.exchange.to_confirmed_at);
  return false;
});
const canOperate = computed(() => {
  if (props.exchange.status === ExchangeStatus.PENDING) return isToUser.value;
  if (props.exchange.status === ExchangeStatus.ACCEPTED) return isParty.value;
  return false;
});
</script>
